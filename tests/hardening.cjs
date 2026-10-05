const assert = require('node:assert/strict');
const json = { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) };
function database(seed = {}) {
  const records = new Map(Object.entries(seed));
  let queue = Promise.resolve();
  const snapshot = ref => ({ ref, id: ref.id, exists: records.has(ref.path), data: () => records.get(ref.path) });
  const collection = path => ({ path, doc: id => reference(path + '/' + id),
    get: async () => query(path), where: (key, _op, value) => ({ limit: () => ({ get: async () => query(path, key, value) }), get: async () => query(path, key, value) }) });
  const query = (path, key, value) => {
    const docs = [...records.keys()].filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map(k => snapshot(reference(k))).filter(d => !key || d.data()[key] === value);
    return { docs, size: docs.length, empty: !docs.length };
  };
  const reference = path => ({ path, id: path.split('/').pop(), collection: sub => collection(path + '/' + sub),
    get: async () => snapshot(reference(path)), update: async patch => { records.set(path, {...records.get(path), ...patch}); },
    delete: async () => records.delete(path) });
  const db = { records, collection,
    runTransaction: fn => {
      const job = queue.catch(() => {}).then(async () => {
        const writes = []; let writing = false;
        const tx = { get: async ref => { assert.equal(writing, false, 'All Firestore reads must precede writes'); return ref.id ? snapshot(ref) : query(ref.path); },
          update: (ref, value) => { writing = true; writes.push(() => { assert.ok(records.has(ref.path)); records.set(ref.path, {...records.get(ref.path), ...value}); }); },
          set: (ref, value, opts) => { writing = true; writes.push(() => records.set(ref.path, {...(opts?.merge ? records.get(ref.path) : {}), ...value})); },
          create: (ref, value) => { writing = true; writes.push(() => { assert.ok(!records.has(ref.path)); records.set(ref.path, value); }); },
          delete: ref => { writing = true; writes.push(() => records.delete(ref.path)); },
        };
        const result = await fn(tx); for (const write of writes) write(); return result;
      }); queue = job; return job;
    }
  }; return db;
}
module.exports = async function(load) {
  const plans = load('lib/plans.ts', {});
  const adminLib = load('lib/admin.ts', {});
  const keys = load('lib/ai-keys.ts', {'node:async_hooks': require('node:async_hooks'), './admin': adminLib});
  const analyticsLib = load('lib/analytics-server.ts', {'./funnel': load('lib/funnel.ts', {})});
  const valid = load('lib/course-validation.ts', {'./lesson': load('lib/lesson.ts', {})});
  assert.equal(valid.validOutline({days: [null]}), false);
  assert.equal(valid.validDeck([{front:'x',back:null}]), false);
  const db = database({'users/u': {accessOverride: {active:true,lifetimeGenerations:1,maxOpenBooks:1}, generationsThisMonth:0}});
  let uid = null;
  const {guardAI} = load('lib/ai-guard.ts', {'next/server':{NextResponse:json}, './firebase/admin':{getUidFromRequest:async()=>uid,getAdminDb:()=>db}, './plans':plans, './ai-keys':keys});
  const req = () => new Request('http://local', {method:'POST',body:JSON.stringify({title:'Book',author:'Author'})});
  assert.equal((await guardAI(req(),'course')).status,401);
  uid='u';
  const raced=await Promise.all([guardAI(req(),'course'),guardAI(req(),'course')]);
  assert.equal(raced.filter(x=>x===null).length,1,'One remaining generation admits one concurrent request');
  assert.equal(db.records.get('users/u').generationsThisMonth,1);
  db.records.get("users/u").generationsThisMonth = 0;
  const pendingReq = req();
  assert.equal(await guardAI(pendingReq,"course"),null);
  assert.equal(await guardAI(pendingReq,'course',false),null);
  db.records.set('users/u',{plan:'well_read',accessOverride:{active:false}});
  assert.equal((await guardAI(pendingReq,'course',false)).status,403,'In-flight results recheck the kill switch without a second quota charge');
  assert.equal((await guardAI(req(),'course')).status,403,'Kill switch overrides a paid plan');
  db.records.set('users/u',{plan:'free',familyId:'stale'});
  db.records.set('users/u/courses/c',{book:{title:'Book',author:'Author'},expiresAt:'2099-01-01'});
  const study = new Request('http://local',{method:'POST',body:JSON.stringify({courseId:'c',title:'Book',author:'Author'})});
  assert.equal((await guardAI(study,'study')).status,403,'A stale family pointer grants nothing');

  // A book someone else shared: no course of this reader's own, resolved
  // instead through families/{familyId}/sharedBooks/{shareId} to the
  // sharer's real course. Chat is fine; generation never is.
  db.records.set('users/u',{plan:'free',familyId:'fam1'});
  db.records.set('families/fam1',{status:'active',memberIds:['u','owner']});
  db.records.set('users/owner/courses/real',{book:{title:'Shared Book',author:'Sharer'},expiresAt:'2099-01-01'});
  db.records.set('families/fam1/sharedBooks/owner_real',{sharedByUid:'owner',sourceCourseId:'real'});
  const sharedChat=new Request('http://local',{method:'POST',body:JSON.stringify({courseId:'owner_real',title:'Shared Book',author:'Sharer'})});
  assert.equal(await guardAI(sharedChat,'chat'),null,'Chat is allowed on a live-shared book');
  const sharedStudy=new Request('http://local',{method:'POST',body:JSON.stringify({courseId:'owner_real',title:'Shared Book',author:'Sharer'})});
  assert.equal((await guardAI(sharedStudy,'study')).status,403,'Generation stays blocked on a live-shared book');
  db.records.delete('families/fam1/sharedBooks/owner_real');
  const withdrawnChat=new Request('http://local',{method:'POST',body:JSON.stringify({courseId:'owner_real',title:'Shared Book',author:'Sharer'})});
  assert.equal((await guardAI(withdrawnChat,'chat')).status,403,'Withdrawing the share blocks even chat immediately');

  // Which Gemini key a request is admitted on: free for the founder's own
  // accounts and complimentary access, paid for everyone else.
  const CH = adminLib.CHRISTOPHER_READER_UID;
  const tierDb = database({
    'users/comp': {accessOverride:{active:true,lifetimeGenerations:5,maxOpenBooks:5},generationsThisMonth:0},
    'users/payer': {plan:'page_turner',trialStatus:'converted',generationsThisMonth:0},
    'users/preview': {plan:'free',generationsThisMonth:0,previewAttempts:0},
    ['users/'+CH]: {plan:'book_club',familyId:'chClub',generationsThisMonth:0},
    'users/son': {plan:'free',familyId:'chClub',generationsThisMonth:0},
    'users/guest': {plan:'free',familyId:'otherClub',generationsThisMonth:0},
    'families/chClub': {status:'active',ownerId:CH,memberIds:[CH,'son']},
    'families/otherClub': {status:'active',ownerId:'stranger',memberIds:['stranger','guest']},
  });
  const tierOf = async (who, kind = 'scan') => {
    const {guardAI: guard} = load('lib/ai-guard.ts', {'next/server':{NextResponse:json}, './firebase/admin':{getUidFromRequest:async()=>who,getAdminDb:()=>tierDb}, './plans':plans, './ai-keys':keys});
    const r = new Request('http://local', {method:'POST',body:JSON.stringify({title:'Book',author:'Author'})});
    assert.equal(await guard(r, kind), null, who + ' is admitted');
    return keys.keyTierOfRequest(r);
  };
  assert.equal(await tierOf('comp', 'course'), 'free', 'Complimentary access uses the free key');
  assert.equal(await tierOf(CH), 'free', "The founder's own account uses the free key");
  assert.equal(await tierOf('son'), 'free', "A member of the founder's Book Club uses the free key");
  assert.equal(await tierOf('payer'), 'paid', 'A paying reader uses the paid key');
  assert.equal(await tierOf('preview'), 'paid', 'A reader still deciding at the preview uses the paid key');
  assert.equal(await tierOf('guest'), 'paid', "Somebody else's Book Club uses the paid key");
  assert.equal(keys.keyTierOfRequest(new Request('http://local')), 'paid', 'An unadmitted request defaults to the paid key');

  const auth = {currentUser:{uid:'u',getIdToken:async()=> 'token'}};
  let finish;
  const {aiFetch}=load('lib/ai-fetch.ts', {'./firebase/config':{auth}}, {fetch:()=>new Promise(r=>finish=r)});
  const request=aiFetch('/test',{}); for(let i=0;i<10 && !finish;i++) await Promise.resolve(); auth.currentUser={uid:'other'}; finish({ok:true});
  await assert.rejects(request,/Account changed/);

  let refunds=[];let caller={uid:'admin',email:'admin'};
  const paydb=database({'users/u':{stripeCustomerId:'cus_ours'}});
  const {POST:payments}=load('app/api/admin/payments/route.ts', {'next/server':{NextResponse:json},'@/lib/firebase/admin':{getAuthedUser:async()=>caller,getAdminDb:()=>paydb},'@/lib/admin':{isAdminEmail:e=>e==='admin'},'@/lib/analytics-server':analyticsLib,'@/lib/stripe/server':{getStripe:()=>({charges:{retrieve:async id=>({id,customer:id==='foreign'?'cus_foreign':'cus_ours',status:'succeeded',amount:100,amount_refunded:0})},refunds:{create:async(body,opts)=>{refunds.push(opts.idempotencyKey);return {id:'re_1',amount:100,currency:'usd'};}}})}});
  const refund=id=>({json:async()=>({action:'refund',chargeId:id})});
  assert.equal((await payments(refund('foreign'))).status,400);
  await Promise.all([payments(refund('ch_ours')),payments(refund('ch_ours'))]);
  assert.equal(new Set(refunds).size,1,'Concurrent retries share the Stripe idempotency key');
  caller=null; assert.equal((await payments(refund('ch_ours'))).status,401);
  assert.equal(refunds.length,2);

  // Guest links: anyone who opens one gets their own account with one book.
  {
    const access = load('lib/access.ts', {});
    const TOKEN = 'guesttokenguesttoken1';
    const today = new Date().toISOString().slice(0, 10);
    const gdb = database({
      ['accessLinks/' + TOKEN]: {kind: 'guest', label: 'Partner outreach', active: true, useCount: 0, guestCount: 0, maxGuests: 2, dailyDate: null, dailyCount: 0},
      'accessLinks/bookclubtokenbookclub1': {uid: 'club', label: 'Book Club', active: true, useCount: 0},
      'users/club': {accessOverride: {active: true, lifetimeGenerations: null, maxOpenBooks: 5}},
    });
    let caller = null; let created = 0; let failCreate = false; const deleted = [];
    const fieldValue = {serverTimestamp: () => 'TS', increment: n => ({increment: n})};
    const {POST: redeem} = load('app/api/access/redeem/route.ts', {'next/server': {NextResponse: json}, 'firebase-admin/firestore': {FieldValue: fieldValue}, '@/lib/access': access,
      '@/lib/firebase/admin': {getAdminDb: () => gdb, getAuthedUser: async () => caller, getAdminAuth: () => ({
        createUser: async () => { if (failCreate) throw Error('auth down'); return {uid: 'guest' + (++created)}; },
        createCustomToken: async uid => 'token-for-' + uid,
        deleteUser: async uid => { deleted.push(uid); }})}});
    const open = (tok = TOKEN) => redeem({json: async () => ({token: tok})});

    const first = await open();
    assert.equal(first.status, 200);
    assert.equal(first.body.customToken, 'token-for-guest1');
    const guest1 = gdb.records.get('users/guest1');
    assert.equal(guest1.accessOverride.active, true);
    assert.equal(guest1.accessOverride.lifetimeGenerations, 1, 'A guest gets exactly one book');
    assert.equal(guest1.accessOverride.maxOpenBooks, 1);
    assert.equal(guest1.accessOverride.label, 'Partner outreach');
    assert.equal(guest1.email, null);
    assert.equal(guest1.plan, 'free');
    assert.equal(gdb.records.get('accessGuests/guest1').token, TOKEN, 'The guest is tied to the link that made it');
    assert.equal(gdb.records.get('accessLinks/' + TOKEN).guestCount, 1);

    const second = await open();
    assert.equal(second.body.customToken, 'token-for-guest2', 'Each visitor gets an account of their own');
    const full = await open();
    assert.equal(full.status, 429, 'A link stops at its limit');
    assert.ok(/reached its limit/.test(full.body.error));
    assert.equal(created, 2, 'A full link creates nothing');
    assert.equal(gdb.records.get('accessLinks/' + TOKEN).guestCount, 2);

    // Coming back on the same device picks the same guest up again.
    caller = {uid: 'guest1', email: null};
    const back = await open();
    assert.deepEqual({...back.body}, {resume: true});
    assert.equal(created, 2, 'Returning never makes a second guest');
    // ...until the one book is written and its week is over.
    gdb.records.get('users/guest1').generationsThisMonth = 1;
    gdb.records.set('users/guest1/courses/c1', {expiresAt: new Date(Date.now() + 3 * 86400000).toISOString()});
    assert.deepEqual({...(await open()).body}, {resume: true}, 'Mid-week the guest keeps reading');
    gdb.records.set('users/guest1/courses/c1', {expiresAt: new Date(Date.now() - 1000).toISOString()});
    assert.deepEqual({...(await open()).body}, {ended: true}, 'After the week the link has nothing left to give');
    // A real account is never swapped for a guest.
    caller = {uid: 'someone-real', email: 'real@example.com'};
    assert.equal((await open()).status, 409);
    caller = null;

    // Daily cap, and the day rolling over.
    gdb.records.set('accessLinks/busytokenbusytoken12', {kind: 'guest', label: 'Busy', active: true, useCount: 0, guestCount: 5, maxGuests: 100, dailyDate: today, dailyCount: access.GUEST_LINK_DAILY_LIMIT});
    const busy = await open('busytokenbusytoken12');
    assert.equal(busy.status, 429);
    assert.ok(/tomorrow/.test(busy.body.error));
    gdb.records.get('accessLinks/busytokenbusytoken12').dailyDate = '2000-01-01';
    assert.equal((await open('busytokenbusytoken12')).status, 200, 'A new day starts the count again');
    assert.equal(gdb.records.get('accessLinks/busytokenbusytoken12').dailyCount, 1);

    // A failed sign-up gives the place back and leaves nothing behind.
    gdb.records.set('accessLinks/failtokenfailtoken123', {kind: 'guest', label: 'Fail', active: true, useCount: 0, guestCount: 0, maxGuests: 5, dailyDate: null, dailyCount: 0});
    failCreate = true;
    assert.equal((await open('failtokenfailtoken123')).status, 500);
    failCreate = false;
    assert.equal(gdb.records.get('accessLinks/failtokenfailtoken123').guestCount, 0, 'The place is returned');

    // Off means off, for guests and for the Book Club link alike.
    gdb.records.get('accessLinks/' + TOKEN).active = false;
    assert.equal((await open()).status, 403);
    const club = await open('bookclubtokenbookclub1');
    assert.equal(club.body.customToken, 'token-for-club', 'The Book Club link still signs in as its own account');
    assert.equal((await open('nopenopenopenopenope')).status, 404);

    // The admin side: create, list, and switch a whole link (and its guests) off.
    let who = {uid: 'admin', email: 'admin'};
    const batches = [];
    const adb = {
      collection: c => ({
        doc: id => ({path: c + '/' + id, id, get: async () => ({exists: gdb.records.has(c + '/' + id), data: () => gdb.records.get(c + '/' + id)}), set: async v => { gdb.records.set(c + '/' + id, v); }}),
        orderBy: () => ({get: async () => ({docs: [...gdb.records.keys()].filter(k => k.startsWith('accessLinks/')).map(k => ({id: k.split('/')[1], data: () => gdb.records.get(k)}))})}),
        where: (_f, _o, v) => ({get: async () => ({docs: [...gdb.records.keys()].filter(k => k.startsWith('accessGuests/') && gdb.records.get(k).token === v).map(k => ({id: k.split('/')[1]}))})}),
      }),
      batch: () => { const w = []; return {update: (r, v) => w.push(() => { const cur = gdb.records.get(r.path) || {}; gdb.records.set(r.path, {...cur, ...v}); }), commit: async () => { w.forEach(f => f()); }}; },
    };
    const {POST: links} = load('app/api/admin/links/route.ts', {'node:crypto': require('node:crypto'), 'next/server': {NextResponse: json}, '@/lib/firebase/admin': {getAuthedUser: async () => who, getAdminDb: () => adb}, '@/lib/admin': {isAdminEmail: e => e === 'admin'}, '@/lib/access': access});
    const make = body => ({json: async () => body});
    const made = await links(make({action: 'create', label: '  Podcast outreach ', maxGuests: 25}));
    assert.equal(made.status, 200);
    const created2 = made.body.links.find(l => l.label === 'Podcast outreach');
    assert.ok(/^[A-Za-z0-9_-]{32}$/.test(created2.token), 'The token is long, random and accepted by the redeem route');
    assert.equal(created2.kind, 'guest');
    assert.equal(created2.maxGuests, 25);
    assert.equal(created2.guestCount, 0);
    assert.equal(gdb.records.get('accessLinks/' + created2.token).active, true);
    assert.ok(made.body.links.some(l => l.kind === 'account' && l.uid === 'club'), 'The Book Club link is listed unchanged');
    for (const bad of [{label: '', maxGuests: 10}, {label: 'x'.repeat(61), maxGuests: 10}, {label: 'Ok', maxGuests: 0}, {label: 'Ok', maxGuests: access.GUEST_LINK_MAX_GUESTS + 1}, {label: 'Ok', maxGuests: 2.5}, {label: 'Ok', maxGuests: null}, {label: 5, maxGuests: 10}]) {
      assert.equal((await links(make({action: 'create', ...bad}))).status, 400);
    }
    // Switching a guest link off locks out the people already signed in through it.
    gdb.records.get('accessLinks/' + TOKEN).active = true;
    gdb.records.set('users/guest1', {accessOverride: {active: true}});
    gdb.records.set('users/guest2', {accessOverride: {active: true}});
    gdb.records.set('accessGuests/guest3', {token: 'a-different-link'});
    gdb.records.set('users/guest3', {accessOverride: {active: true}});
    assert.equal((await links(make({action: 'toggle', token: TOKEN, active: false}))).status, 200);
    assert.equal(gdb.records.get('accessLinks/' + TOKEN).active, false);
    assert.equal(gdb.records.get('users/guest1')['accessOverride.active'], false);
    assert.equal(gdb.records.get('users/guest2')['accessOverride.active'], false);
    assert.equal(gdb.records.get('users/guest3').accessOverride.active, true, 'Only that link\'s guests are affected');
    // Renaming keeps the URL and renames the plan its readers already see.
    assert.equal((await links(make({action: 'rename', token: TOKEN, label: ' Guest Pass '}))).status, 200);
    assert.equal(gdb.records.get('accessLinks/' + TOKEN).label, 'Guest Pass');
    assert.equal(gdb.records.get('users/guest1')['accessOverride.label'], 'Guest Pass');
    assert.equal(gdb.records.get('users/guest2')['accessOverride.label'], 'Guest Pass');
    assert.equal(gdb.records.get('users/guest3')['accessOverride.label'], undefined, 'Only that link\'s guests are renamed');
    assert.equal((await links(make({action: 'rename', token: 'bookclubtokenbookclub1', label: 'Family'}))).status, 200);
    assert.equal(gdb.records.get('users/club')['accessOverride.label'], 'Family', 'A one-account link renames its account\'s plan');
    for (const bad of [{token: TOKEN, label: ''}, {token: TOKEN, label: 'x'.repeat(61)}, {token: TOKEN, label: 5}, {label: 'No token'}]) {
      assert.equal((await links(make({action: 'rename', ...bad}))).status, 400);
    }
    assert.equal((await links(make({action: 'rename', token: 'nopenopenopenopenope', label: 'Gone'}))).status, 404);
    who = {uid: 'someone', email: 'other'};
    assert.equal((await links(make({action: 'rename', token: TOKEN, label: 'Hijack'}))).status, 403);
    assert.equal((await links(make({action: 'create', label: 'Nope', maxGuests: 10}))).status, 403);
    who = null;
    assert.equal((await links(make({action: 'list'}))).status, 401);
  }

  {
    // A club owned by a free account has no Stripe invoice, so its members' months run on a clock.
    const NOW = Date.parse('2026-10-05T12:00:00Z');
    const day = n => new Date(NOW + n * 86400000).toISOString();
    const cdb = database({
      'families/free': {status: 'active', ownerId: 'owner', memberIds: ['owner', 'hudson', 'travis', 'late']},
      'users/owner': {accessOverride: {active: true, lifetimeGenerations: null, maxOpenBooks: 5}, familyId: 'free', isFamilyOwner: true, generationsThisMonth: 9},
      'users/hudson': {accessOverride: {active: true, lifetimeGenerations: null, maxOpenBooks: 5}, familyId: 'free', generationsThisMonth: 4},
      'users/travis': {plan: 'free', familyId: 'free', generationsThisMonth: 10},
      'users/late': {plan: 'free', familyId: 'free', generationsThisMonth: 7, monthResetAt: day(-1)},
      'families/paid': {status: 'active', ownerId: 'payer', memberIds: ['payer', 'guest']},
      'users/payer': {plan: 'book_club', familyId: 'paid', isFamilyOwner: true, stripeSubscriptionId: 'sub_1'},
      'users/guest': {plan: 'free', familyId: 'paid', generationsThisMonth: 10, monthResetAt: day(-1)},
    });
    const {rollFreeClubMonths} = load('lib/club-months.ts', {});
    assert.deepEqual({...await rollFreeClubMonths(cdb, NOW)}, {started: 1, reset: 1});
    assert.equal(cdb.records.get('users/travis').generationsThisMonth, 10, 'The first month starts with the count as it is');
    assert.equal(cdb.records.get('users/travis').monthResetAt, day(30));
    assert.equal(cdb.records.get('users/late').generationsThisMonth, 0, 'A month that has ended starts again from zero');
    assert.equal(cdb.records.get('users/late').monthResetAt, day(30));
    assert.equal(cdb.records.get('users/hudson').generationsThisMonth, 4, 'A comped member is never touched');
    assert.equal(cdb.records.get('users/owner').generationsThisMonth, 9, 'The owner is never touched');
    assert.equal(cdb.records.get('users/guest').generationsThisMonth, 10, 'A club with a paying owner stays on Stripe\'s reset');
    assert.deepEqual({...await rollFreeClubMonths(cdb, NOW + 86400000)}, {started: 0, reset: 0}, 'Nothing changes before the month is up');
    assert.deepEqual({...await rollFreeClubMonths(cdb, NOW + 31 * 86400000)}, {started: 0, reset: 2}, 'Everyone eligible rolls over once it is');
    assert.equal(cdb.records.get('users/travis').generationsThisMonth, 0);
  }

  {
    // French or Spanish that lost its accents and apostrophes is a bad lesson, not a finished one.
    const {spellingProblem} = load('lib/lesson.ts', {});
    const fr = "Aujourd'hui, nous allons voir pourquoi l'identité compte plus que les résultats. C'est déjà là, à côté de vous, et ça change très vite. ";
    const frBroken = 'Aujourd hui nous allons voir pourquoi l identite compte plus que les resultats. C est deja la a cote de vous et ca change tres vite. ';
    const es = 'Hoy aprenderás por qué los hábitos pequeños cambian tu identidad. ¿Cómo empezar? Con un sistema diario, una acción mínima y mucha paciencia. ';
    const esBroken = 'Hoy aprenderas por que los habitos pequenos cambian tu identidad. Como empezar? Con un sistema diario, una accion minima y mucha paciencia. ';
    const long = s => s.repeat(40);
    assert.equal(spellingProblem(long(fr), 'fr'), null, 'Real French passes');
    assert.ok(spellingProblem(long(frBroken), 'fr'), 'French without accents or apostrophes is rejected');
    assert.ok(spellingProblem(long(fr.replace(/['’]/g, ' ')), 'fr'), 'French without apostrophes alone is rejected');
    assert.equal(spellingProblem(long(es), 'es'), null, 'Real Spanish passes');
    assert.ok(spellingProblem(long(esBroken), 'es'), 'Spanish without accents is rejected');
    assert.equal(spellingProblem(long(esBroken), 'en'), null, 'English is never judged on accents');
    assert.equal(spellingProblem(frBroken, 'fr'), null, 'A short text says too little to judge');
  }

  {
    // A search answers with the English edition, not the translation Google ranked first.
    const {pickVolume, cleanDescription} = load('lib/google-books.ts', {});
    assert.equal(cleanDescription('***COMING SOON - PREORDER NOW*** The <b>phenomenal</b> bestseller.'), 'The phenomenal bestseller.');
    assert.equal(cleanDescription(undefined), 'No description available.');
    assert.equal(cleanDescription('   '), 'No description available.');
    assert.equal(cleanDescription('word '.repeat(60)).length, 152, 'Long blurbs are cut near 150 characters with an ellipsis');
    const v = (title, language, ...authors) => ({volumeInfo: {title, language, authors}});
    const tamil = v('Atomic Habits (Tamil)', 'ta', 'James Clear');
    const english = v('Atomic Habits', 'en', 'James Clear');
    const Q = 'Atomic Habits James Clear';
    assert.equal(pickVolume([tamil, v('Habit Stacking', 'en', 'S.J. Scott'), english], Q), english, 'The English edition beats a translation');
    assert.equal(pickVolume([english, tamil], Q), english, 'An English first result stays first');
    assert.equal(pickVolume([tamil, v('The Atomic Habits Workbook', 'en', 'James Clear'), english], Q), english, 'A companion book by the same author is not the book asked for');
    const tamilScript = v('அணு பழக்கங்கள்', 'ta', 'ஜேம்ஸ் க்ளியர்');
    assert.equal(pickVolume([tamilScript, english], Q), english, 'An author in another script: the title decides');
    const spanish = v('Hábitos atómicos', 'es', 'James Clear');
    assert.equal(pickVolume([spanish, english], 'Hábitos atómicos'), spanish, 'A title typed in Spanish keeps the Spanish edition');
    const cien = v('Cien años de soledad', 'es', 'Gabriel García Márquez');
    assert.equal(pickVolume([cien, v('Love in the Time of Cholera', 'en', 'Gabriel Garcia Marquez')], 'Cien años de soledad'), cien, 'Same author alone never swaps in a different book');
    assert.equal(pickVolume([spanish, v('Habit Stacking', 'en', 'S.J. Scott')], 'Habit Stacking Habitos'), spanish, "Another author's English book never replaces the match");
    assert.equal(pickVolume([spanish, tamil], Q), spanish, "No English edition: Google's first answer stands");
  }

  const deldb=database({'users/u':{stripeSubscriptionId:'sub_1'}});let authDeletes=0;
  const {deleteAccount}=load('lib/account-delete.ts', {'./account-lock':{withAccountLock:async(_uid,work)=>work()},'firebase-admin/firestore':{FieldValue:{}},'./stripe/server':{getStripe:()=>({subscriptions:{cancel:async()=>{throw Error('Stripe unavailable')}}})},'./firebase/admin':{getAdminDb:()=>deldb,getAdminAuth:()=>({deleteUser:async()=>authDeletes++})},'./family-server':{dissolveClub:async()=>{}}});
  await assert.rejects(deleteAccount('u'),/Stripe unavailable/);
  assert.equal(authDeletes,0);assert.ok(deldb.records.has('users/u'));

  const savedb=database({'users/u':{accessOverride:{active:true,lifetimeGenerations:null,maxOpenBooks:1},generationsThisMonth:0}});
  for(const id of ['a','b']) savedb.records.set('users/u/generatedCourses/'+id,{title:'Book',author:'Author',readingLevel:'scholar',createdAt:new Date().toISOString(),charged:true});
  const {POST:save}=load('app/api/course/save/route.ts',{'next/server':{NextResponse:json},'@/lib/firebase/admin':{getUidFromRequest:async()=> 'u',getAdminDb:()=>savedb},'@/lib/plans':plans});
  const course=id=>({id,book:{title:'Book',author:'Author'},readingLevel:'scholar',days:Array(7).fill({}),expiresAt:'2099-01-01'});
  const saveResults=await Promise.all(['a','b'].map(id=>save({json:async()=>({course:course(id)})})));
  assert.equal(saveResults.filter(r=>r.status===200).length,1,'Concurrent saves cannot exceed the shelf cap');
  const savedId=savedb.records.has('users/u/courses/a')?'a':'b';
  assert.equal((await save({json:async()=>({course:course(savedId)})})).status,200,'Retrying a save is idempotent');

  // Output language is bound to the generation ticket the same way reading
  // level is: a course cannot claim a language the generation was not run in.
  const langdb=database({'users/u':{accessOverride:{active:true,lifetimeGenerations:null,maxOpenBooks:5},generationsThisMonth:0}});
  langdb.records.set('users/u/generatedCourses/es1',{title:'Book',author:'Author',readingLevel:'scholar',language:'es',createdAt:new Date().toISOString(),charged:true});
  langdb.records.set('users/u/generatedCourses/leg',{title:'Book',author:'Author',readingLevel:'scholar',createdAt:new Date().toISOString(),charged:true});
  const {POST:saveLang}=load('app/api/course/save/route.ts',{'next/server':{NextResponse:json},'@/lib/firebase/admin':{getUidFromRequest:async()=> 'u',getAdminDb:()=>langdb},'@/lib/plans':plans});
  const langCourse=(id,language)=>({id,book:{title:'Book',author:'Author'},readingLevel:'scholar',...(language?{language}:{}),days:Array(7).fill({}),expiresAt:'2099-01-01'});
  assert.equal((await saveLang({json:async()=>({course:langCourse('es1','fr')})})).status,400,'A course cannot claim a language its generation did not use');
  assert.equal((await saveLang({json:async()=>({course:langCourse('es1','es')})})).status,200,'The generated language saves');
  assert.equal((await saveLang({json:async()=>({course:langCourse('leg')})})).status,200,'A ticket predating languages still saves as English');

  const clubdb=database({'users/u':{familyId:'f'},'families/f':{status:'active',ownerId:'u',memberIds:['u']},'families/f/sharedBooks/u_c':{sharedByUid:'u',sharedByName:'Reader',sourceCourseId:'c',sharedAt:'2020-01-01'},'users/u/courses/c':{book:{title:'Book',author:'Author'},readingLevel:'scholar',days:[{dayNumber:1,lesson:'L1'}],expiresAt:'2099-01-01'}});
  const clubHelpers={requireClub:async()=>({familyId:'f',memberIds:['u']}),clubError:(status,message)=>Object.assign(Error(message),{httpStatus:status}),statusOf:e=>e.httpStatus??500};
  const clubMocks={'next/server':{NextResponse:json},'@/lib/firebase/admin':{getUidFromRequest:async()=> 'u',getAdminDb:()=>clubdb},'@/lib/family-server':clubHelpers};
  const {POST:open}=load('app/api/family/open-shared/route.ts',clubMocks);
  const {POST:unshare}=load('app/api/family/unshare/route.ts',clubMocks);
  const shareReq={json:async()=>({shareId:'u_c'})};
  const opened=await open(shareReq);
  assert.equal(opened.body.sharedByUid,'u');
  assert.equal(opened.body.sourceCourseId,'c');
  assert.equal(clubdb.records.has('users/u/courses/u_c'),false,'Opening a share never creates a copy of it');
  // The sharer generates another day; a reader who resolves the share again
  // sees it purely by reading the sharer's own course live — nothing to redo.
  clubdb.records.get('users/u/courses/c').days.push({dayNumber:2,lesson:'L2'});
  assert.equal((await open(shareReq)).body.sourceCourseId,'c');
  assert.equal((await unshare(shareReq)).status,200);
  assert.equal(clubdb.records.has('families/f/sharedBooks/u_c'),false,'Unsharing deletes the pointer');
  assert.equal((await open(shareReq)).status,404,'A withdrawn share cannot be opened');

  let event={id:'evt_1',created:100,type:'invoice.payment_succeeded',data:{object:{id:'in_1',parent:{subscription_details:{subscription:'sub_1'}},status:'paid',billing_reason:'subscription_cycle',lines:{data:[{period:{end:200}}]}}}};
  const webhookdb=database({'users/u':{stripeCustomerId:'cus_1',stripeSubscriptionId:'sub_1',generationsThisMonth:8}});
  const {POST:webhook}=load('app/api/stripe/webhook/route.ts',{'next/server':{NextResponse:json},'stripe':{},'@/lib/account-lock':{withAccountLock:async(_uid,fn)=>fn()},'@/lib/firebase/admin':{getAdminDb:()=>webhookdb},'@/lib/family-server':{dissolveClub:async()=>{}},'@/lib/analytics-server':analyticsLib,'@/lib/stripe/server':{planForPriceId:()=> 'page_turner',getStripe:()=>({webhooks:{constructEvent:()=>event},invoices:{retrieve:async()=>({payments:{data:[{status:'paid',payment:{type:'payment_intent',payment_intent:'pi_first'}}]}})},subscriptions:{retrieve:async()=>({id:'sub_1',customer:'cus_1',status:'active',items:{data:[{price:{id:'price_1'},current_period_end:200}]}})}})}},{process:{env:{STRIPE_WEBHOOK_SECRET:'test'}}});
  const eventReq={text:async()=>'',headers:{get:()=>''}};
  assert.equal((await webhook(eventReq)).status,200);
  assert.equal(webhookdb.records.get('users/u').generationsThisMonth,0);
  webhookdb.records.get('users/u').generationsThisMonth=2;
  await webhook(eventReq);
  assert.equal(webhookdb.records.get('users/u').generationsThisMonth,2,'Invoice replay preserves usage');
  event={...event,id:'evt_2',created:90};await webhook(eventReq);
  assert.equal(webhookdb.records.get('users/u').generationsThisMonth,2,'Out-of-order same-period event cannot reset quota');
  event={...event,id:'evt_old_period',data:{object:{...event.data.object,lines:{data:[{period:{end:150}}]}}}};
  await webhook(eventReq);
  assert.equal(webhookdb.records.get('users/u').generationsThisMonth,2,'An old invoice cannot reset the current period');
  assert.equal(webhookdb.records.has('analyticsUsers/u'),false,'A $0 invoice is not a paid conversion');

  // Funnel: the first real payment is recorded once, whatever Stripe resends.
  event={id:'evt_paid',created:300,type:'invoice.payment_succeeded',data:{object:{id:'in_paid',parent:{subscription_details:{subscription:'sub_1'}},status:'paid',amount_paid:999,status_transitions:{paid_at:310},billing_reason:'subscription_cycle',lines:{data:[{period:{end:400}}]}}}};
  assert.equal((await webhook(eventReq)).status,200);
  const firstPaid={...webhookdb.records.get('analyticsUsers/u')};
  assert.equal(firstPaid.firstPaidAt,new Date(310000).toISOString());
  assert.equal(firstPaid.firstPaidPaymentIntent,'pi_first');
  await webhook(eventReq);
  event={...event,id:'evt_renewal',created:500,data:{object:{...event.data.object,id:'in_renewal',status_transitions:{paid_at:510},lines:{data:[{period:{end:600}}]}}}};
  await webhook(eventReq);
  assert.deepEqual(webhookdb.records.get('analyticsUsers/u'),firstPaid,'Duplicate deliveries and renewals never move the first payment');
  event={id:'evt_refund',created:700,type:'charge.refunded',data:{object:{customer:'cus_1',payment_intent:'pi_first',refunded:true,amount:999,amount_refunded:999}}};
  assert.equal((await webhook(eventReq)).status,200);
  assert.equal(webhookdb.records.get('analyticsUsers/u').paidRefundedAt,new Date(700000).toISOString(),'A full refund of the first payment undoes the conversion');
  deldb.records.set('users/u',{bookClubDeleteAt:'2000-01-01',accessOverride:{active:false}});
  assert.equal(await deleteAccount('u',true),false,'Even a disabled complimentary account is protected from automatic deletion');
  deldb.records.set('users/u',{bookClubDeleteAt:'2000-01-01',familyId:'new_club'});
  assert.equal(await deleteAccount('u',true),false,'A rejoined member is protected under the deletion lock');
  const progressdb=database({'users/u':{booksFinished:0},'users/u/courses/c':{status:'active',days:Array.from({length:7},(_,i)=>({dayNumber:i+1,isCompleted:i<6,isUnlocked:true}))}});
  const progressMocks={doc:(_db,...parts)=>progressdb.collection(parts.slice(0,-1).join('/')).doc(parts.at(-1)),getDoc:async()=>{},setDoc:async()=>{},runTransaction:(_db,fn)=>progressdb.runTransaction(tx=>fn({...tx,get:async ref=>{const s=await tx.get(ref);return {...s,exists:()=>s.exists};}}))};
  const {recordDayCompletion,persistBackfill}=load('lib/firebase/progress.ts',{'firebase/firestore':progressMocks,'./config':{db:progressdb}});
  await Promise.all([recordDayCompletion('u',{courseId:'c',dayLevel:7,finishedBook:true}),recordDayCompletion('u',{courseId:'c',dayLevel:7,finishedBook:true})]);
  assert.equal(progressdb.records.get('users/u').booksFinished,1,'Two completion paths count the book only once');
  await persistBackfill('u',{booksFinished:0,badges:[],streakCount:0,lastActivityDate:null});
  assert.equal(progressdb.records.get('users/u').booksFinished,1,'Stale backfill never lowers the finished count');
  console.log('PASS: duplicate completion, stale backfill, protected scheduled deletion, old-period invoice, first payment recorded once, refund undoes conversion, guest links give each visitor one book, with daily and total caps.');
  console.log('PASS: atomic shelf cap/idempotent save, output language bound to its generation ticket, share resolves without copying, withdrawal blocks reopening, webhook replay and out-of-order period protection.');
  console.log('PASS: Gemini key chosen by who is asking, concurrent AI quota, revoked access, stale family denial, live-shared-book chat/generation gating, account switch, refund ownership/idempotency/auth, schema validation, cancellation-before-deletion.');
};
