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
 * Take every member's personal copy of a shared book away.
 *
 * Used when a share is withdrawn and when a member is removed from the club.
 * Access to a shared book is the copy — there is nothing else to revoke — so
 * this is what "they immediately lose access" actually means.
 *
 * The sharer's own original is never caught by this: a copy is stored under
 * the share id ("<uid>_<courseId>"), an original under its own generated id,
 * so the two can't collide.
 */
export async function deleteSharedCopies(
  db: Firestore,
  memberIds: string[],
  shareIds: string[],
): Promise<void> {
  if (shareIds.length === 0) return;
  const batch = db.batch();
  let writes = 0;
  for (const memberId of memberIds) {
    for (const shareId of shareIds) {
      batch.delete(db.collection("users").doc(memberId).collection("courses").doc(shareId));
      writes++;
    }
  }
  if (writes > 0) await batch.commit();
}

/**
 * Close a Book Club down: the owner has stopped paying for it, by changing
 * tier or by deleting their account.
 *
 * Everything the club granted goes at once — membership, the shared shelf, and
 * every copy taken from it. Marking the family cancelled is not enough on its
 * own: access is granted on a member's familyId, and a shared book is read
 * through a copy sitting in that member's own collection, so a club that is
 * only *flagged* closed leaves both of those still working.
 *
 * `exceptUid` is the caller — the owner, whose own record the caller updates
 * itself (with the tier change, or by deleting the account outright).
 */
export async function dissolveClub(db: Firestore, familyId: string, exceptUid: string): Promise<void> {
  const familyRef = db.collection("families").doc(familyId);
  const [famSnap, shares] = await Promise.all([
    familyRef.get(),
    familyRef.collection("sharedBooks").get(),
  ]);
  if (!famSnap.exists) return;

  const memberIds: string[] = famSnap.data()!.memberIds ?? [];
  const shareIds = shares.docs.map((d) => d.id);

  await familyRef.update({ status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });

  const batch = db.batch();
  for (const doc of shares.docs) batch.delete(doc.ref);
  for (const memberId of memberIds) {
    for (const shareId of shareIds) {
      batch.delete(db.collection("users").doc(memberId).collection("courses").doc(shareId));
    }
    if (memberId === exceptUid) continue;
    batch.update(db.collection("users").doc(memberId), { familyId: null, isFamilyOwner: false });
  }
  await batch.commit();

  // Unredeemed invites to a club that no longer exists.
  const invites = await db.collection("invites").where("familyId", "==", familyId).get();
  if (!invites.empty) {
    const inviteBatch = db.batch();
    for (const doc of invites.docs) inviteBatch.delete(doc.ref);
    await inviteBatch.commit();
  }
}
