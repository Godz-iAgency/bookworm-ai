const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real TypeScript modules with isolated network/auth and hook
// boundaries. No credentials, external requests, or test dependencies.
function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports,
    require: (id) => {
      assert.ok(id in mocks, `Unexpected import: ${id}`);
      return mocks[id];
    },
    console: { error() {} }, ...globals,
  }, { filename: file });
  return module.exports;
}

async function apiCases() {
  let calls = 0;
  const auth = { currentUser: null };
  let respond;
  const { postAuthed } = load('lib/api-client.ts', { './firebase/config': { auth } }, {
    fetch: async (_url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return respond();
    },
  });
  assert.ok((await postAuthed('/test')).error);
  assert.equal(calls, 0);
  auth.currentUser = { getIdToken: async () => { throw Error('offline token refresh'); } };
  assert.ok((await postAuthed('/test')).error);
  assert.equal(calls, 0);
  auth.currentUser.getIdToken = async () => 'test-token';
  const cases = [
    () => { throw Error('offline'); },
    () => ({ ok: false, status: 502, json: async () => { throw Error('HTML gateway page'); } }),
    () => ({ ok: false, status: 500, json: async () => ({}) }),
    () => ({ ok: true, json: async () => null }),
    () => ({ ok: true, json: async () => [] }),
  ];
  for (const respondCase of cases) {
    respond = respondCase;
    const before = calls;
    assert.ok((await postAuthed('/test')).error);
    assert.equal(calls, before + 1, 'Mutating requests must not auto-retry');
  }
  respond = () => ({ ok: false, json: async () => ({ error: 'Existing server message' }) });
  assert.equal((await postAuthed('/test')).error, 'Existing server message');
  respond = () => ({ ok: true, json: async () => ({ success: true }) });
  assert.equal((await postAuthed('/test')).success, true);
}

function lessonSettings(profile = null, uid = null) {
  const icon = () => null;
  return load('lib/lesson-settings.ts', {
    './firebase/config': { auth: { currentUser: uid ? { uid } : null } },
    './firebase/profile': { getUserProfile: async () => profile },
    './languages': load('lib/languages.ts', {}),
    './reading-levels': load('lib/reading-levels.ts', { 'lucide-react': { Sprout: icon, BookOpen: icon, Brain: icon } }),
  });
}

async function dayCase({ lesson = '', axiom = '', response, concurrent, profile = null, courseExtra = {}, sent = [] }) {
  let failed = null;
  let updates = 0;
  let pending;
  const oldDeck = [{ front: 'Read question', back: 'Read answer' }];
  const day = { dayNumber: 2, title: 'Day two', isUnlocked: true, lesson,
    flashcards: lesson ? oldDeck : [], chatSeed: ['Existing starter'], closingAxiom: axiom };
  const course = { id: 'c', book: { title: 'Book', author: 'Author' }, readingLevel: 'scholar', days: [day], ...courseExtra };
  let current = [course];
  const react = {
    useRef: (v) => ({ current: v }),
    useState: () => [null, (v) => { failed = v; }],
    useCallback: (fn) => (...args) => (pending = fn(...args)),
    useEffect: (fn) => fn(),
  };
  const { useDayContent } = load('lib/useDayContent.ts', { react, './lesson-settings': lessonSettings(profile, profile ? 'reader' : null),
    '@/lib/ai-fetch': { aiFetch: async (_url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => response }; } } });
  useDayContent(course, day, (update) => { updates++; current = update(current); }, true);
  if (concurrent) current = [{ ...course, days: [{ ...day, ...concurrent }] }];
  await pending;
  return { failed, updates, day: current[0].days[0], course: current[0], oldDeck };
}

