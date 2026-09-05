const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const view = fs.readFileSync(path.join(root, 'js/view.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'js/controller.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js/model.js'), 'utf8');

function test(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (err) { console.error(`not ok - ${name}`); throw err; }
}

test('Jornada has dedicated Metrics navigation and keeps journey explainer', () => {
  assert.match(html, /id=["']nav-metrics["']/);
  assert.match(html, /id=["']metrics["']/);
  assert.match(html, /Como funciona sua jornada/);
});

test('Jornada does not contain detailed competency metrics', () => {
  const home = html.match(/<section class="screen active" id="home">([\s\S]*?)<\/section>\s*<section class="screen" id="study">/)[1];
  assert.doesNotMatch(home, /homeSkills/);
  assert.doesNotMatch(home, /Domínio por competência/);
});

test('MVC assets are externalized and HTML has no inline click handlers', () => {
  assert.match(html, /css\/styles\.css/);
  assert.match(html, /js\/model\.js/);
  assert.match(html, /js\/view\.js/);
  assert.match(html, /js\/controller\.js/);
  assert.equal((html.match(/onclick=/g) || []).length, 0);
  assert.equal((view.match(/onclick=/g) || []).length, 0);
  assert.equal((controller.match(/onclick=/g) || []).length, 0);
});

test('Controller delegates core user actions', () => {
  for (const action of ['training','exam','daily','recommended','next','reset','auth-modal','submit-auth','study-concept','answer']) {
    assert.match(controller, new RegExp("case '" + action + "'"));
  }
});

test('Question rendering stores the displayed answer order for the controller', () => {
  assert.match(view, /state\.optionOrder\s*=\s*order/);
  assert.match(view, /state\.correctPosition\s*=\s*correctPosition/);
});

test('Recovery materials use embeddable videos instead of YouTube search pages', () => {
  const catalog = model.match(/const RECOVERY_VIDEOS=Object\.freeze\((\{[\s\S]*?\})\);/);
  assert.ok(catalog, 'the recovery video catalog must exist');
  assert.doesNotMatch(catalog[1], /youtube\.com\/results\?search_query=/);
  assert.match(model, /function toEmbedUrl/);
  assert.doesNotMatch(model.match(/function materialFor\([\s\S]*?\n\}/)[0], /results\?search_query=/);
  assert.match(controller, /class="recovery-video"/);
  assert.match(controller, /<iframe/);
});

test('Studies only render the practice button for concepts with questions', () => {
  assert.match(view, /const practiceAction = count > 0/);
  assert.match(view, /\$\{practiceAction\}/);
});

test('Metrics show all attention groups and provide focused practice', () => {
  assert.doesNotMatch(view, /filter\(\(item\) => item\[1\] < 70\)\.slice\(0, 5\)/);
  assert.match(view, /data-action="study-group"/);
  assert.match(controller, /case 'study-group'/);
});

test('Achievement catalog includes learning and progression milestones', () => {
  for (const id of ['marathon', 'centurion', 'streak7', 'explorer', 'perfect', 'streak10', 'turnaround', 'polymath']) {
    assert.match(model, new RegExp(id));
  }
  assert.match(controller, /profile\.totalAnswered >= 25/);
  assert.match(controller, /profile\.totalAnswered >= 100/);
  assert.match(controller, /state\.sessionStreak >= 10/);
  assert.match(controller, /profile\.streak >= 7/);
  assert.match(controller, /startedCompetencies\(\) >= 5/);
  assert.match(controller, /score === 100/);
  assert.match(controller, /allCompetenciesMastered\(70\)/);
});

test('Account creation requires data policy consent and offers progress choice', () => {
  assert.match(controller, /id="rConsent"/);
  assert.match(controller, /data-policy\.html/);
  assert.match(controller, /Aceite a Política de Privacidade/);
  assert.match(controller, /data-action="use-cloud-data"/);
  assert.match(controller, /data-action="keep-session-data"/);
  assert.match(model, /visitor progress remains session-only/);
  assert.doesNotMatch(model, /localStorage\.setItem\('agile-academy-v3'/);
});
