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
  const valid = load('lib/course-validation.ts', {});
  assert.equal(valid.validOutline({days: [null]}), false);
  assert.equal(valid.validDeck([{front:'x',back:null}]), false);
  const db = database({'users/u': {accessOverride: {active:true,lifetimeGenerations:1,maxOpenBooks:1}, generationsThisMonth:0}});
  let uid = null;
  const {guardAI} = load('lib/ai-guard.ts', {'next/server':{NextResponse:json}, './firebase/admin':{getUidFromRequest:async()=>uid,getAdminDb:()=>db}, './plans':plans});
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

  const auth = {currentUser:{uid:'u',getIdToken:async()=> 'token'}};
  let finish;
  const {aiFetch}=load('lib/ai-fetch.ts', {'./firebase/config':{auth}}, {fetch:()=>new Promise(r=>finish=r)});
  const request=aiFetch('/test',{}); for(let i=0;i<10 && !finish;i++) await Promise.resolve(); auth.currentUser={uid:'other'}; finish({ok:true});
  await assert.rejects(request,/Account changed/);

  let refunds=[];let caller={uid:'admin',email:'admin'};
  const paydb=database({'users/u':{stripeCustomerId:'cus_ours'}});
  const {POST:payments}=load('app/api/admin/payments/route.ts', {'next/server':{NextResponse:json},'@/lib/firebase/admin':{getAuthedUser:async()=>caller,getAdminDb:()=>paydb},'@/lib/admin':{isAdminEmail:e=>e==='admin'},'@/lib/stripe/server':{getStripe:()=>({charges:{retrieve:async id=>({id,customer:id==='foreign'?'cus_foreign':'cus_ours',status:'succeeded',amount:100,amount_refunded:0})},refunds:{create:async(body,opts)=>{refunds.push(opts.idempotencyKey);return {id:'re_1',amount:100,currency:'usd'};}}})}});
  const refund=id=>({json:async()=>({action:'refund',chargeId:id})});
  assert.equal((await payments(refund('foreign'))).status,400);
  await Promise.all([payments(refund('ch_ours')),payments(refund('ch_ours'))]);
  assert.equal(new Set(refunds).size,1,'Concurrent retries share the Stripe idempotency key');
  caller=null; assert.equal((await payments(refund('ch_ours'))).status,401);
  assert.equal(refunds.length,2);

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
  const {POST:webhook}=load('app/api/stripe/webhook/route.ts',{'next/server':{NextResponse:json},'stripe':{},'@/lib/account-lock':{withAccountLock:async(_uid,fn)=>fn()},'@/lib/firebase/admin':{getAdminDb:()=>webhookdb},'@/lib/family-server':{dissolveClub:async()=>{}},'@/lib/stripe/server':{planForPriceId:()=> 'page_turner',getStripe:()=>({webhooks:{constructEvent:()=>event},subscriptions:{retrieve:async()=>({id:'sub_1',customer:'cus_1',status:'active',items:{data:[{price:{id:'price_1'},current_period_end:200}]}})}})}},{process:{env:{STRIPE_WEBHOOK_SECRET:'test'}}});
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
  console.log('PASS: duplicate completion, stale backfill, protected scheduled deletion, old-period invoice.');
  console.log('PASS: atomic shelf cap/idempotent save, output language bound to its generation ticket, share resolves without copying, withdrawal blocks reopening, webhook replay and out-of-order period protection.');
  console.log('PASS: concurrent AI quota, revoked access, stale family denial, live-shared-book chat/generation gating, account switch, refund ownership/idempotency/auth, schema validation, cancellation-before-deletion.');
};