async function courseCases() {
  let current = [{ id: 'existing', progress: 0 }];
  let error = null;
  let billingEnabled = false;
  let finishGeneration;
  const generation = new Promise((resolve) => { finishGeneration = resolve; });
  let stateIndex = 0;
  const { useCourseGeneration } = load('lib/useCourseGeneration.ts', {
    react: {
      useRef: (v) => ({ current: v }),
      useCallback: (fn) => fn,
      useState: (initial) => {
        const index = stateIndex++;
        return [initial, (value) => { if (index === 2) error = value; }];
      },
    },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'firebase/firestore': { doc() {}, updateDoc: async () => {}, increment: (v) => v },
    '@/lib/firebase/config': { db: {}, auth: { currentUser: { uid: 'test' } } },
    '@/context/AuthContext': { useAuth: () => ({ user: { uid: 'test' } }) },
    '@/lib/BookwormContext': { useBookwormContext: () => ({
      courses: current, setCourses: (update) => { current = update(current); },
      setActiveCourseId() {}, setCurrentReadingLevel() {},
    }) },
    '@/lib/generate-course': {
      generateCourseDays: () => generation,
      buildCourse: () => ({ id: 'new' }),
    },
    '@/lib/billing': {
      isBillingEnabled: () => billingEnabled,
      getBillingProfile: async () => { throw Error('offline profile'); },
    },
    '@/lib/api-client': { postAuthed: async () => ({ success: true }) },
    '@/lib/book-club': { personalCourses: (courses) => courses.filter((c) => !c.sharedFrom) },
    // Output language is read from the profile at generation time and fixed
    // onto the course. Throwing here proves a failed read falls back to
    // English rather than blocking the book.
    '@/lib/firebase/profile': { getUserProfile: async () => { throw Error('offline profile'); } },
    '@/lib/languages': { DEFAULT_LANGUAGE: 'en' },
  }, { setTimeout: (callback) => { callback(); return 0; } });
  const hook = useCourseGeneration();
  const pending = hook.start({ title: 'Book', author: 'Author' }, 'scholar');
  current = [{ id: 'existing', progress: 5 }, { id: 'added-elsewhere' }];
  finishGeneration({ days: [], thesis: '', frameworks: [] });
  await pending;
  assert.equal(current.length, 3);
  assert.equal(current[0].progress, 5);
  assert.equal(current[1].id, 'added-elsewhere');
  assert.equal(current[2].id, 'new');
  billingEnabled = true;
  await hook.start({ title: 'Book', author: 'Author' }, 'scholar');
  assert.ok(error, 'Billing failure must reach the existing error state');
  assert.equal(current.length, 3);
}

