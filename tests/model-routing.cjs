const assert = require('node:assert/strict');

// Model routing, provider honesty, the lesson length floor and in-place
// expansion, exercised against the real modules with the network faked.
const quiet = { error() {}, warn() {}, info() {}, log() {} };

function mkLesson(teachingWords, { actions = 3, sections = 8 } = {}) {
  const per = Math.floor(teachingWords / sections);
  const out = [];
  let used = 0;
  for (let s = 1; s <= sections; s++) {
    const n = s === sections ? teachingWords - used : per;
    used += n;
    out.push(`## Section ${s} Title`, '', Array.from({ length: n }, (_, i) => `s${s}w${i}`).join(' '), '');
  }
  out.push('## Your Next Day', '');
  for (let a = 1; a <= actions; a++) out.push(`${a}. Do action ${a} today with care.`);
  return out.join('\n');
}

const words = (n, tag) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ');

module.exports = async function (load) {
  const lesson = load('lib/lesson.ts', {});
  const models = load('lib/ai-models.ts', {});
  const valid = load('lib/course-validation.ts', { './lesson': lesson });
  const budget = load('lib/generation-budget.ts', { 'node:async_hooks': require('node:async_hooks') }, { AbortSignal });
  const languages = load('lib/languages.ts', {});
  const prompts = load('lib/course-prompts.ts', { './languages': languages });

  // Routing: Flash-Lite does everything, with 3.8 Flash as the lessons' backup.
  const T = models.AI_TASKS;
  assert.equal(T.lesson.model, 'gemini-3.5-flash-lite');
  assert.equal(T.lesson.fallbackModel, 'gemini-3.8-flash', 'Lessons fall back to 3.8 Flash before Groq');
  assert.equal(T.lessonExpand.model, 'gemini-3.5-flash-lite');
  for (const name of ['outline', 'studyAids', 'axiom', 'chat', 'coverScan']) assert.equal(T[name].model, 'gemini-3.5-flash-lite', name);
  assert.notEqual(T.lesson.thinking, 'minimal', 'The 3.8 Flash backup rejects minimal thinking');

  // Provider layer: Gemini first, Groq only on failure, and the result says which.
  const calls = [];
  const logs = [];
  let geminiFails = false;
  let busyFor = 0;
  let dailyQuotaSpentOnLite = false;
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url.includes('generativelanguage')) {
      if (dailyQuotaSpentOnLite && url.includes('gemini-3.5-flash-lite')) {
        return { ok: false, status: 429, statusText: 'Too Many Requests', text: async () => JSON.stringify({ error: { message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] }] } }) };
      }
      if (busyFor > 0) {
        busyFor--;
        return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => JSON.stringify({ error: { message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' } }) };
      }
      if (geminiFails) {
        return { ok: false, status: 403, statusText: 'Forbidden', text: async () => JSON.stringify({ error: { message: "Consumer 'api_key:AIzaSyTESTTESTTESTTESTTESTTEST' has been suspended. Also 'api_key:AQ.Ab8TESTNEWFORMAT.TEST_-TESTTESTTEST' and AQ.Ab8TESTNEWFORMAT.TEST_-TESTTESTTEST", status: 'PERMISSION_DENIED', details: [{ reason: 'CONSUMER_SUSPENDED' }] } }) };
      }
      return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'private reasoning', thought: true }, { text: 'answer' }] } }] }) };
    }
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'groq answer' } }] }) };
  };
  const capture = { error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), info() {}, log() {} };
  const globals = { fetch, process: { env: { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g' } }, AbortSignal, console: capture, setTimeout: (cb) => { cb(); return 0; } };
  const groq = load('lib/groq.ts', { './generation-budget': budget }, globals);
  const gemini = load('lib/gemini.ts', { './generation-budget': budget, './groq': groq }, globals);

  const ok = await gemini.generateContent(T.lesson, 'p', 's', { maxOutputTokens: 100 });
  assert.deepEqual([ok.provider, ok.model, ok.text], ['gemini', 'gemini-3.5-flash-lite', 'answer'], 'Thought parts are not the answer');
  assert.equal(calls.length, 1, 'Groq is never called when Gemini succeeds');
  assert.ok(calls[0].url.includes('/models/gemini-3.5-flash-lite:generateContent'));
  assert.equal(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.equal(calls[0].body.generationConfig.thinkingConfig.thinkingBudget, undefined, 'Gemini 3 takes a level, not a budget');
  await gemini.generateContent(T.chat, 'p', 's');
  assert.ok(calls[1].url.includes('/models/gemini-3.5-flash-lite:generateContent'), 'Book Pal runs on Flash-Lite');

  calls.length = 0;
  busyFor = 2;
  const recovered = await gemini.generateContent(T.lesson, 'p', 's');
  assert.equal(recovered.provider, 'gemini', 'A brief overload is retried on Gemini before any fallback');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.url.includes('generativelanguage')), 'Groq is not touched while Gemini recovers');
  calls.length = 0;
  busyFor = 99;
  const exhausted = await gemini.generateContent(T.lesson, 'p', 's');
  assert.equal(exhausted.provider, 'groq');
  assert.equal(calls.length, (T.lesson.geminiRetries + 1) + 2 + 1, 'Retries are bounded: Flash-Lite, then 3.8 Flash, then Groq');
  assert.ok(calls[T.lesson.geminiRetries + 1].url.includes('gemini-3.8-flash'), '3.8 Flash is the backup before Groq');
  busyFor = 0;

  calls.length = 0;
  dailyQuotaSpentOnLite = true;
  const backup = await gemini.generateContent(T.lesson, 'p', 's');
  assert.deepEqual([backup.provider, backup.model], ['gemini', 'gemini-3.8-flash'], 'A lesson served by the backup says so');
  assert.equal(calls.length, 2, 'A spent daily quota is not retried');
  dailyQuotaSpentOnLite = false;

  geminiFails = true;
  calls.length = 0;
  const fellBack = await gemini.generateContent(T.lesson, 'p', 's');
  assert.deepEqual([fellBack.provider, fellBack.model, fellBack.text], ['groq', 'openai/gpt-oss-120b', 'groq answer'], 'A Groq answer is reported as Groq');
  assert.ok(calls.slice(0, -1).every((c) => c.url.includes('generativelanguage')) && calls.at(-1).url.includes('groq'), 'Gemini is tried before Groq');
  calls.length = 0;
  const scan = await gemini.generateContent(T.coverScan, 'p', 's', { image: { mimeType: 'image/jpeg', data: 'x' } }).catch((e) => e);
  assert.equal(scan.reason, 'CONSUMER_SUSPENDED', "Google's own error reason is kept");
  assert.equal(calls.length, 1, 'A photo never falls back to text-only Groq');
  assert.ok(!logs.concat(scan.message, scan.detail).some((l) => /AIzaSyTEST|Ab8TEST|TESTTESTTEST/.test(l)), 'Neither key format reaches logs or errors');

  // The length floor: headings and 24-hour actions do not count.
  assert.equal(valid.instructionalWordCount(mkLesson(3000)), 3000);
  const aids = { flashcards: [1, 2, 3].map((i) => ({ front: `Q${i}`, back: `A${i}` })), chatSeed: ['a', 'b', 'c'], closingAxiom: 'Small steps compound.' };
  assert.equal(valid.validLesson({ lesson: mkLesson(2199), ...aids }), false, '2,199 words is not a complete lesson');
  assert.equal(valid.validLesson({ lesson: mkLesson(2200), ...aids }), true);
  assert.match(valid.lessonStructureProblem(mkLesson(3600, { actions: 2 })), /2 closing actions/);
  assert.match(valid.lessonStructureProblem(mkLesson(3600, { sections: 3 })), /sections/);

  // The outline plans learning stages and never carries lesson text.
  const planDay = (i) => ({ dayNumber: i + 1, title: `T${i}`, previewText: 'p', coreConcept: 'c', learningObjective: 'o', keyIdeas: ['a', 'b', 'c'], bookConnection: 'b' });
  const plan = { days: Array.from({ length: 7 }, (_, i) => planDay(i)) };
  assert.equal(valid.validOutline(plan), true);
  assert.equal(valid.validOutline({ days: plan.days.slice(0, 6) }), false);
  assert.equal(valid.validOutline({ days: plan.days.map((d, i) => (i === 3 ? { ...d, coreConcept: '' } : d)) }), false);
  const outline = prompts.buildOutlineMessages('Book', 'Author', 'scholar', 'en');
  assert.match(outline.user, /seven learning stages/);
  assert.match(outline.user, /Do not divide the book into seven chapter summaries/);
  assert.match(outline.user, /Do NOT write any lesson text/);

  // Reader modes change the teaching, not the source rules.
  const ctx = { title: 'Book', author: 'Author', readingLevel: 'explorer', language: 'en', arc: [{ title: 'One' }] };
  const systems = ['explorer', 'scholar', 'architect'].map((m) => prompts.buildDayMessages({ ...ctx, readingLevel: m }, { dayNumber: 1, title: 'One' }).system);
  assert.match(systems[0], /EXPLORER MODE/);
  assert.match(systems[1], /SCHOLAR MODE/);
  assert.match(systems[2], /EXPERT MODE/);
  for (const s of systems) {
    assert.match(s, /at least 2,200 words/);
    assert.match(s, /TEACH, DON'T SUMMARIZE/);
    assert.match(s, /Never fabricate or misattribute/);
  }

  // The day pipeline, with the generator faked so each stage can be steered.
  let lessonText;
  let expansions;
  const ran = [];
  const fakeGenerate = {
    generateText: async (task, _u, _s, opts) => {
      ran.push(`${task.name}@${task.model}`);
      const problem = opts.validate?.(lessonText);
      if (problem) throw new Error(problem);
      return { data: lessonText, provider: 'gemini', model: task.model };
    },
    generateJson: async (task) => {
      ran.push(`${task.name}@${task.model}`);
      if (task.name === 'lesson-expand') {
        const next = expansions.shift();
        if (!next) throw new Error('No expansion available.');
        return { data: next, provider: 'gemini', model: task.model };
      }
      return { data: aids, provider: 'gemini', model: task.model };
    },
  };
  const dayGen = load('lib/day-generation.ts', { './ai-models': models, './course-prompts': prompts, './course-validation': valid, './generate': fakeGenerate, './lesson': lesson }, { console: quiet });
  const day = { dayNumber: 2, title: 'Two', keyIdeas: [] };

  lessonText = mkLesson(3700);
  expansions = [];
  ran.length = 0;
  const full = await dayGen.generateDayContent(ctx, day);
  assert.deepEqual(ran, ['lesson@gemini-3.5-flash-lite', 'study-aids@gemini-3.5-flash-lite'], 'A full-length lesson needs no expansion');
  assert.equal(full.wordCount, 3700);
  assert.deepEqual({ ...full.generatedBy }, { lesson: 'gemini:gemini-3.5-flash-lite', studyAids: 'gemini:gemini-3.5-flash-lite' });

  lessonText = mkLesson(1800);
  expansions = [{ additions: [{ section: 2, text: [words(150, 'a'), words(150, 'b'), words(150, 'c'), words(150, 'd'), words(150, 'e'), words(150, 'f')].join('\n\n') }, { section: 9, text: words(500, 'actions') }] }];
  ran.length = 0;
  const expanded = await dayGen.generateDayContent(ctx, day);
  assert.deepEqual(ran, ['lesson@gemini-3.5-flash-lite', 'lesson-expand@gemini-3.5-flash-lite', 'study-aids@gemini-3.5-flash-lite']);
  assert.ok(expanded.wordCount >= 2200 && expanded.wordCount <= 2500, 'A deepened lesson lands inside 2,200 to 2,500 (floor + 100-word margin + one paragraph): ' + expanded.wordCount);
  assert.ok(!expanded.lesson.includes('e0') && !expanded.lesson.includes('f0') && expanded.lesson.includes('a0'), 'Paragraphs past the missing words are dropped');
  const at = (s) => expanded.lesson.indexOf(s);
  assert.ok(at('s2w0') < at('a0') && at('a0') < at('## Section 3'), 'Additions land at the end of their own section');
  for (const p of mkLesson(1800).split('\n').filter(Boolean)) assert.ok(expanded.lesson.includes(p), 'Nothing already written is rewritten');
  assert.equal(lesson.splitLesson(expanded.lesson).actions.length, 3, 'The 24-hour actions stay last and intact');
  assert.ok(!expanded.lesson.includes('actions0'));

  lessonText = mkLesson(1800);
  expansions = [{ additions: [{ section: 1, text: words(100, 'a') }] }, { additions: [{ section: 1, text: words(100, 'b') }] }];
  ran.length = 0;
  await assert.rejects(dayGen.generateDayContent(ctx, day), /incomplete/, 'Still short after expansion is rejected');
  assert.ok(!ran.some((r) => r.startsWith('study-aids')), 'A rejected lesson gets no study aids');

  // Book Pal gets the relevant part of the lesson, not all of it.
  const { lessonExcerpt } = load('lib/chat-context.ts', {});
  const chatLesson = ['## Compound Growth', '', `Tiny gains compound. ${words(600, 'g')}`, '', '## Identity Votes', '', `Every action is a vote. ${words(600, 'v')}`, '', '## Environment Design', '', `Make cues visible. ${words(600, 'e')}`, '', '## Your Next Day', '', '1. First action.', '2. Second action.', '3. Third action.'].join('\n');
  const excerpt = lessonExcerpt(chatLesson, 'How do identity votes work?');
  assert.ok(excerpt.includes('Every action is a vote.'), 'The matching section is sent');
  assert.ok(!excerpt.includes('Tiny gains compound.') && !excerpt.includes('Make cues visible.'), 'Unrelated sections are left out');
  assert.ok(excerpt.includes('3. Third action.') && excerpt.includes('Compound Growth | Identity Votes | Environment Design'), 'Actions and the section map always go');
  const general = lessonExcerpt(chatLesson, 'Is this useful?');
  assert.ok(general.includes('Tiny gains compound.') && general.includes('Make cues visible.'), 'A general question gets the opening concept and the takeaway');
  assert.ok(excerpt.split(/\s+/).length < 800, 'The excerpt is a fraction of the lesson');

  // Request bodies: current shape, the previous build's shape, and junk.
  const legacy = dayGen.dayInputFromBody({ title: 'Book', dayNumber: 3, dayTitle: 'Three', allTitles: ['One', 'Two', 'Three'], keyIdeas: ['k'] });
  assert.deepEqual([...legacy.ctx.arc.map((a) => a.title)], ['One', 'Two', 'Three']);
  assert.equal(dayGen.dayInputFromBody({ title: 'Book', dayNumber: 9, dayTitle: 'Nine' }), null);
  const rich = dayGen.dayInputFromBody({ title: 'Book', dayNumber: 1, dayTitle: 'One', arc: [{ title: 'One', coreConcept: 'C1' }], coreConcept: 'C1', learningObjective: 'O1' });
  assert.equal(rich.ctx.arc[0].coreConcept, 'C1');
  assert.equal(rich.day.learningObjective, 'O1');

  console.log('PASS: model routing, Gemini-before-Groq with honest provenance, no image fallback, key redaction, 2,200-word floor, Flash-Lite lessons with 3.8 Flash backup, outline stages, reader modes, in-place expansion, short-lesson rejection.');
};
