import { NextResponse } from "next/server";
import { getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin";
import { isOmtmKey } from "@/lib/funnel";

export const dynamic = "force-dynamic";

/**
 * Sets the One Metric That Matters shown at the top of the Control Centre.
 * Only ever changed by the admin, by hand. Nothing else writes it.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthedUser(req);
    if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    if (!isAdminEmail(caller.email)) return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    const { omtm } = await req.json().catch(() => ({}));
    if (!isOmtmKey(omtm)) return NextResponse.json({ error: "Unknown metric." }, { status: 400 });
    await getAdminDb().collection("adminSettings").doc("dashboard").set(
      { omtm, omtmUpdatedAt: new Date().toISOString() },
      { merge: true },
    );
    return NextResponse.json({ omtm });
  } catch (error: any) {
    console.error("omtm update failed:", error);
    return NextResponse.json({ error: error.message || "Could not save." }, { status: 500 });
  }
}