async function main() {
  await require("./hardening.cjs")(load);
  await require("./model-routing.cjs")(load);
  await require("./funnel.cjs")(load);
  await require("./no-em-dashes.cjs")(load);
  const prefs = load('lib/reading-prefs.ts', {});
  for (const input of ['constructor', '__proto__', 'toString', '', null, 3]) {
    assert.equal(prefs.coerceFontSize(input), prefs.DEFAULT_FONT_SIZE);
  }
  for (const input of ['sm', 'md', 'lg', 'xl']) assert.equal(prefs.coerceFontSize(input), input);
  await apiCases();
  await courseCases();
  const cards = [{ front: 'New question', back: 'New answer' }];
  for (const response of [
    { flashcards: cards, closingAxiom: 'Axiom' },
    { flashcards: cards, lesson: 'Lesson' },
    { flashcards: cards, lesson: 'Lesson', closingAxiom: '   ' },
  ]) {
    const result = await dayCase({ response });
    assert.equal(result.failed, 'c:2');
    assert.equal(result.updates, 0);
  }
  const repaired = await dayCase({ lesson: 'Already read', response: {
    lesson: 'Must not replace', flashcards: cards, chatSeed: ['New starter'], closingAxiom: 'Axiom',
  } });
  assert.equal(repaired.failed, null);
  assert.equal(repaired.day.lesson, 'Already read');
  assert.equal(repaired.day.flashcards, repaired.oldDeck);
  assert.equal(repaired.day.chatSeed[0], 'Existing starter');
  assert.equal(repaired.day.closingAxiom, 'Axiom');
  const raced = await dayCase({ response: {
    lesson: 'Late response', flashcards: cards, closingAxiom: 'Late axiom',
  }, concurrent: { lesson: 'Winner', flashcards: cards, closingAxiom: 'Winner axiom' } });
  assert.equal(raced.day.lesson, 'Winner');
  assert.equal(raced.day.closingAxiom, 'Winner axiom');
  {
    const cards = [{ front: 'Q', back: 'A' }];
    const full = { lesson: 'Nueva leccion', flashcards: cards, chatSeed: ['s'], closingAxiom: 'Axioma' };
    // A reader who switched to Spanish Explorer mid-book: the next day follows that.
    const sent = [];
    const switched = await dayCase({ response: full, profile: { readingLevel: 'explorer', preferredLanguage: 'es' }, courseExtra: { language: 'en' }, sent });
    assert.equal(sent[0].language, 'es', 'A new day is written in the reader\'s current language');
    assert.equal(sent[0].readingLevel, 'explorer', 'A new day is written at the reader\'s current level');
    assert.equal(switched.day.language, 'es');
    assert.equal(switched.day.readingLevel, 'explorer');
    assert.equal(switched.course.language, 'es', 'The course now shows the new language');
    assert.equal(switched.course.readingLevel, 'explorer');
    // No profile to read (signed out, or the read failed): the course's own settings.
    const sent2 = [];
    await dayCase({ response: full, courseExtra: { language: 'fr' }, sent: sent2 });
    assert.equal(sent2[0].language, 'fr');
    assert.equal(sent2[0].readingLevel, 'scholar');
    // Repairing a day already written uses that day's own language, not the profile's.
    const sent3 = [];
    await dayCase({ lesson: 'Already read', response: { flashcards: cards, chatSeed: ['s'], closingAxiom: 'Axiom' }, profile: { readingLevel: 'explorer', preferredLanguage: 'es' }, courseExtra: { language: 'en' }, sent: sent3 });
    assert.equal(sent3[0].language, 'en', 'A repair matches the day it repairs');
    assert.equal(sent3[0].readingLevel, 'scholar');

    const ls = lessonSettings();
    const course = { id: 'c', readingLevel: 'scholar', language: 'en', days: [
      { dayNumber: 1, lesson: 'Read', title: 'One' }, { dayNumber: 2, lesson: '', title: 'Two' }, { dayNumber: 3, lesson: '', title: 'Three' }] };
    const after = ls.withDaySettings(course, 2, { readingLevel: 'architect', language: 'fr' });
    assert.equal(after.days[0].language, 'en', 'Days written before a switch keep their language');
    assert.equal(after.days[0].readingLevel, 'scholar');
    assert.equal(after.days[1].language, 'fr');
    assert.equal(after.days[2].language, undefined, 'Unwritten days are not stamped');
    assert.equal(after.language, 'fr');
    assert.deepEqual({ ...ls.settingsOfDay(after, after.days[0]) }, { readingLevel: 'scholar', language: 'en' });
    assert.deepEqual({ ...ls.settingsOfDay(after, after.days[2]) }, { readingLevel: 'architect', language: 'fr' });
    // No switch: nothing else changes.
    const same = ls.withDaySettings(course, 2, { readingLevel: 'scholar', language: 'en' });
    assert.equal(same.days[0].language, undefined);
    assert.equal(same.language, 'en');
    // An invalid profile value never reaches a prompt.
    const odd = await lessonSettings({ readingLevel: 'wizard', preferredLanguage: 'xx' }, 'reader').settingsForNextDay(course);
    assert.deepEqual({ ...odd }, { readingLevel: 'scholar', language: 'en' });
    // A Book Club member's view of someone else's book keeps that book's settings.
    const shared = await lessonSettings({ readingLevel: 'explorer', preferredLanguage: 'es' }, 'reader').settingsForNextDay({ ...course, sharedFrom: { ownerUid: 'x' } });
    assert.deepEqual({ ...shared }, { readingLevel: 'scholar', language: 'en' });
  }
  console.log('PASS: font validation, auth/network/HTTP failures, no mutation retries, concurrent shelf preservation, billing lookup failures, incomplete day failures, gap-only repairs, and mid-book language and level switches.');
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
