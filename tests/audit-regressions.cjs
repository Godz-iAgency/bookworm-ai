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

async function dayCase({ lesson = '', axiom = '', response, concurrent }) {
  let failed = null;
  let updates = 0;
  let pending;
  const oldDeck = [{ front: 'Read question', back: 'Read answer' }];
  const day = { dayNumber: 2, title: 'Day two', isUnlocked: true, lesson,
    flashcards: lesson ? oldDeck : [], chatSeed: ['Existing starter'], closingAxiom: axiom };
  const course = { id: 'c', book: { title: 'Book', author: 'Author' }, days: [day] };
  let current = [course];
  const react = {
    useRef: (v) => ({ current: v }),
    useState: () => [null, (v) => { failed = v; }],
    useCallback: (fn) => (...args) => (pending = fn(...args)),
    useEffect: (fn) => fn(),
  };
  const { useDayContent } = load('lib/useDayContent.ts', { react }, {
    fetch: async () => ({ ok: true, json: async () => response }),
  });
  useDayContent(course, day, (update) => { updates++; current = update(current); }, true);
  if (concurrent) current = [{ ...course, days: [{ ...day, ...concurrent }] }];
  await pending;
  return { failed, updates, day: current[0].days[0], oldDeck };
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
      useCallback: (fn) => fn,
      useState: (initial) => {
        const index = stateIndex++;
        return [initial, (value) => { if (index === 2) error = value; }];
      },
    },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'firebase/firestore': { doc() {}, updateDoc: async () => {}, increment: (v) => v },
    '@/lib/firebase/config': { db: {} },
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
  console.log('PASS: font validation, auth/network/HTTP failures, no mutation retries, concurrent shelf preservation, billing lookup failures, incomplete day failures, and gap-only repairs.');
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
