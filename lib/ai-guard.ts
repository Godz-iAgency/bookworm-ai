import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "./firebase/admin";
import { planFromId } from "./plans";

const requestBodies = new WeakMap<Request, any>();
export const aiAdmissions = new WeakMap<Request, boolean>();

/** Admission is durable and atomic, including concurrent requests on different servers.
 * Attempts count, including provider failures: refunding an uncertain timeout permits
 * unbounded spend. Free previews get three lifetime attempts; scans ten per UTC day.
 */
export async function guardAI(req: Request, kind: "course" | "study" | "chat" | "scan", reserve = true) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const raw = reserve ? await req.clone().text() : JSON.stringify(requestBodies.get(req) ?? null);
  if (raw.length > (kind === "scan" ? 2500000 : 60000)) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (reserve) requestBodies.set(req, body);
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const limitRef = ref.collection("aiUsage").doc(new Date().toISOString().slice(0,10));
  try {
    await db.runTransaction(async tx => {
      const p = (await tx.get(ref)).data();
      if (!p || p.accessOverride?.active === false || p.deletionPending) throw new Error("Access unavailable.");
      let family = false;
      if (p.familyId) {
        const f = (await tx.get(db.collection("families").doc(p.familyId))).data();
        family = f?.status === "active" && f?.memberIds?.includes(uid);
      }
      const trial = p.trialStatus === "active" && Date.parse(p.trialEndsAt) > Date.now();
      const paid = ["page_turner", "well_read", "book_club"].includes(p.plan) && p.trialStatus !== "active" && (!p.subscriptionCancelAt || Date.parse(p.subscriptionCancelAt) > Date.now());
      const override = p.accessOverride?.active ? p.accessOverride : null;
      const access = !!override || trial || paid || family;
      if (kind === "study" || kind === "chat") {
        if (typeof body.courseId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(body.courseId)) throw new Error("Missing course.");
        let course = (await tx.get(ref.collection("courses").doc(body.courseId))).data();
        // Not this reader's own course — could be a live view of a book a
        // fellow Book Club member shared. A share id is exactly the doc id
        // under families/{familyId}/sharedBooks, so this is a direct lookup,
        // never a guess: no pointer, no course, no access.
        let isSharedView = false;
        if (!course && p.familyId) {
          const share = (await tx.get(db.collection("families").doc(p.familyId).collection("sharedBooks").doc(body.courseId))).data();
          if (share) {
            course = (await tx.get(db.collection("users").doc(share.sharedByUid).collection("courses").doc(share.sourceCourseId))).data();
            isSharedView = true;
          }
        }
        if (!course || !(Date.parse(course.expiresAt) > Date.now()) || course.book?.title !== body.title || course.book?.author !== body.author) throw new Error("Course unavailable.");
        // Chat is fine — it never touches the book. Only actual generation
        // (a missing lesson/flashcards/axiom) is a member's to never trigger:
        // the sharer's book is read-only to everyone but them.
        if (isSharedView && kind === "study") throw new Error("Shared snapshots cannot be regenerated.");
      }
      if (kind !== "scan" && kind !== "course" && !access) throw new Error("An active plan is required.");
      if (!reserve) return; // Recheck revocation before delivering an in-flight result, without charging twice.
      const usage = (await tx.get(limitRef)).data() ?? {};
      const usageKey = kind === "chat" ? "chat_" + body.courseId : kind;
      const used = Number(usage[usageKey] ?? 0);
      const ceiling = kind === "scan" ? 10 : kind === "chat" ? 10 : 100;
      if (used >= ceiling) throw new Error("Daily request limit reached.");
      if (kind !== "scan" && kind !== "course" && !access) throw new Error("An active plan is required.");
      if (kind === "course") {
        aiAdmissions.set(req, access);
        if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 500) throw new Error("Invalid book title.");
        const shelf = await tx.get(ref.collection("courses"));
        const plan = planFromId(family ? "book_club" : p.plan);
        const max = override?.maxOpenBooks ?? plan.maxOpenBooks;
        if (shelf.docs.filter(d => !d.data().sharedFrom && Date.parse(d.data().expiresAt) > Date.now()).length >= max) throw new Error("Your library is full.");
        const cap = override ? override.lifetimeGenerations : trial ? 3 : plan.monthlyGenerations;
        if (access) {
          if (cap !== null && Number(p.generationsThisMonth ?? 0) >= cap) throw new Error("Generation limit reached.");
          tx.update(ref, { generationsThisMonth: Number(p.generationsThisMonth ?? 0) + 1 });
        } else {
          if (Number(p.previewAttempts ?? 0) >= 3) throw new Error("Preview limit reached. Choose a plan to continue.");
          tx.update(ref, { previewAttempts: Number(p.previewAttempts ?? 0) + 1 });
        }
      }
      tx.set(limitRef, { [usageKey]: used + 1 }, { merge: true });
    });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Access unavailable." }, { status: 403 }); }
  return null;
}
