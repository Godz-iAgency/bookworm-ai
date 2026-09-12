import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * Turns an access link into a signed-in session.
 *
 * Deliberately unauthenticated — the whole point is that the holder has no
 * account and types nothing. The token IS the credential, so the checks that
 * matter are all here: the link must exist, still be switched on, and point at
 * an account whose override is also still switched on. Flipping either off
 * from the admin dashboard kills the link on the next tap.
 *
 * Answers with a Firebase custom token, which the browser exchanges for a real
 * session via signInWithCustomToken.
 */
export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing link." }, { status: 400 });
    }

    const db = getAdminDb();
    const linkRef = db.collection("accessLinks").doc(token);
    const linkSnap = await linkRef.get();
    if (!linkSnap.exists) {
      return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
    }

    const link = linkSnap.data()!;
    if (!link.active) {
      return NextResponse.json({ error: "This link has been turned off." }, { status: 403 });
    }

    const userSnap = await db.collection("users").doc(link.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
    }
    // Belt and braces: the link and the account's own complimentary access are
    // separate switches, and either one being off means no entry.
    if (userSnap.data()?.accessOverride?.active !== true) {
      return NextResponse.json({ error: "This link has been turned off." }, { status: 403 });
    }

    const customToken = await getAdminAuth().createCustomToken(link.uid);

    // Best effort — a failed counter must never cost someone their sign-in.
    linkRef
      .update({ lastUsedAt: new Date().toISOString(), useCount: FieldValue.increment(1) })
      .catch((e) => console.error("Could not record access link use:", e));

    return NextResponse.json({ customToken });
  } catch (error: any) {
    console.error("access redeem failed:", error);
    return NextResponse.json({ error: error.message || "Could not open that link." }, { status: 500 });
  }
}
