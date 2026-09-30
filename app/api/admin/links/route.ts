import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin";
import type { AccessLink } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Every link is a free ride on the free Gemini key, so a link cannot be given unlimited books. */
const MAX_LINK_BOOKS = 10;

/**
 * The demo links, and their on/off switches.
 *
 * `action: "list"` reads them; `action: "create"` makes a new one;
 * `action: "toggle"` flips one. Turning a link off
 * does two things in one write, because a link and the free access behind it
 * are separate doors into the same room: the link stops redeeming, AND the
 * account's own override goes inactive, so a session already signed in loses
 * access the next time anything checks — rather than the holder keeping the
 * run of the app until they happen to log out.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!isAdminEmail(caller.email)) {
      return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    }

    const db = getAdminDb();
    const { action, token, active, label, bookLimit } = await req.json().catch(() => ({ action: "list" }));

    if (action === "create") {
      const name = typeof label === "string" ? label.trim() : "";
      if (!name || name.length > 60) {
        return NextResponse.json({ error: "Give the link a name of 60 characters or fewer." }, { status: 400 });
      }
      const limit = Number(bookLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LINK_BOOKS) {
        return NextResponse.json({ error: `Choose between 1 and ${MAX_LINK_BOOKS} books.` }, { status: 400 });
      }

      // A link opens ONE shared account, so each link gets its own fresh one:
      // no email and no password, a complimentary override that caps how many
      // books it can ever write, and nothing of anyone else's on its shelf.
      // Being complimentary is also what puts it on the free Gemini key
      // (lib/ai-keys.ts), so sharing a link can never run up the paid bill.
      const auth = getAdminAuth();
      const created = await auth.createUser({ displayName: name });
      try {
        const newToken = randomBytes(24).toString("base64url");
        const batch = db.batch();
        batch.set(db.collection("users").doc(created.uid), {
          email: null,
          displayName: name,
          photoURL: null,
          authProvider: "access-link",
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
          accessOverride: { label: name, lifetimeGenerations: limit, maxOpenBooks: limit, active: true },
        });
        batch.set(db.collection("accessLinks").doc(newToken), {
          uid: created.uid,
          label: name,
          active: true,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          useCount: 0,
        });
        await batch.commit();
      } catch (e) {
        // Never leave a sign-in behind with nothing attached to it.
        await auth.deleteUser(created.uid).catch(() => {});
        throw e;
      }
    }

    if (action === "toggle") {
      if (!token || typeof active !== "boolean") {
        return NextResponse.json({ error: "Missing token or state." }, { status: 400 });
      }
      const linkRef = db.collection("accessLinks").doc(token);
      const linkSnap = await linkRef.get();
      if (!linkSnap.exists) {
        return NextResponse.json({ error: "That link no longer exists." }, { status: 404 });
      }
      const batch = db.batch();
      batch.update(linkRef, { active });
      batch.update(db.collection("users").doc(linkSnap.data()!.uid), { "accessOverride.active": active });
      await batch.commit();
    }

    const snap = await db.collection("accessLinks").orderBy("createdAt", "desc").get();
    const links: AccessLink[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const user = await db.collection("users").doc(d.uid).get();
      const profile = user.data();
      links.push({
        token: doc.id,
        uid: d.uid,
        label: d.label ?? "Access link",
        active: !!d.active,
        createdAt: d.createdAt ?? "",
        lastUsedAt: d.lastUsedAt ?? null,
        useCount: d.useCount ?? 0,
        email: profile?.email ?? null,
        booksUsed: Number(profile?.generationsThisMonth ?? 0),
        bookLimit: profile?.accessOverride?.lifetimeGenerations ?? null,
      });
    }

    return NextResponse.json({ links });
  } catch (error: any) {
    console.error("admin links failed:", error);
    return NextResponse.json({ error: error.message || "Could not load links." }, { status: 500 });
  }
}
