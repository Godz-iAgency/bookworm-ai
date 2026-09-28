import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { recordDay1Activation } from "@/lib/analytics-server";

/**
 * "This reader has started Day 1." Sent by the app after Day 1's lesson has
 * been open on screen for a little while (lib/useDay1Activation.ts). Recorded
 * once per account; every later call is a harmless no-op.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { courseId } = await req.json().catch(() => ({}));
    const result = await recordDay1Activation(getAdminDb(), uid, courseId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("day1 activation failed:", error);
    return NextResponse.json({ error: "Could not record." }, { status: 500 });
  }
}
