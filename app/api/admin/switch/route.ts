import { NextResponse } from "next/server";
import { getAdminAuth, getAuthedUser } from "@/lib/firebase/admin";
import { ADMIN_EMAIL, isAdminEmail, CHRISTOPHER_READER_UID } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Swaps the caller between the founder's admin login and his own reading
 * account — never anyone else's, in either direction.
 *
 * This mints a custom token for a fixed target uid, decided entirely from the
 * caller's own verified identity, never from anything the client sends:
 *
 *   - Signed in as the admin (checked by email, same as every other admin
 *     route) → a token for CHRISTOPHER_READER_UID, always that one uid.
 *   - Signed in as CHRISTOPHER_READER_UID itself → a token for whichever uid
 *     currently owns ADMIN_EMAIL, looked up fresh rather than hardcoded, so
 *     this keeps working if the admin account is ever recreated.
 *   - Anyone else → refused. There is no third direction: this is a private
 *     switch between exactly two accounts, not a general impersonation tool.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    let targetUid: string;
    if (isAdminEmail(caller.email)) {
      targetUid = CHRISTOPHER_READER_UID;
    } else if (caller.uid === CHRISTOPHER_READER_UID) {
      const adminUser = await getAdminAuth().getUserByEmail(ADMIN_EMAIL);
      targetUid = adminUser.uid;
    } else {
      return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    }

    const customToken = await getAdminAuth().createCustomToken(targetUid);
    return NextResponse.json({ customToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("admin switch failed:", error);
    return NextResponse.json({ error: error.message || "Could not switch accounts." }, { status: 500 });
  }
}
