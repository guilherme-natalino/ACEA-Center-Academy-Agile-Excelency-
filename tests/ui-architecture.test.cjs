const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const view = fs.readFileSync(path.join(root, 'js/view.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'js/controller.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js/model.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');

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
  for (const action of ['training','exam','daily','recommended','next','reset','auth-modal','submit-auth','forgot-password','study-concept','answer']) {
    assert.match(controller, new RegExp("case '" + action + "'"));
  }
});

test('Login offers password recovery without account enumeration', () => {
  assert.match(controller, /data-action="forgot-password"/);
  assert.match(controller, /async function forgotPassword/);
  assert.match(model, /sendPasswordResetEmail/);
  assert.match(controller, /Se o email estiver cadastrado/);
});

test('Connected account menu explains Analytics and identifies the active user', () => {
  assert.match(controller, /class="account-panel"/);
  assert.match(controller, /profile\.nome/);
  assert.match(controller, /profile\.sobrenome/);
  assert.match(controller, /Analytics de uso/);
  assert.match(controller, /Não é necessário para estudar/i);
  assert.match(controller, /aria-pressed/);
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
  assert.match(view, /const practiceAction = answered > 0/);
  assert.match(view, /\$\{practiceAction\}/);
});

test('Support area provides FAQ and authenticated ticket flow', () => {
  assert.match(html, /id="nav-support"/);
  assert.match(html, /id="support"/);
  assert.match(html, /FAC · Perguntas frequentes/);
  assert.match(html, /id="supportForm"/);
  assert.match(controller, /async function submitSupportTicket/);
  assert.match(model, /async createSupportTicket/);
  assert.match(model, /async getSupportTickets/);
  assert.match(model, /collection\('support'\)/);
  assert.match(view, /async function renderSupport/);
});

test('Requester can open a ticket and read the team response', () => {
  assert.match(view, /openSupportTicket/);
  assert.match(view, /ticket\.response/);
  assert.match(view, /Aguardando atendimento/);
  assert.match(controller, /open-support-ticket/);
  assert.match(controller, /event\.key === 'Escape'/);
  assert.match(controller, /event\.target\.id === 'modal'/);
});

test('Admin area is restricted and can respond to tickets', () => {
  assert.match(html, /id="nav-admin"/);
  assert.match(html, /id="admin"/);
  assert.match(view, /function renderAdminAccess/);
  assert.match(view, /async function renderAdmin/);
  assert.match(view, /respondToSupportTicket/);
  assert.match(model, /async getAdminTickets/);
  assert.match(model, /async updateAdminTicket/);
  assert.match(model, /guilhermealisson14@hotmail\.com/);
  assert.match(view, /Admin tickets load failed/);
  assert.match(styles, /\*\[hidden\] \{ display: none !important; \}/);
});

test('Notifications poll ticket creation and responses by user scope', () => {
  assert.match(html, /data-action="notifications"/);
  assert.match(controller, /async function pollNotifications/);
  assert.match(controller, /isAdminUser\(\)/);
  assert.match(controller, /Chamado respondido/);
  assert.match(controller, /setInterval\(pollNotifications, 60000\)/);
});

test('Support ticket validation identifies the incomplete field', () => {
  assert.match(controller, /subject\.length < 3/);
  assert.match(controller, /description\.length < 15/);
  assert.match(controller, /assunto com pelo menos 3 caracteres/);
  assert.match(controller, /pelo menos 15 caracteres/);
});

test('Support submission exposes failures instead of failing silently', () => {
  assert.match(controller, /try \{/);
  assert.match(controller, /Support ticket submission failed/);
  assert.match(controller, /Não foi possível criar o chamado/);
  assert.match(controller, /Enviando\.\.\./);
});

test('Support category uses a custom combo box with improvement suggestion', () => {
  assert.match(html, /support-combobox/);
  assert.match(html, /data-support-value="suggestion"/);
  assert.match(html, /Sugestão de melhoria/);
  assert.match(controller, /function selectSupportCategory/);
  assert.match(controller, /toggle-support-category/);
});

test('Unstarted studies show zero progress and no practice action', () => {
  assert.match(view, /const displayedTotal = answered > 0 \? count : 0/);
  assert.match(view, /\$\{answered\}\/\$\{displayedTotal\} respondidas/);
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

test('Progress choice modal provides clear cloud and session options', () => {
  assert.match(controller, /data-choice-option--primary/);
  assert.match(controller, /Usar progresso da nuvem/);
  assert.match(controller, /Manter esta sessão/);
  assert.match(controller, /Decidir depois/);
});

test('Account button uses the logo for visitors and name initials for users', () => {
  assert.match(view, /function renderAccountIdentity/);
  assert.match(view, /avatar-person-icon/);
  assert.match(view, /viewBox="0 -960 960 960"/);
  assert.match(view, /profile\.nome/);
  assert.match(view, /profile\.sobrenome/);
  assert.match(model, /nome: profile\.nome/);
  assert.match(model, /sobrenome: profile\.sobrenome/);
  assert.match(view, /\$\{first \|\| '\?'\}\$\{last \|\| '\?'\}/);
  assert.match(controller, /\$\{first \|\| '\?'\}\$\{last \|\| '\?'\}/);
});

test('Owner account identity is normalized to the requested name', () => {
  assert.match(controller, /guilhermealisson14@hotmail\.com/);
  assert.match(controller, /profile\.nome = 'Guilherme'/);
  assert.match(controller, /profile\.sobrenome = 'Natalino'/);
  assert.match(controller, /normalizeOwnerIdentity/);
});

test('Privacy controls identify the official contact and isolate analytics consent', () => {
  const policy = fs.readFileSync(path.join(root, 'data-policy.html'), 'utf8');
  assert.match(policy, /acaeacademiaagile@gmail\.com/);
  assert.match(controller, /rAdult/);
  assert.match(controller, /rAnalytics/);
  assert.match(controller, /localStorage\.removeItem\('analytics-consent'\)/);
  assert.match(model, /setAnalyticsCollectionEnabled\(false\)/);
});

test('Progress bars use profile data instead of fixed initial values', () => {
  assert.match(view, /function promotionProgress/);
  assert.match(view, /promotionProgress\(\)/);
  assert.match(view, /journey\.style\.setProperty\('--track-fill'/);
  assert.doesNotMatch(view, /continueBar.*Math\.max\(8/);
  assert.doesNotMatch(view, /goalBar.*'75%'/);
});

test('Mobile journey track reserves space for mascot labels', () => {
  assert.match(styles, /\.journey-track \{ min-height: 125px; \}/);
  assert.match(styles, /\.journey-track::before \{ bottom: 30px; \}/);
});

test('Studies distinguish answered questions from available questions', () => {
  assert.match(view, /const answered = mastery\(concept\)\.seen/);
  assert.match(view, /const displayedTotal = answered > 0 \? count : 0/);
  assert.match(view, /\$\{answered\}\/\$\{displayedTotal\} respondidas/);
});

test('Question bank includes quality checks for obvious correct options', () => {
  assert.match(model, /function questionQualityIssues/);
  assert.match(model, /Resposta correta muito longa/);
  assert.match(model, /Pista textual na resposta correta/);
  assert.match(model, /QUESTION_QUALITY_REPORT/);
});

test('Registration requires adulthood and separates Analytics consent', () => {
  assert.match(controller, /id="rAdult"/);
  assert.match(controller, /id="rAnalytics"/);
  assert.match(controller, /maiores de 18 anos/);
  assert.match(controller, /data-action="delete-account"/);
  assert.match(model, /analytics_consent/);
});
