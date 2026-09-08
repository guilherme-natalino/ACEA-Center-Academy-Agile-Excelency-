const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const security = fs.readFileSync(path.join(root, 'js/security.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js/model.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function test(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

test('OWASP Top 10:2025 baseline is documented in code', () => {
  for (const id of ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10']) {
    assert.match(security, new RegExp(id + ':2025'));
  }
});

test('Security helpers validate UUIDs, URLs and bounded integers', () => {
  assert.match(security, /function safeUuid/);
  assert.match(security, /function safeExternalUrl/);
  assert.match(security, /function clampInt/);
  assert.match(security, /Math\.min/);
});

test('Firebase configuration and user identifiers are validated', () => {
  assert.match(model, /FIREBASE_CONFIG/);
  assert.match(model, /firebase\.firestore/);
  assert.match(security, /function safeFirebaseUid/);
  assert.match(model, /Security\.safeFirebaseUid\(currentUser\.id\)/);
  assert.match(model, /firebaseAnalytics\.setAnalyticsCollectionEnabled/);
  assert.match(model, /async deleteAccount/);
  assert.match(model, /async clearProgress/);
});

test('Third-party EmailJS SDK is pinned to an exact version', () => {
  assert.match(html, /@emailjs\/browser@4\.4\.1\/dist\/email\.min\.js/);
});

test('Support tickets are restricted to the authenticated owner', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/support\/{userId}\/tickets\/{ticketId}/);
  assert.match(rules, /request\.resource\.data\.user_id == userId/);
  assert.match(rules, /request\.resource\.data\.category in \['bug', 'account', 'progress', 'suggestion', 'other'\]/);
  assert.match(rules, /description\.size\(\) <= 2000/);
  assert.match(rules, /allow update, delete: if false/);
  assert.match(rules, /request\.auth\.token\.email == 'guilhermealisson14@hotmail\.com'/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
});

test('Support email uses configured EmailJS public integration', () => {
  assert.match(model, /EMAILJS_CONFIG/);
  assert.match(model, /c3jH0aW9Rzzdge_6F/);
  assert.match(model, /service_q0pdy1n/);
  assert.match(model, /template_vy1imab/);
  assert.match(model, /acaeacademiaagile@gmail\.com/);
  assert.match(model, /async sendSupportEmail/);
  assert.match(model, /emailjs\.send/);
  assert.match(model, /reply_to: ticket\.email/);
  assert.match(model, /reason: error\.text/);
});

test('CSP and security headers are defined for static hosting', () => {
  assert.match(html, /security\.js/);
  const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /gstatic\.com/);
  assert.match(headers, /firestore\.googleapis\.com/);
  assert.match(headers, /google-analytics\.com/);
  assert.match(headers, /cdn\.jsdelivr\.net/);
  assert.match(headers, /api\.emailjs\.com/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy/);
  assert.match(headers, /Permissions-Policy/);
});

test('Journey uses five explicit mascot states and does not trust arbitrary profile level', () => {
  assert.match(fs.readFileSync(path.join(root, 'js/view.js'), 'utf8'), /function getMascotState/);
  assert.match(model, /normalizeProfile/);
  assert.match(fs.readFileSync(path.join(root, 'js/security.js'), 'utf8'), /level: clampInt/);
  assert.match(html, /journeyTrack/);
});


test('No stale Jornada progress elements or inline event handlers remain', () => {
  assert.doesNotMatch(model, /levelFill|levelBadge/);
  assert.doesNotMatch(html, /onclick\s*=/i);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/view.js'), 'utf8'), /onclick\s*=/i);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/controller.js'), 'utf8'), /onclick\s*=/i);
});
