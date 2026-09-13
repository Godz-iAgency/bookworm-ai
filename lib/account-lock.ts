import { randomUUID } from "node:crypto";
import { getAdminDb } from "./firebase/admin";
/** Cross-route exclusion for billing and deletion. A crashed operation stays
 * locked until its lease ends; Stripe idempotency handles uncertain retries.
 */
export async function withAccountLock<T>(uid: string, work: () => Promise<T>): Promise<T> {
  const db = getAdminDb();
  const ref = db.collection("accountOperations").doc(uid);
  const token = randomUUID();
  await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data();
    if (Number(old?.until ?? 0) > Date.now()) throw new Error("Another account operation is running. Please retry shortly.");
    tx.set(ref, { token, until: Date.now() + 300000 });
  });
  try { return await work(); }
  finally {
    await db.runTransaction(async tx => {
      if ((await tx.get(ref)).data()?.token === token) tx.delete(ref);
    });
  }
}
