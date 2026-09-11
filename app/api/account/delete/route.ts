import { NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/firebase/admin";
import { deleteAccount } from "@/lib/account-delete";

export const maxDuration = 60;

/**
 * The reader deleting their own account. The work itself lives in
 * lib/account-delete.ts, shared with the daily sweep that clears out removed
 * Book Club members who let their 7 days run out — one implementation, so
 * "deleted" means the same thing however it was reached.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    await deleteAccount(uid);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("account delete failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not delete your account." },
      { status: 500 }
    );
  }
}
