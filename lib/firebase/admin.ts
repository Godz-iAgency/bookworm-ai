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

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _app;
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
 */
export async function getUidFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error("ID token verification failed:", err);
    return null;
  }
}
