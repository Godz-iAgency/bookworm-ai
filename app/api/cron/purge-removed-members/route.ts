import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { deleteAccount } from "@/lib/account-delete";

export const maxDuration = 60;
// Deletion must read live data, never a cached render of it.
export const dynamic = "force-dynamic";

/**
 * The daily sweep for Book Club members who were removed and never chose a
 * plan. Runs from vercel.json's cron schedule.
 *
 * This is the app's only scheduled job, and it exists because the alternative
 * doesn't work. Everywhere else — expired courses most of all — cleanup is
 * done lazily on the reader's next visit, which is fine when the worst case is
 * a stale row nobody can see. Here the worst case is an account we promised to
 * delete still existing months later because its owner never came back, which
 * is exactly the person most likely never to come back.
 *
 * Protected by CRON_SECRET: Vercel sends it as a bearer token automatically
 * when the variable is set. Without that, a route that deletes accounts would
 * be a URL anyone could hit.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("purge-removed-members: CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const due = await db
      .collection("users")
      .where("bookClubDeleteAt", "<=", new Date().toISOString())
      .get();

    let deleted = 0;
    let reprieved = 0;
    const failures: string[] = [];

    for (const doc of due.docs) {
      const user = doc.data();

      // Checked again here, not just trusted from the query: the countdown is
      // cleared when someone converts, but a write can fail, and deleting the
      // account of a reader who has since started paying is not a mistake that
      // can be walked back. Access wins over the clock, every time.
      const hasAccess =
        !!user.familyId || user.trialStatus === "active" || (!!user.plan && user.plan !== "free");
      if (hasAccess) {
        await doc.ref.update({ bookClubDeleteAt: null, bookClubRemovedAt: null });
        reprieved++;
        continue;
      }

      try {
        await deleteAccount(doc.id);
        deleted++;
      } catch (e: any) {
        // One bad account must not stop the rest of the sweep.
        console.error(`purge-removed-members: could not delete ${doc.id}:`, e?.message);
        failures.push(doc.id);
      }
    }

    return NextResponse.json({ checked: due.size, deleted, reprieved, failures: failures.length });
  } catch (error: any) {
    console.error("purge-removed-members failed:", error);
    return NextResponse.json({ error: error.message || "Sweep failed." }, { status: 500 });
  }
}
