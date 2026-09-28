const assert = require('node:assert/strict');

// The core funnel (Day 1 → card → paid → second book): the pure rules in
// lib/funnel.ts and the write-once milestone recording in
// lib/analytics-server.ts, against an in-memory Firestore.

const H = 3600_000;
const D = 24 * H;
const NOW = Date.parse('2026-09-27T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

function fakeDb() {
  const store = new Map();
  let writes = 0;
  const ref = (path) => ({
    path,
    collection: (name) => ({ doc: (id) => ref(`${path}/${name}/${id}`) }),
  });
  const snap = (path) => ({ exists: store.has(path), data: () => (store.has(path) ? { ...store.get(path) } : undefined) });
  const db = {
    store,
    get writes() { return writes; },
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        get: async (r) => snap(r.path),
        set: (r, data, opts) => pending.push(() => {
          store.set(r.path, opts && opts.merge ? { ...(store.get(r.path) || {}), ...data } : { ...data });
          writes++;
        }),
      };
      const out = await fn(tx);
      pending.forEach((w) => w());
      return out;
    },
  };
  return db;
}

function user(over = {}) {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    email: 'reader@example.com',
    signedUpAt: ago(20 * D),
    excluded: null,
    source: null,
    readingLevel: 'explorer',
    language: 'en',
    day1At: null,
    day1Via: null,
    cardAt: null,
    trialEndsAt: null,
    paidAt: null,
    refundedAt: null,
    firstBookAt: null,
    firstBookTitle: null,
    secondBookAt: null,
    secondBookTitle: null,
    distinctBooks: 0,
    ...over,
  };
}

