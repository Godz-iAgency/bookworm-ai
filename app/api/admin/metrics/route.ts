import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin";
import { PLANS, planFromId } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Everything the control centre shows, in one call.
 *
 * Sign-up and last-seen dates come from Firebase Auth rather than a Firestore
 * field: Auth has recorded both for every account since the day it was
 * created, including the ones that predate any column we might have added for
 * it, so the history is real rather than starting today.
 *
 * This reads every account and every course on each load. At Bookworm's size
 * that is a few hundred documents and is honest, live data; if the roll ever
 * reaches the thousands this is the thing to replace with a nightly aggregate,
 * because it will get slow long before it gets wrong.
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
    const auth = getAdminAuth();

    // Auth accounts (paged — listUsers caps at 1000 per call).
    const authUsers: { uid: string; email: string | null; createdAt: string; lastSeenAt: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      for (const u of page.users) {
        authUsers.push({
          uid: u.uid,
          email: u.email ?? null,
          createdAt: u.metadata.creationTime,
          lastSeenAt: u.metadata.lastSignInTime ?? null,
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);

    const [profilesSnap, familiesSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("families").get(),
    ]);
    const profiles = new Map(profilesSnap.docs.map((d) => [d.id, d.data()]));

    // Every shelf in the app. A collection-group read is one query instead of
    // one per account; if the project has no group index for it yet, fall back
    // to reporting nothing here rather than failing the whole dashboard.
    let courseDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let coursesReadable = true;
    try {
      courseDocs = (await db.collectionGroup("courses").get()).docs;
    } catch (e) {
      coursesReadable = false;
      console.error("Could not read courses collection group:", e);
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const within = (iso: string | null | undefined, days: number) =>
      !!iso && now - new Date(iso).getTime() <= days * day;

    // ---- Growth -----------------------------------------------------------
    const signupsByDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * day);
      const key = d.toISOString().slice(0, 10);
      signupsByDay.push({
        date: key,
        count: authUsers.filter((u) => new Date(u.createdAt).toISOString().slice(0, 10) === key).length,
      });
    }

    // ---- Accounts, money, engagement --------------------------------------
    const tiers: Record<string, number> = { page_turner: 0, well_read: 0, book_club: 0 };
    const readingLevels: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};
    let trialsActive = 0, trialsConverted = 0, trialsLapsed = 0;
    let booksThisMonth = 0, paymentFailures = 0, cancelling = 0, comped = 0;
    let onboarded = 0, everGenerated = 0, finishedABook = 0;
    let booksFinishedTotal = 0, streaksActive = 0, pendingDeletion = 0;

    const todayKey = new Date().toISOString().slice(0, 10);
    const yesterdayKey = new Date(now - day).toISOString().slice(0, 10);

    for (const { uid } of authUsers) {
      const p = profiles.get(uid);
      if (!p) continue;

      booksThisMonth += Number(p.generationsThisMonth ?? 0);
      booksFinishedTotal += Number(p.booksFinished ?? 0);
      if (p.paymentFailedAt) paymentFailures++;
      if (p.subscriptionCancelAt) cancelling++;
      if (p.accessOverride?.active) comped++;
      if (p.bookClubDeleteAt) pendingDeletion++;

      // A streak only counts as alive if it was fed today or yesterday.
      if (p.lastActivityDate === todayKey || p.lastActivityDate === yesterdayKey) streaksActive++;

      if (p.readingLevel) {
        onboarded++;
        readingLevels[p.readingLevel] = (readingLevels[p.readingLevel] ?? 0) + 1;
      }
      for (const topic of (p.genrePreferences ?? []) as string[]) {
        topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
      }
      if (Number(p.generationsThisMonth ?? 0) > 0) everGenerated++;
      if (Number(p.booksFinished ?? 0) > 0) finishedABook++;

      if (p.trialStatus === "active") trialsActive++;
      else if (p.trialStatus === "converted") trialsConverted++;
      else if (p.trialStatus === "expired" || p.trialStatus === "cancelled") trialsLapsed++;

      // A Book Club member counts against the club's tier, not their own
      // (blank) plan — familyId is what actually grants them access.
      const tier = p.familyId ? "book_club" : p.plan;
      if (tier && tier in tiers && (p.familyId || p.plan !== "free")) tiers[tier]++;
    }

    // ---- Courses ----------------------------------------------------------
    const bookCounts: Record<string, { title: string; author: string; count: number }> = {};
    let coursesActive = 0, coursesShared = 0, coursesExpiringSoon = 0;
    let daysCompletedTotal = 0, coursesComplete = 0;

    for (const doc of courseDocs) {
      const c = doc.data();
      const expired = c.expiresAt && new Date(c.expiresAt).getTime() <= now;
      if (expired) continue;
      coursesActive++;
      if (c.sharedFrom) coursesShared++;
      if (c.expiresAt && new Date(c.expiresAt).getTime() - now <= 2 * day) coursesExpiringSoon++;

      const done = (c.days ?? []).filter((d: any) => d.isCompleted).length;
      daysCompletedTotal += done;
      if (done >= 7) coursesComplete++;

      const title = c.book?.title;
      if (title) {
        const key = String(title).trim().toLowerCase();
        bookCounts[key] ??= { title, author: c.book?.author ?? "", count: 0 };
        bookCounts[key].count++;
      }
    }

    const topBooks = Object.values(bookCounts).sort((a, b) => b.count - a.count).slice(0, 8);
    const topTopics = Object.entries(topicCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ---- Book Club --------------------------------------------------------
    const activeClubs = familiesSnap.docs.filter((d) => d.data().status === "active");
    const seatsUsed = activeClubs.reduce((n, d) => n + (d.data().memberIds?.length ?? 0), 0);
    let sharedBooks = 0;
    for (const club of activeClubs) {
      sharedBooks += (await club.ref.collection("sharedBooks").get()).size;
    }

    // Only the owner of each club is paying for it; the other seats are free.
    const priceOf = (id: string) => Number(planFromId(id).price.replace(/[^0-9.]/g, ""));
    const mrr =
      tiers.page_turner * priceOf("page_turner") +
      tiers.well_read * priceOf("well_read") +
      activeClubs.length * priceOf("book_club");

    const recent = [...authUsers]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15)
      .map(({ uid, email, createdAt, lastSeenAt }) => {
        const p = profiles.get(uid);
        return {
          email,
          createdAt,
          lastSeenAt,
          plan: p?.accessOverride?.active
            ? p.accessOverride.label
            : p?.familyId
              ? "Book Club"
              : p?.trialStatus === "active"
                ? "Trial"
                : p?.plan && p.plan !== "free"
                  ? planFromId(p.plan).name
                  : "Free",
          books: Number(p?.generationsThisMonth ?? 0),
          finished: Number(p?.booksFinished ?? 0),
          streak: Number(p?.streakCount ?? 0),
        };
      });

    const accounts = authUsers.length;
    return NextResponse.json({
      totals: {
        accounts,
        newToday: authUsers.filter((u) => new Date(u.createdAt).toISOString().slice(0, 10) === todayKey).length,
        newThisWeek: authUsers.filter((u) => within(u.createdAt, 7)).length,
        newThisMonth: authUsers.filter((u) => within(u.createdAt, 30)).length,
        activeToday: authUsers.filter((u) => within(u.lastSeenAt, 1)).length,
        activeThisWeek: authUsers.filter((u) => within(u.lastSeenAt, 7)).length,
        activeThisMonth: authUsers.filter((u) => within(u.lastSeenAt, 30)).length,
        comped,
        pendingDeletion,
      },
      signupsByDay,
      subscriptions: {
        pageTurner: tiers.page_turner,
        wellRead: tiers.well_read,
        bookClubMembers: tiers.book_club,
        bookClubs: activeClubs.length,
        seatsUsed,
        seatsTotal: activeClubs.length * (PLANS.find((p) => p.id === "book_club")?.maxMembers ?? 4),
        sharedBooks,
        mrr,
        arr: mrr * 12,
        cancelling,
        paymentFailures,
      },
      trials: {
        active: trialsActive,
        converted: trialsConverted,
        lapsed: trialsLapsed,
        conversionRate:
          trialsConverted + trialsLapsed > 0
            ? Math.round((trialsConverted / (trialsConverted + trialsLapsed)) * 100)
            : null,
      },
      funnel: {
        signedUp: accounts,
        onboarded,
        generated: everGenerated,
        finished: finishedABook,
      },
      engagement: {
        booksThisMonth,
        booksFinishedTotal,
        streaksActive,
        coursesActive,
        coursesShared,
        coursesComplete,
        coursesExpiringSoon,
        avgDaysPerCourse: coursesActive > 0 ? Math.round((daysCompletedTotal / coursesActive) * 10) / 10 : 0,
        completionRate: coursesActive > 0 ? Math.round((coursesComplete / coursesActive) * 100) : 0,
        coursesReadable,
      },
      library: { topBooks, topTopics, readingLevels },
      recent,
    });
  } catch (error: any) {
    console.error("admin metrics failed:", error);
    return NextResponse.json({ error: error.message || "Could not load metrics." }, { status: 500 });
  }
}
