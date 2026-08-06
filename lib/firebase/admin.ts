import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only Firebase Admin SDK — bypasses Firestore security rules, so
 * this is the ONLY place billing fields (plan, trialStatus, stripe*Id, etc.)
 * should ever be written. The client SDK must never write these directly:
 * a user could otherwise open devtools and grant themselves a paid plan.
 *
 * Needs a Firebase service account (Console → Project Settings → Service
 * Accounts → Generate new private key). Throws lazily on first use, not at
 * import time, so the app still boots before this is configured.
 */
let _app: App | null = null;
let _db: Firestore | null = null;

/**
 * The Firebase project the browser signs users into. Hardcoded in
 * lib/firebase/config.ts, so it's repeated here rather than read from env —
 * an ID token minted for this project only verifies against a service
 * account from the same project.
 */
export const CLIENT_PROJECT_ID = "bookworm-ai-ca43d";

/**
 * A service-account private key survives a lot of copy/paste on its way into
 * a hosting dashboard, and arrives in one of three shapes:
 *
 *   1. real newlines, unquoted        — what a correct paste looks like
 *   2. one line with literal \n       — copied out of the service-account JSON
 *   3. either of the above, but still wrapped in the quotes that made it a
 *      single value inside .env.local
 *
 * Local dev only ever sees (1), because Next's env parser strips the quotes
 * for us. Vercel stores exactly what you paste, quotes included, and cert()
 * then rejects the key — which used to surface to the reader as
 * "Not authenticated." All three shapes are normalised to a real PEM here.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim().replace(/^["']|["']$/g, "");
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim().replace(/^["']|["']$/g, "");
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Name what's actually missing. "Credentials are not configured" sent us
  // hunting through all three vars when only one was ever wrong.
  const missing = [
    !projectId && "FIREBASE_ADMIN_PROJECT_ID",
    !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
    !rawKey && "FIREBASE_ADMIN_PRIVATE_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Firebase Admin is not configured on this deployment. Missing: ${missing.join(", ")}.`
    );
  }

  const privateKey = normalizePrivateKey(rawKey!);

  if (!privateKey.startsWith("-----BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY is set but is not a valid PEM key — it must start with -----BEGIN PRIVATE KEY-----. Check that the whole key was pasted."
    );
  }

  // A service account from a different project produces tokens that never
  // verify, and Firebase reports that as a generic auth failure. Say it plainly.
  if (projectId !== CLIENT_PROJECT_ID) {
    throw new Error(
      `FIREBASE_ADMIN_PROJECT_ID is "${projectId}" but the app signs users into "${CLIENT_PROJECT_ID}". Tokens from one project cannot be verified by a service account from another.`
    );
  }

  _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _app;
}

/**
 * Configuration-only health check for /api/health/billing. Reports booleans
 * and variable names, never any value.
 */
export function getAdminConfigStatus() {
  let initializes = false;
  let problem: string | null = null;
  try {
    getAdminApp();
    initializes = true;
  } catch (err: any) {
    problem = err?.message ?? "Unknown error initialising Firebase Admin.";
  }
  return {
    projectIdSet: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmailSet: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKeySet: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    initializes,
    problem,
  };
}

export function getAdminDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db;
}

/**
 * Resolves the caller's uid from their Firebase ID token, sent as
 * `Authorization: Bearer <token>`.
 *
 * Billing routes MUST use this rather than trusting a uid in the request
 * body — otherwise anyone could POST another user's uid and change their
 * plan or charge their saved card. Returns null when the header is missing
 * or the token doesn't verify; callers should answer 401.
 *
 * A *configuration* failure deliberately throws instead of returning null.
 * Swallowing it turned a missing service account into "Not authenticated."
 * for the reader — an error about them, pointing at the wrong thing, while
 * the real cause stayed invisible. Callers surface it as a 500.
 */
export async function getUidFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  // Outside the try on purpose: this throws only when the server is
  // misconfigured, which is never the caller's fault.
  const app = getAdminApp();

  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error("ID token verification failed:", err);
    return null;
  }
}
