import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { GUEST_LINK_BOOKS, GUEST_LINK_DAILY_LIMIT } from "@/lib/access";

export const dynamic = "force-dynamic";

/** A refusal with a message a reader can act on. */
class Refusal extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Turns an access link into a signed-in session.
 *
 * Deliberately unauthenticated - the whole point is that the holder has no
 * account and types nothing. The token IS the credential, so the checks that
 * matter are all here: the link must exist, still be switched on, and point at
 * an account whose override is also still switched on. Flipping either off
 * from the admin dashboard kills the link on the next tap.
 *
 * Two kinds of link share this route:
 *   - an account link (the Book Club link) signs in as one fixed account;
 *   - a guest link gives every new visitor an account of their own with one
 *     book to write (see redeemGuest).
 *
 * Answers with a Firebase custom token, which the browser exchanges for a real
 * session via signInWithCustomToken.
 */
export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string" || !/^[a-zA-Z0-9_-]{16,200}$/.test(token)) {
      return NextResponse.json({ error: "Missing link." }, { status: 400 });
    }

    const db = getAdminDb();
    const linkRef = db.collection("accessLinks").doc(token);
    const linkSnap = await linkRef.get();
    if (!linkSnap.exists) {
      return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
    }

    const link = linkSnap.data()!;
    if (!link.active) {
      return NextResponse.json({ error: "This link has been turned off." }, { status: 403 });
    }

    if (link.kind === "guest") {
      try {
        return await redeemGuest(req, db, linkRef, token, link);
      } catch (e: any) {
        if (e instanceof Refusal) return NextResponse.json({ error: e.message }, { status: e.status });
        throw e;
      }
    }

    const userSnap = await db.collection("users").doc(link.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
    }
    // Belt and braces: the link and the account's own complimentary access are
    // separate switches, and either one being off means no entry.
    if (userSnap.data()?.accessOverride?.active !== true) {
      return NextResponse.json({ error: "This link has been turned off." }, { status: 403 });
    }

    const customToken = await getAdminAuth().createCustomToken(link.uid);

    // Best effort - a failed counter must never cost someone their sign-in.
    linkRef
      .update({ lastUsedAt: new Date().toISOString(), useCount: FieldValue.increment(1) })
      .catch((e) => console.error("Could not record access link use:", e));

    return NextResponse.json({ customToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("access redeem failed:", error);
    return NextResponse.json({ error: error.message || "Could not open that link." }, { status: 500 });
  }
}

/**
 * A guest link: anyone who opens it gets their own account, with one book.
 *
 * Their week starts when they generate that book (courses live 8 days from
 * creation), and once it has expired the account has nothing left to give: its
 * one book is spent. Returning on the same device resumes the same guest
 * rather than minting another, until the week is over.
 *
 * Because the link is open to anyone, it is capped twice, in total and per
 * day, so a leaked or shared link cannot use up the free Gemini key that also
 * serves the founder's own reading. Each new guest is a complimentary account,
 * so it runs on the free key (lib/ai-keys.ts) and stays out of the paid-customer
 * numbers.
 */
async function redeemGuest(
  req: Request,
  db: FirebaseFirestore.Firestore,
  linkRef: FirebaseFirestore.DocumentReference,
  token: string,
  link: FirebaseFirestore.DocumentData,
) {
  // Already signed in on this device?
  const caller = await getAuthedUser(req);
  if (caller) {
    const guest = (await db.collection("accessGuests").doc(caller.uid).get()).data();
    if (guest?.token !== token) {
      // A real account is never swapped out from under its owner.
      throw new Refusal(409, "You are already signed in to Bookworm on this device. Open this link in a private window to try it as a guest.");
    }
    const profile = (await db.collection("users").doc(caller.uid).get()).data();
    const cap = profile?.accessOverride?.lifetimeGenerations;
    const spent = typeof cap === "number" && Number(profile?.generationsThisMonth ?? 0) >= cap;
    const courses = await db.collection("users").doc(caller.uid).collection("courses").get();
    const live = courses.docs.some((d) => Date.parse(d.data().expiresAt) > Date.now());
    return NextResponse.json(spent && !live ? { ended: true } : { resume: true }, { headers: { "Cache-Control": "no-store" } });
  }

  // A new guest: take a place first, so two people at once cannot both slip past a cap.
  const today = new Date().toISOString().slice(0, 10);
  await db.runTransaction(async (tx) => {
    const l = (await tx.get(linkRef)).data();
    if (!l || !l.active) throw new Refusal(403, "This link has been turned off.");
    if (Number(l.guestCount ?? 0) >= Number(l.maxGuests ?? 0)) {
      throw new Refusal(429, "This link has reached its limit. Ask whoever sent it to you for a new one.");
    }
    const daily = l.dailyDate === today ? Number(l.dailyCount ?? 0) : 0;
    if (daily >= GUEST_LINK_DAILY_LIMIT) {
      throw new Refusal(429, "A lot of people are trying Bookworm today. Please try this link again tomorrow.");
    }
    tx.update(linkRef, {
      guestCount: Number(l.guestCount ?? 0) + 1,
      dailyDate: today,
      dailyCount: daily + 1,
      lastUsedAt: new Date().toISOString(),
      useCount: Number(l.useCount ?? 0) + 1,
    });
  });

  const auth = getAdminAuth();
  let uid: string | null = null;
  try {
    uid = (await auth.createUser({ displayName: "Guest" })).uid;
    const guestUid = uid;
    await db.runTransaction(async (tx) => {
      tx.set(db.collection("users").doc(guestUid), {
        email: null,
        displayName: "Guest",
        photoURL: null,
        authProvider: "access-guest",
        createdAt: FieldValue.serverTimestamp(),
        readingLevel: null,
        preferredLanguage: "en",
        genrePreferences: [],
        plan: "free",
        trialStatus: null,
        trialStartedAt: null,
        trialEndsAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePaymentMethodId: null,
        generationsThisMonth: 0,
        monthResetAt: null,
        showTrialEndWarning: false,
        reminderEmailSentAt: null,
        notificationTime: null,
        familyId: null,
        isFamilyOwner: false,
        accessOverride: { label: String(link.label ?? "Guest link"), lifetimeGenerations: GUEST_LINK_BOOKS, maxOpenBooks: GUEST_LINK_BOOKS, active: true },
      });
      // Which link made this guest. Server-only: clients cannot read or write this collection.
      tx.set(db.collection("accessGuests").doc(guestUid), { token, createdAt: new Date().toISOString() });
    });
    const customToken = await auth.createCustomToken(guestUid);
    return NextResponse.json({ customToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Give the place back, and never leave a sign-in behind with nothing attached to it.
    if (uid) await auth.deleteUser(uid).catch(() => {});
    await db
      .runTransaction(async (tx) => {
        const l = (await tx.get(linkRef)).data();
        if (!l) return;
        tx.update(linkRef, {
          guestCount: Math.max(0, Number(l.guestCount ?? 0) - 1),
          dailyCount: l.dailyDate === today ? Math.max(0, Number(l.dailyCount ?? 0) - 1) : Number(l.dailyCount ?? 0),
        });
      })
      .catch((e) => console.error("Could not return a guest place:", e));
    throw error;
  }
}
