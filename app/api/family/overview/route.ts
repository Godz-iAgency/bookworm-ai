import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { loadClub, memberName } from "@/lib/family-server";
import { BOOK_CLUB_MAX_MEMBERS, type ClubOverview, type SharedBookSummary } from "@/lib/book-club";

/**
 * Everything the Book Club screen shows: who's in it, what's on its shelf, and
 * (for the owner) how many seats are left.
 *
 * This is also the entitlement list. A shared book the reader can still see
 * locally but that isn't in this response is one they have lost access to —
 * because the sharer withdrew it, because it expired, or because they were
 * removed from the club — and the client prunes on that basis. Answering
 * `inClub: false` is therefore a meaningful answer, not an error.
 *
 * A share is a pointer, not a copy, so every card here is read fresh off the
 * sharer's actual course each time this loads — title, cover, expiry, whether
 * it even still exists. Nothing shown is ever a moment old.
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

    // A share's book lives in the sharer's own collection, so its current
    // state (still exists, still unexpired, current title/cover) has to be
    // read from there — there is no snapshot of it sitting on the pointer.
    const shares = sharesSnap.docs.map((doc) => ({ shareId: doc.id, data: doc.data() }));
    const courseSnaps = shares.length > 0
      ? await db.getAll(...shares.map(({ data }) => db.collection("users").doc(data.sharedByUid).collection("courses").doc(data.sourceCourseId)))
      : [];

    // Book Club gets no lifecycle of its own — it inherits the book's, so a
    // share dies when the course does (deleted or expired). Swept here, on
    // the docs already in hand. No scheduler, no extra query.
    const now = Date.now();
    const stale: FirebaseFirestore.DocumentReference[] = [];
    const withSharedAt: (SharedBookSummary & { sharedAt: string })[] = [];
    shares.forEach(({ shareId, data }, i) => {
      const courseSnap = courseSnaps[i];
      const course = courseSnap?.data();
      if (!courseSnap?.exists || !course || new Date(course.expiresAt).getTime() <= now) {
        stale.push(db.collection("families").doc(club.familyId).collection("sharedBooks").doc(shareId));
        return;
      }
      withSharedAt.push({
        shareId,
        title: course.book?.title ?? "",
        author: course.book?.author ?? "",
        coverUrl: course.book?.coverUrl ?? "",
        readingLevel: course.readingLevel ?? "",
        sharedByUid: data.sharedByUid,
        sharedByName: data.sharedByName,
        sourceCourseId: data.sourceCourseId,
        expiresAt: course.expiresAt,
        isMine: data.sharedByUid === uid,
        sharedAt: String(data.sharedAt ?? ""),
      });
    });
    withSharedAt.sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
    const sharedBooks: SharedBookSummary[] = withSharedAt.map(({ sharedAt, ...rest }) => rest);
    if (stale.length > 0) {
      const batch = db.batch();
      for (const ref of stale) batch.delete(ref);
      batch.commit().catch((e) => console.error("Could not sweep stale shares:", e));
    }

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