module.exports = async function (load) {
  const funnel = load('lib/funnel.ts', {});
  const server = load('lib/analytics-server.ts', { './funnel': funnel });
  const { computeFunnel, distinctBooks, metricFor, previousRange, creatorBreakdown, cleanSourceCode } = funnel;
  const stage = (r, k) => r.stages.find((s) => s.key === k);
  // Values built inside the module sandbox carry its prototypes; copy them out.
  const ids = (list) => Array.from(list, (u) => u.id).sort();
  const plain = (o) => JSON.parse(JSON.stringify(o));
  const counts = (s) => [s.reached.length, s.dropped.length, s.pending.length];

  // ---- TEST 1: Day 1 is recorded exactly once ------------------------------
  {
    const db = fakeDb();
    db.store.set('users/u1/generatedCourses/course-1', { title: 'Atomic Habits', readingLevel: 'scholar', language: 'es' });
    db.store.set('users/u1/generatedCourses/course-2', { title: 'Deep Work' });
    const first = await server.recordDay1Activation(db, 'u1', 'course-1', new Date(NOW));
    assert.equal(first.recorded, true);
    // Refresh, double tap, retry, and a later book's Day 1: none of them move it.
    for (const id of ['course-1', 'course-1', 'course-2']) {
      assert.equal((await server.recordDay1Activation(db, 'u1', id, new Date(NOW + H))).reason, 'already');
    }
    const a = db.store.get('analyticsUsers/u1');
    assert.equal(a.day1ActivatedAt, new Date(NOW).toISOString());
    assert.equal(a.day1CourseId, 'course-1');
    assert.equal(a.day1ReadingLevel, 'scholar');
    assert.equal(a.day1Language, 'es');
    assert.equal(db.writes, 1);
    // A made-up course, or someone else's shared book, never activates.
    assert.equal((await server.recordDay1Activation(db, 'u2', 'course-1')).reason, 'unknown-course');
    assert.equal((await server.recordDay1Activation(db, 'u2', '../x')).reason, 'invalid');
    assert.equal((await server.recordDay1Activation(db, 'u2', 42)).reason, 'invalid');
    assert.equal(db.writes, 1);
  }

  // ---- TEST 2: card added / Day 2 unlocked -----------------------------------
  {
    const r = computeFunnel([
      user({ id: 'card', day1At: ago(10 * D), cardAt: ago(10 * D), trialEndsAt: ago(3 * D) }),
      user({ id: 'never-card', day1At: ago(3 * D) }),            // 72h > 48h window: a real no
      user({ id: 'deciding', day1At: ago(10 * H) }),             // still inside 48h: pending
      user({ id: 'no-day1', signedUpAt: ago(2 * D), cardAt: ago(2 * D) }), // card, Day 1 not recorded
    ], {}, NOW);
    assert.deepEqual(counts(stage(r, 'card')), [1, 1, 1]);
    assert.equal(stage(r, 'card').rate, 0.5);
    assert.equal(r.cardWithoutDay1.length, 1);
    assert.equal(r.cardWithoutDay1[0].id, 'no-day1');
  }

  // ---- TEST 3: paid only on Stripe's first real payment, once ----------------
  {
    const trialInvoice = { id: 'in_0', status: 'paid', amount_paid: 0, created: 100 };
    const failed = { id: 'in_1', status: 'open', amount_paid: 0, created: 200 };
    const requiresAction = { id: 'in_1b', status: 'open', amount_paid: 0, created: 210 };
    const paid = { id: 'in_2', status: 'paid', amount_paid: 999, created: 300, status_transitions: { paid_at: 320 } };
    assert.equal(server.firstPaidFields(undefined, trialInvoice, null, 100), null, '$0 trial invoice is not a payment');
    assert.equal(server.firstPaidFields(undefined, failed, null, 200), null, 'failed payment is not a payment');
    assert.equal(server.firstPaidFields(undefined, requiresAction, null, 210), null, 'payment needing action is not a payment');
    const fields = server.firstPaidFields(undefined, paid, 'pi_2', 300);
    assert.equal(fields.firstPaidAt, new Date(320 * 1000).toISOString());
    assert.equal(fields.firstPaidInvoice, 'in_2');
    assert.equal(fields.firstPaidAmount, 999);
    assert.equal(fields.firstPaidPaymentIntent, 'pi_2');
    // The same webhook delivered twice, or next month's renewal: nothing new.
    assert.equal(server.firstPaidFields(fields, paid, 'pi_2', 300), null);
    assert.equal(server.firstPaidFields(fields, { ...paid, id: 'in_3' }, 'pi_3', 400), null);

    assert.equal(server.paymentIntentOfInvoice({ payments: { data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_new' } }] } }), 'pi_new');
    assert.equal(server.paymentIntentOfInvoice({ payment_intent: 'pi_old' }), 'pi_old');
    assert.equal(server.paymentIntentOfInvoice({ payment_intent: { id: 'pi_obj' } }), 'pi_obj');
    assert.equal(server.paymentIntentOfInvoice({}), null);

    const r = computeFunnel([
      user({ id: 'paid', day1At: ago(12 * D), cardAt: ago(12 * D), trialEndsAt: ago(5 * D), paidAt: ago(5 * D) }),
      user({ id: 'cancelled', day1At: ago(12 * D), cardAt: ago(12 * D), trialEndsAt: ago(5 * D) }),
      user({ id: 'failed', day1At: ago(11 * D), cardAt: ago(11 * D), trialEndsAt: ago(4 * D) }),
      user({ id: 'refunded', day1At: ago(12 * D), cardAt: ago(12 * D), trialEndsAt: ago(5 * D), paidAt: ago(5 * D), refundedAt: ago(4 * D) }),
      user({ id: 'mid-trial', day1At: ago(D), cardAt: ago(D), trialEndsAt: new Date(NOW + 6 * D).toISOString() }),
      user({ id: 'just-ended', day1At: ago(8 * D), cardAt: ago(8 * D), trialEndsAt: ago(D) }), // Stripe retries still running
      user({ id: 'converted-early', day1At: ago(2 * D), cardAt: ago(2 * D), trialEndsAt: new Date(NOW + 5 * D).toISOString(), paidAt: ago(D) }),
    ], {}, NOW);
    const p = stage(r, 'paid');
    assert.deepEqual(ids(p.reached), ['converted-early', 'paid']);
    assert.deepEqual(ids(p.dropped), ['cancelled', 'failed', 'refunded']);
    assert.deepEqual(ids(p.pending), ['just-ended', 'mid-trial']);
    assert.equal(p.rate, 2 / 5);
  }

  // ---- Refunds ---------------------------------------------------------------
  {
    const db = fakeDb();
    db.store.set('analyticsUsers/u1', { firstPaidAt: ago(D), firstPaidPaymentIntent: 'pi_1' });
    assert.equal(await server.markFirstPaymentRefunded(db, 'u1', { payment_intent: 'pi_1', refunded: false, amount: 999, amount_refunded: 500 }), false, 'partial refund keeps the conversion');
    assert.equal(await server.markFirstPaymentRefunded(db, 'u1', { payment_intent: 'pi_other', refunded: true }), false, 'a later payment refunded is not the first one');
    assert.equal(await server.markFirstPaymentRefunded(db, 'u1', { payment_intent: 'pi_1', refunded: true }, new Date(NOW)), true);
    // The admin refund button and the charge.refunded webhook both report it.
    assert.equal(await server.markFirstPaymentRefunded(db, 'u1', { payment_intent: 'pi_1', refunded: true }), false);
    assert.equal(db.store.get('analyticsUsers/u1').paidRefundedAt, new Date(NOW).toISOString());
    assert.equal(await server.markFirstPaymentRefunded(db, 'nobody', { payment_intent: 'pi_1', refunded: true }), false);
  }

  // ---- TEST 4: second DISTINCT book ------------------------------------------
  {
    const books = distinctBooks([
      { id: 'c1', title: 'Atomic Habits', author: 'James Clear', at: ago(20 * D) },
      { id: 'c1', title: 'Atomic Habits', author: 'James Clear', at: ago(20 * D) },   // same record twice
      { id: 'c2', title: ' atomic  HABITS ', author: 'james clear', at: ago(15 * D) }, // same book regenerated
      { id: 'c3', title: '', author: '', at: ago(14 * D) },                              // broken record
      { id: 'c4', title: 'Deep Work', author: 'Cal Newport', at: ago(10 * D) },
      { id: 'c5', title: 'Essentialism', author: 'Greg McKeown', at: ago(5 * D) },
    ]);
    assert.deepEqual(Array.from(books, (b) => b.id), ['c1', 'c4', 'c5']);
    assert.equal(distinctBooks([]).length, 0);
    assert.equal(distinctBooks([{ id: 'x', title: 'Only', author: '', at: ago(D) }]).length, 1);

    const r = computeFunnel([
      user({ id: 'b2', day1At: ago(40 * D), cardAt: ago(40 * D), trialEndsAt: ago(33 * D), paidAt: ago(33 * D),
        firstBookAt: ago(40 * D), secondBookAt: ago(30 * D), firstBookTitle: 'A', secondBookTitle: 'B' }),
      user({ id: 'never-b2', day1At: ago(50 * D), cardAt: ago(50 * D), trialEndsAt: ago(43 * D), paidAt: ago(43 * D), firstBookAt: ago(50 * D) }),
      user({ id: 'new-payer', day1At: ago(12 * D), cardAt: ago(12 * D), trialEndsAt: ago(5 * D), paidAt: ago(5 * D), firstBookAt: ago(12 * D) }),
    ], {}, NOW);
    const b = stage(r, 'book2');
    assert.deepEqual(counts(b), [1, 1, 1]);
    assert.equal(b.rate, 0.5);
    assert.equal(r.medianDaysToBook2, 10);
    // Overall: 'b2' made it, 'never-b2' dropped for good, 'new-payer' is still open.
    assert.deepEqual(plain(r.overall), { reached: 1, resolved: 2, rate: 0.5 });
  }

  // ---- Cohorts, exclusions, day-1 window, OMTM, creators ---------------------
  {
    const users = [
      user({ id: 'old-active', signedUpAt: ago(20 * D), day1At: ago(20 * D), source: 'maya' }),
      user({ id: 'old-idle', signedUpAt: ago(20 * D), source: 'maya' }),
      user({ id: 'today-idle', signedUpAt: ago(2 * H), source: 'leo' }),   // under 24h: pending, not a miss
      user({ id: 'prev-a', signedUpAt: ago(45 * D), day1At: ago(45 * D), cardAt: ago(45 * D), trialEndsAt: ago(38 * D) }),
      user({ id: 'prev-b', signedUpAt: ago(45 * D), day1At: ago(45 * D) }),
      user({ id: 'admin', signedUpAt: ago(3 * D), excluded: 'admin', day1At: ago(3 * D) }),
      user({ id: 'comp', signedUpAt: ago(3 * D), excluded: 'complimentary' }),
    ];
    const last30 = { from: ago(30 * D) };
    const r = computeFunnel(users, last30, NOW);
    assert.equal(r.eligible.length, 3);
    assert.equal(r.excluded.length, 2);
    assert.deepEqual(counts(stage(r, 'day1')), [1, 1, 1]);
    assert.equal(stage(r, 'day1').rate, 0.5);

    const prevR = previousRange(last30, NOW);
    assert.equal(prevR.to, last30.from);
    assert.equal(Date.parse(prevR.from), NOW - 60 * D);
    assert.equal(previousRange({}, NOW), null, 'all time has no earlier period');
    const before = metricFor(computeFunnel(users, prevR, NOW), 'day1_to_card');
    assert.deepEqual(plain(before), { numerator: 1, denominator: 2, rate: 0.5, pending: 0 });
    const nowMetric = metricFor(r, 'day1_to_card');
    assert.deepEqual(plain(nowMetric), { numerator: 0, denominator: 1, rate: 0, pending: 0 });

    const maya = computeFunnel(users, { ...last30, source: 'maya' }, NOW);
    assert.equal(maya.eligible.length, 2);
    const direct = computeFunnel(users, { source: '' }, NOW);
    assert.deepEqual(ids(direct.eligible), ['prev-a', 'prev-b']);

    const rows = creatorBreakdown(users, last30, NOW);
    const mayaRow = rows.find((x) => x.source === 'maya');
    assert.equal(mayaRow.sent, 2);
    assert.equal(mayaRow.day1, 1);
    assert.equal(mayaRow.rates.day1, 0.5);
    assert.equal(rows.find((x) => x.source === 'leo').rates.day1, null, 'nobody from leo has had a full day yet');

    // Custom range end is exclusive.
    assert.equal(computeFunnel(users, { from: ago(46 * D), to: ago(44 * D) }, NOW).eligible.length, 2);
    assert.equal(computeFunnel(users, { from: ago(44 * D), to: ago(46 * D) }, NOW).eligible.length, 0);
  }

  // ---- Attribution: first touch, new accounts only ---------------------------
  {
    assert.equal(cleanSourceCode('  Maya_Reads-2 '), 'maya_reads-2');
    assert.equal(cleanSourceCode('<script>'), 'script');
    assert.equal(cleanSourceCode('!!!'), null);
    assert.equal(cleanSourceCode(null), null);
    assert.equal(cleanSourceCode('x'.repeat(80)).length, 40);

    const db = fakeDb();
    const created = ago(H);
    assert.equal((await server.recordAttribution(db, 'u1', { source: 'Maya', campaign: 'Fall' }, created, new Date(NOW))).recorded, true);
    assert.equal((await server.recordAttribution(db, 'u1', { source: 'leo' }, created, new Date(NOW))).reason, 'already');
    assert.deepEqual(plain(db.store.get('analyticsUsers/u1').attribution), { source: 'maya', campaign: 'fall', capturedAt: new Date(NOW).toISOString() });
    assert.equal((await server.recordAttribution(db, 'u2', { source: 'maya' }, ago(8 * D), new Date(NOW))).reason, 'account-too-old');
    assert.equal((await server.recordAttribution(db, 'u3', { source: '' }, created, new Date(NOW))).reason, 'invalid');
    assert.equal(db.writes, 1);
  }

  console.log('PASS: core funnel (Day 1 once, card window, Stripe-paid only with failures/refunds/duplicates ignored, distinct second book, cohort windows, OMTM comparison, creator attribution).');
};
