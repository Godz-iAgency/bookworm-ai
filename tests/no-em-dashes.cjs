const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Readers take an em dash as a sign that text was written by an AI, so the
// shipped source has none: not in copy, error messages or comments. The code
// that STRIPS them from model output names the characters with \u escapes
// instead, so this check can be absolute.
const EM = String.fromCharCode(0x2014);
const banned = [EM, '&mdash;', '&#8212;', '&#x2014;'];

module.exports = async function (load) {
  const root = path.join(__dirname, '..');
  const found = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    if (!/\.(ts|tsx|css|mjs|json)$/.test(e.name)) return;
    fs.readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (banned.some((b) => line.includes(b))) found.push(`${path.relative(root, full)}:${i + 1}`);
    });
  });
  for (const dir of ['app', 'components', 'lib', 'context', 'public']) {
    if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  }
  assert.deepEqual(found, [], 'Em dashes in shipped source: ' + found.join(', '));

  // Stripping them from model output still works, and the prompt still names them.
  const lesson = load('lib/lesson.ts', {});
  assert.equal(lesson.stripEmDashes(`Focus ${EM} then act`), 'Focus, then act');
  assert.equal(lesson.stripEmDashes('Read 10–15 minutes'), 'Read 10-15 minutes');
  assert.equal(lesson.stripEmDashes(`10${EM}15`), '10-15');
  const prompts = load('lib/course-prompts.ts', { './languages': load('lib/languages.ts', {}) });
  assert.ok(prompts.STYLE_RULES.includes(`em dash (${EM})`), 'The prompt still shows the model which character to avoid');

  console.log('PASS: no em dashes anywhere in shipped source, and model output is still scrubbed of them.');
};
