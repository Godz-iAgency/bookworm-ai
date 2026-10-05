import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin";
import { GUEST_LINK_MAX_GUESTS, type AccessLink } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * The demo links, and their on/off switches.
 *
 * `action: "list"` reads them; `action: "create"` makes a guest link;
 * `action: "rename"` renames one; `action: "toggle"` flips one.
 *
 * Two kinds exist. The Book Club link signs in as one fixed account (its
 * toggle flips that account's access too). A guest link gives each visitor an
 * account of their own with one book (see /api/access/redeem); its toggle
 * flips every guest it has made, so turning a link off also locks out the
 * people already signed in through it, not just the next visitor.
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
    const { action, token, active, label, maxGuests } = await req.json().catch(() => ({ action: "list" }));

    if (action === "create") {
      const name = typeof label === "string" ? label.trim() : "";
      if (!name || name.length > 60) {
        return NextResponse.json({ error: "Give the link a name of 60 characters or fewer." }, { status: 400 });
      }
      const limit = Number(maxGuests);
      if (!Number.isInteger(limit) || limit < 1 || limit > GUEST_LINK_MAX_GUESTS) {
        return NextResponse.json({ error: `Choose between 1 and ${GUEST_LINK_MAX_GUESTS} people.` }, { status: 400 });
      }
      await db.collection("accessLinks").doc(randomBytes(24).toString("base64url")).set({
        kind: "guest",
        label: name,
        active: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        useCount: 0,
        guestCount: 0,
        maxGuests: limit,
        dailyDate: null,
        dailyCount: 0,
      });
    }

    if (action === "rename") {
      const name = typeof label === "string" ? label.trim() : "";
      if (!token || !name || name.length > 60) {
        return NextResponse.json({ error: "Give the link a name of 60 characters or fewer." }, { status: 400 });
      }
      const linkRef = db.collection("accessLinks").doc(token);
      const linkSnap = await linkRef.get();
      if (!linkSnap.exists) {
        return NextResponse.json({ error: "That link no longer exists." }, { status: 404 });
      }
      // The name is what the reader sees as their plan, copied onto each
      // account when the link signed it in, so those accounts change with it.
      const link = linkSnap.data()!;
      const batch = db.batch();
      batch.update(linkRef, { label: name });
      if (link.kind === "guest") {
        const guests = await db.collection("accessGuests").where("token", "==", token).get();
        for (const g of guests.docs) batch.update(db.collection("users").doc(g.id), { "accessOverride.label": name });
      } else {
        const accountRef = db.collection("users").doc(link.uid);
        if ((await accountRef.get()).data()?.accessOverride) batch.update(accountRef, { "accessOverride.label": name });
      }
      await batch.commit();
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
      const link = linkSnap.data()!;
      const batch = db.batch();
      batch.update(linkRef, { active });
      if (link.kind === "guest") {
        const guests = await db.collection("accessGuests").where("token", "==", token).get();
        for (const g of guests.docs) batch.update(db.collection("users").doc(g.id), { "accessOverride.active": active });
      } else {
        batch.update(db.collection("users").doc(link.uid), { "accessOverride.active": active });
      }
      await batch.commit();
    }

    const snap = await db.collection("accessLinks").orderBy("createdAt", "desc").get();
    const links: AccessLink[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.kind === "guest") {
        links.push({
          token: doc.id,
          kind: "guest",
          uid: "",
          label: d.label ?? "Guest link",
          active: !!d.active,
          createdAt: d.createdAt ?? "",
          lastUsedAt: d.lastUsedAt ?? null,
          useCount: d.useCount ?? 0,
          guestCount: Number(d.guestCount ?? 0),
          maxGuests: Number(d.maxGuests ?? 0),
        });
        continue;
      }
      const user = await db.collection("users").doc(d.uid).get();
      const profile = user.data();
      links.push({
        token: doc.id,
        kind: "account",
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
