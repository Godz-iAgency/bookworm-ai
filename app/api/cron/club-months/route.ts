import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { rollFreeClubMonths } from "@/lib/club-months";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The daily sweep that starts and rolls over the month for Book Club members
 * whose club owner has complimentary access (see lib/club-months.ts). Runs from
 * vercel.json's cron schedule, protected by CRON_SECRET exactly like the other
 * sweep: Vercel sends it as a bearer token when the variable is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("club-months: CRON_SECRET is not set. Refusing to run.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }
  try {
    return NextResponse.json(await rollFreeClubMonths(getAdminDb()));
  } catch (error: any) {
    console.error("club-months failed:", error);
    return NextResponse.json({ error: error.message || "Sweep failed." }, { status: 500 });
  }
}
