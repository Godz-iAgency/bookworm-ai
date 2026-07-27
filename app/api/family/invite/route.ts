import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { planFromId } from "@/lib/plans";
import { randomBytes } from "node:crypto";

const BOOK_CLUB_MAX_MEMBERS = planFromId("book_club").maxMembers ?? 4;

/**
 * Book Club owner generates a shareable invite link. No email service is
 * wired up yet, so the owner copies the link and sends it however they
 * like — see /api/family/join for redemption.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const user = userSnap.data()!;
    if (!user.familyId || !user.isFamilyOwner) {
      return NextResponse.json({ error: "Only a Book Club owner can invite members." }, { status: 403 });
    }

    const familyRef = db.collection("families").doc(user.familyId);
    const familySnap = await familyRef.get();
    if (!familySnap.exists) {
      return NextResponse.json({ error: "Family not found." }, { status: 404 });
    }
    const memberIds: string[] = familySnap.data()!.memberIds ?? [];
    if (memberIds.length >= BOOK_CLUB_MAX_MEMBERS) {
      return NextResponse.json({ error: `Book Club is full (max ${BOOK_CLUB_MAX_MEMBERS} members).` }, { status: 400 });
    }

    const code = randomBytes(6).toString("base64url");
    // Top-level collection (not a subcollection of the family) so /api/family/join
    // can redeem a code with a single direct doc lookup — no collection-group
    // query or extra Firestore index needed.
    await db.collection("invites").doc(code).set({
      familyId: user.familyId,
      createdAt: new Date().toISOString(),
      usedByUid: null,
      usedAt: null,
    });

    return NextResponse.json({ code });
  } catch (error: any) {
    console.error("family invite failed:", error);
    return NextResponse.json({ error: error.message || "Could not create invite." }, { status: 500 });
  }
}
