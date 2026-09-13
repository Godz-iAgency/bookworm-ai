import { FieldValue, type Firestore, type DocumentData } from "firebase-admin/firestore";

/**
 * Server-side Book Club helpers. Every route that touches club data starts
 * here, because "is this caller actually on this club's roster" is the single
 * check standing between one reader and another reader's books.
 *
 * Admin SDK only — these bypass firestore.rules by design (see
 * lib/firebase/admin.ts), which is exactly why the membership check cannot be
 * left to the caller or to the UI.
 */

export interface ClubContext {
  familyId: string;
  ownerId: string;
  memberIds: string[];
  isOwner: boolean;
}

/** A failure with a real answer for the reader, carrying its own status code. */
export function clubError(status: number, message: string): Error {
  return Object.assign(new Error(message), { httpStatus: status });
}

/** The status to answer with for an error thrown by `clubError`. */
export function statusOf(error: unknown): number {
  const status = (error as { httpStatus?: unknown })?.httpStatus;
  return typeof status === "number" ? status : 500;
}

/**
 * The caller's active club, or null when they are not in one.
 *
 * The roster is the authority, not the user document's familyId. The two can
 * disagree — mid-removal, or if a write half-landed — and of the two, only the
 * roster belongs to the subscription actually being paid for.
 */
export async function loadClub(db: Firestore, uid: string): Promise<ClubContext | null> {
  const userSnap = await db.collection("users").doc(uid).get();
  const familyId: string | undefined = userSnap.data()?.familyId ?? undefined;
  if (!familyId) return null;

  const famSnap = await db.collection("families").doc(familyId).get();
  if (!famSnap.exists) return null;
  const fam = famSnap.data()!;
  if (fam.status !== "active") return null;

  const memberIds: string[] = fam.memberIds ?? [];
  if (!memberIds.includes(uid)) return null;

  return { familyId, ownerId: fam.ownerId, memberIds, isOwner: fam.ownerId === uid };
}

/** Same, but refuses rather than returning null — for routes that require a club. */
export async function requireClub(db: Firestore, uid: string): Promise<ClubContext> {
  const club = await loadClub(db, uid);
  if (!club) throw clubError(403, "You're not in a Book Club.");
  return club;
}

/**
 * A member's first name for the roster and the "shared by" line.
 *
 * Deliberately not lib/greeting.ts's greetingName: that one ends at "there"
 * ("Hi there"), which reads as a broken template next to a book — "Shared by
 * there". This falls back to the email handle and then to a neutral noun.
 */
export function memberName(data: DocumentData | undefined): string {
  const first = String(data?.displayName ?? "").trim().split(/\s+/)[0];
  if (first) return first;
  const handle = String(data?.email ?? "").split("@")[0];
  return handle || "Reader";
}

/**
 * Close a Book Club down: the owner has stopped paying for it, by changing
 * tier or by deleting their account.
 *
 * Everything the club granted goes at once — membership and the shared shelf.
 * Marking the family cancelled is not enough on its own: a shared book is read
 * live off the sharer's own course, gated by firestore.rules' isSharedWithReader
 * checking the reader's familyId against the owner's — so clearing every
 * member's familyId (and deleting the share pointers, belt-and-braces) is what
 * actually closes every door at once, not just the family document's label.
 *
 * `exceptUid` is the caller — the owner, whose own record the caller updates
 * itself (with the tier change, or by deleting the account outright).
 */
export async function dissolveClub(db: Firestore, familyId: string, exceptUid: string): Promise<void> {
  const familyRef = db.collection("families").doc(familyId);
  // The family document serializes this with share/open/join/remove.
  await db.runTransaction(async tx => {
    const famSnap = await tx.get(familyRef);
    if (!famSnap.exists) return;
    const shares = await tx.get(familyRef.collection("sharedBooks"));
    const invites = await tx.get(db.collection("invites").where("familyId", "==", familyId));
    const ids: string[] = famSnap.data()!.memberIds ?? [];
    const members = [];
    for (const id of ids) members.push(await tx.get(db.collection("users").doc(id)));
    tx.update(familyRef, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
    for (const share of shares.docs) tx.delete(share.ref);
    for (const member of members) {
      if (member.exists && member.id !== exceptUid && member.data()?.familyId === familyId) tx.update(member.ref, { familyId: null, isFamilyOwner: false });
    }
    for (const invite of invites.docs) tx.delete(invite.ref);
  });
}
