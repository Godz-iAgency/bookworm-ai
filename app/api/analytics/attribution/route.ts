import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { recordAttribution } from "@/lib/analytics-server";

/**
 * The creator code a new account arrived with (?ref=, ?creator= or
 * ?utm_source= on any link into the app; see components/attribution-capture.tsx).
 * First touch wins, and only accounts under a week old can be attributed.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const created = (await getAdminAuth().getUser(uid)).metadata.creationTime;
    const result = await recordAttribution(getAdminDb(), uid, { source: body?.source, campaign: body?.campaign }, created);
    return NextResponse.json(result);
  } catch (error) {
    console.error("attribution failed:", error);
    return NextResponse.json({ error: "Could not record." }, { status: 500 });
  }
}
