import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { planFromId } from "@/lib/plans";

const BOOK_CLUB_MAX_MEMBERS = planFromId("book_club").maxMembers ?? 4;

/** Redeems a Book Club invite code, adding the joining user to the family. */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing code." }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (userSnap.data()!.familyId) {
      return NextResponse.json({ error: "You're already in a Book Club." }, { status: 400 });
    }

    const inviteRef = db.collection("invites").doc(code);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }
    const invite = inviteSnap.data()!;
    if (invite.usedByUid) {
      return NextResponse.json({ error: "Invite already used." }, { status: 400 });
    }

    const familyRef = db.collection("families").doc(invite.familyId);
    const familySnap = await familyRef.get();
    if (!familySnap.exists || familySnap.data()!.status !== "active") {
      return NextResponse.json({ error: "This Book Club is no longer active." }, { status: 400 });
    }
    const memberIds: string[] = familySnap.data()!.memberIds ?? [];
    if (memberIds.length >= BOOK_CLUB_MAX_MEMBERS) {
      return NextResponse.json({ error: "This Book Club is full." }, { status: 400 });
    }

    const batch = db.batch();
    batch.update(familyRef, { memberIds: FieldValue.arrayUnion(uid) });
    batch.update(userRef, { familyId: invite.familyId, isFamilyOwner: false });
    batch.update(inviteRef, { usedByUid: uid, usedAt: new Date().toISOString() });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("family join failed:", error);
    return NextResponse.json({ error: error.message || "Could not join Book Club." }, { status: 500 });
  }
}
