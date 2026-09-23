import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { planFromId } from "@/lib/plans";
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { course } = await req.json();
    if (!course || typeof course.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(course.id) || course.sharedFrom || !Array.isArray(course.days) || course.days.length !== 7) return NextResponse.json({ error: "Invalid course." }, { status: 400 });
    const db = getAdminDb();
    await db.runTransaction(async tx => {
      const userRef = db.collection("users").doc(uid);
      const p = (await tx.get(userRef)).data();
      if (!p || p.accessOverride?.active === false || p.deletionPending) throw new Error("Access unavailable.");
      let family = false;
      if (p.familyId) { const f = (await tx.get(db.collection("families").doc(p.familyId))).data(); family = f?.status === "active" && f.memberIds?.includes(uid); }
      const trial = p.trialStatus === "active" && Date.parse(p.trialEndsAt) > Date.now();
      const paid = ["page_turner", "well_read", "book_club"].includes(p.plan) && p.trialStatus !== "active" && (!p.subscriptionCancelAt || Date.parse(p.subscriptionCancelAt) > Date.now());
      if (!p.accessOverride?.active && !trial && !paid && !family) throw new Error("An active plan is required.");
      const ref = userRef.collection("courses").doc(course.id);
      if ((await tx.get(ref)).exists) return;
      const ticketRef = userRef.collection("generatedCourses").doc(course.id);
      const ticket = (await tx.get(ticketRef)).data();
      if (!ticket || ticket.consumed || ticket.title !== course.book?.title || ticket.author !== course.book?.author || ticket.readingLevel !== course.readingLevel || (ticket.language ?? "en") !== (course.language ?? "en")) throw new Error("Generation not found.");
      const shelf = await tx.get(userRef.collection("courses"));
      const max = p.accessOverride?.active ? p.accessOverride.maxOpenBooks : planFromId(family ? "book_club" : p.plan).maxOpenBooks;
      if (shelf.docs.filter(d => !d.data().sharedFrom && Date.parse(d.data().expiresAt) > Date.now()).length >= max) throw new Error("Your library is full.");
      const expiresAt = new Date(Date.parse(ticket.createdAt) + 8 * 86400000).toISOString();
      if (Date.parse(expiresAt) <= Date.now()) throw new Error("Preview expired.");
      if (!ticket.charged) {
        const cap = p.accessOverride?.active ? p.accessOverride.lifetimeGenerations : trial ? 3 : planFromId(family ? "book_club" : p.plan).monthlyGenerations;
        if (cap !== null && Number(p.generationsThisMonth ?? 0) >= cap) throw new Error("Generation limit reached.");
        tx.update(userRef, { generationsThisMonth: Number(p.generationsThisMonth ?? 0) + 1 });
      }
      tx.create(ref, { ...course, expiresAt });
      tx.update(ticketRef, { consumed: true });
    });
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not save course." }, { status: 400 }); }
}
