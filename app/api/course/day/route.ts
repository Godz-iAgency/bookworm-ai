import { guardAI } from "@/lib/ai-guard";
import { NextResponse } from "next/server";
import { dayInputFromBody, generateDayContent } from "@/lib/day-generation";

// A 2,200+ word lesson, a possible expansion pass and the study aids, one
// after another. Needs Vercel Fluid Compute (300s on every plan).
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const denied = await guardAI(req, "study");
    if (denied) return denied;
    const input = dayInputFromBody(await req.json());
    if (!input) {
      return NextResponse.json({ error: "Missing day details." }, { status: 400 });
    }

    const content = await generateDayContent(input.ctx, input.day);

    const revoked = await guardAI(req, "study", false);
    if (revoked) return revoked;
    return NextResponse.json(content);
  } catch (error: any) {
    console.error("Day generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Day generation failed." },
      { status: 500 }
    );
  }
}
