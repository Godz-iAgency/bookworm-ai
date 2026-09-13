import { NextResponse } from "next/server";
import { getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin";
import type { AccessLink } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * The demo links, and their on/off switches.
 *
 * `action: "list"` reads them; `action: "toggle"` flips one. Turning a link off
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
    const { action, token, active } = await req.json().catch(() => ({ action: "list" }));

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
