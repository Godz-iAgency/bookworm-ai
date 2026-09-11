import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { loadClub, memberName } from "@/lib/family-server";
import { BOOK_CLUB_MAX_MEMBERS, type ClubOverview } from "@/lib/book-club";

/**
 * Everything the Book Club screen shows: who's in it, what's on its shelf, and
 * (for the owner) how many seats are left.
 *
 * This is also the entitlement list. A shared book the reader can still see a
 * local copy of but that isn't in this response is one they have lost access
 * to — because the sharer withdrew it, because it expired, or because they
 * were removed from the club — and the client prunes its copy on that basis.
 * Answering `inClub: false` is therefore a meaningful answer, not an error.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const db = getAdminDb();
    const club = await loadClub(db, uid);
    if (!club) {
      return NextResponse.json({ inClub: false } satisfies ClubOverview);
    }

    const [memberDocs, sharesSnap] = await Promise.all([
      db.getAll(...club.memberIds.map((id) => db.collection("users").doc(id))),
      db.collection("families").doc(club.familyId).collection("sharedBooks").get(),
    ]);

    const members = memberDocs.map((doc) => ({
      uid: doc.id,
      name: memberName(doc.data()),
      isOwner: doc.id === club.ownerId,
      isYou: doc.id === uid,
    }));

    // Book Club gets no lifecycle of its own — it inherits the book's, so a
    // share dies when the course does. Expired ones are swept here, on the
    // docs already in hand, the same way expired courses are cleaned up when a
    // shelf loads (see BookwormContext). No scheduler, no extra query.
    const now = Date.now();
    const expired = sharesSnap.docs.filter((d) => new Date(d.data().expiresAt).getTime() <= now);
    if (expired.length > 0) {
      const batch = db.batch();
      for (const doc of expired) batch.delete(doc.ref);
      batch.commit().catch((e) => console.error("Could not sweep expired shares:", e));
    }

    const sharedBooks = sharesSnap.docs
      .map((doc) => ({ shareId: doc.id, data: doc.data() }))
      .filter(({ data }) => new Date(data.expiresAt).getTime() > now)
      .sort((a, b) => String(b.data.sharedAt).localeCompare(String(a.data.sharedAt)))
      .map(({ shareId, data }) => ({
        shareId,
        title: data.book?.title ?? "",
        author: data.book?.author ?? "",
        coverUrl: data.book?.coverUrl ?? "",
        readingLevel: data.readingLevel ?? "",
        sharedByUid: data.sharedByUid,
        sharedByName: data.sharedByName,
        expiresAt: data.expiresAt,
        isMine: data.sharedByUid === uid,
      }));

    return NextResponse.json({
      inClub: true,
      familyId: club.familyId,
      isOwner: club.isOwner,
      maxMembers: BOOK_CLUB_MAX_MEMBERS,
      seatsAvailable: Math.max(0, BOOK_CLUB_MAX_MEMBERS - club.memberIds.length),
      members,
      sharedBooks,
    } satisfies ClubOverview);
  } catch (error: any) {
    console.error("family overview failed:", error);
    return NextResponse.json({ error: error.message || "Could not load your Book Club." }, { status: 500 });
  }
}
