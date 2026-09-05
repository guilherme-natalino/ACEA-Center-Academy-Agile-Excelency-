// Security layer: small, reusable browser-side controls mapped to OWASP Top 10:2025.
// IMPORTANT: this file hardens the frontend, but real authorization, RLS, rate limits,
// secret management and server-side validation must still be enforced by the backend.

const Security = (() => {
  // OWASP Top 10:2025 categories used as the security baseline for this project.
  const OWASP_2025 = Object.freeze({
    A01: 'A01:2025 - Broken Access Control',
    A02: 'A02:2025 - Security Misconfiguration',
    A03: 'A03:2025 - Software Supply Chain Failures',
    A04: 'A04:2025 - Cryptographic Failures',
    A05: 'A05:2025 - Injection',
    A06: 'A06:2025 - Insecure Design',
    A07: 'A07:2025 - Authentication Failures',
    A08: 'A08:2025 - Software or Data Integrity Failures',
    A09: 'A09:2025 - Security Logging and Alerting Failures',
    A10: 'A10:2025 - Mishandling of Exceptional Conditions'
  });

  // Hosts explicitly trusted for learning materials opened by the app.
  const ALLOWED_EXTERNAL_HOSTS = Object.freeze(['www.youtube.com', 'youtube.com', 'youtu.be']);

  // Returns true only for a valid UUID v4-like value used by generic identifiers.
  function safeUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  // Validates Firebase Auth identifiers without assuming UUID formatting.
  function safeFirebaseUid(value) {
    return /^[A-Za-z0-9_-]{20,128}$/.test(String(value || ''));
  }

  // Restricts a number to an integer range so corrupted storage data cannot create impossible state.
  function clampInt(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.trunc(number)));
  }

  // Accepts only simple allow-listed values, preventing path/table injection.
  function allowListValue(value, allowedValues) {
    return allowedValues.includes(value) ? value : null;
  }

  // Allows only HTTPS links to explicitly trusted hosts used by the application.
  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return '#';
      if (!ALLOWED_EXTERNAL_HOSTS.includes(url.hostname.toLowerCase())) return '#';
      return url.toString();
    } catch (error) {
      return '#';
    }
  }

  // Parses JSON safely and returns a fallback when malformed data is received.
  async function safeJson(response, fallback) {
    if (!response) return fallback;
    try { return await response.json(); } catch (error) { return fallback; }
  }

  // Wraps fetch so network failures become controlled application errors.
  async function safeFetch(url, options = {}) {
    try {
      return await fetch(url, {
        ...options,
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin'
      });
    } catch (error) {
      const safeError = new Error('Network request failed');
      safeError.cause = error;
      throw safeError;
    }
  }


  // Validates an email using a conservative client-side format check before Auth receives it.
  function safeEmail(value) {
    const email = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
  }

  // Validates a password length without logging or storing the password.
  function validPassword(value) {
    return typeof value === 'string' && value.length >= 8 && value.length <= 128;
  }

  // Restores only the minimal authenticated user fields that the UI actually needs.
  function parseStoredUser(value) {
    try {
      const user = JSON.parse(value || 'null');
      if (!user || !(safeUuid(user.id) || safeFirebaseUid(user.id))) return null;
      const email = String(user.email || '').trim();
      return { id: user.id, email };
    } catch (error) {
      return null;
    }
  }

  // Validates a profile before it becomes application state, limiting trust in local/cloud data.
  function normalizeProfile(source, base = null) {
    const fallback = base || {
      level: 1,
      xp: 0,
      streak: 0,
      lastDay: null,
      bestStreak: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      recovered: 0,
      history: [],
      mastery: {},
      achievements: {},
      quizSeen: {},
      trainingCount: 0,
      promotionCount: 0,
      daily: { date: null, done: false, score: 0 }
    };

    const result = {
      level: clampInt(source?.level ?? fallback.level, 1, 5),
      xp: clampInt(source?.xp ?? fallback.xp, 0, 999999999),
      streak: clampInt(source?.streak ?? fallback.streak, 0, 99999),
      lastDay: typeof (source?.lastDay ?? source?.last_day ?? fallback.lastDay) === 'string'
        ? (source?.lastDay ?? source?.last_day ?? fallback.lastDay)
        : null,
      bestStreak: clampInt(source?.bestStreak ?? source?.best_streak ?? fallback.bestStreak, 0, 99999),
      totalAnswered: clampInt(source?.totalAnswered ?? source?.total_answered ?? fallback.totalAnswered, 0, 100000000),
      totalCorrect: clampInt(source?.totalCorrect ?? source?.total_correct ?? fallback.totalCorrect, 0, 100000000),
      recovered: clampInt(source?.recovered ?? fallback.recovered, 0, 100000000),
      history: sanitizeHistory(source?.history, fallback.history || []),
      mastery: sanitizeMastery(source?.mastery, fallback.mastery || {}),
      achievements: sanitizeMap(source?.achievements, fallback.achievements || {}, 100),
      quizSeen: sanitizeMap(source?.quizSeen, fallback.quizSeen || {}, 10000),
      trainingCount: clampInt(source?.trainingCount ?? source?.training_count ?? fallback.trainingCount, 0, 100000000),
      promotionCount: clampInt(source?.promotionCount ?? source?.promotion_count ?? fallback.promotionCount, 0, 100),
      consentVersion: typeof (source?.consentVersion ?? source?.consent_version) === 'string'
        ? (source?.consentVersion ?? source?.consent_version).slice(0, 20) : null,
      consentAt: typeof (source?.consentAt ?? source?.consent_at) === 'string'
        ? (source?.consentAt ?? source?.consent_at).slice(0, 40) : null,
      daily: {
        date: typeof source?.daily?.date === 'string' ? source.daily.date : (fallback.daily?.date || null),
        done: Boolean(source?.daily?.done),
        score: clampInt(source?.daily?.score, 0, 100)
      }
    };

    result.totalCorrect = Math.min(result.totalCorrect, result.totalAnswered);
    result.bestStreak = Math.max(result.bestStreak, result.streak);
    return result;
  }


  // Sanitizes a generic object map and limits its key count to reduce corrupted-state impact.
  function sanitizeMap(value, fallback, maxKeys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    return Object.fromEntries(Object.entries(value).slice(0, maxKeys));
  }

  // Sanitizes mastery values before they influence adaptive selection or metrics.
  function sanitizeMastery(value, fallback) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const result = {};
    Object.entries(value).slice(0, 500).forEach(([concept, data]) => {
      if (!data || typeof data !== 'object') return;
      const seen = clampInt(data.seen, 0, 1000000);
      result[String(concept).slice(0, 160)] = {
        seen,
        correct: Math.min(clampInt(data.correct, 0, 1000000), seen),
        last: clampInt(data.last, 0, 9999999999999),
        recovery: clampInt(data.recovery, 0, 1000000)
      };
    });
    return result;
  }

  // Sanitizes history records so the profile renderer receives only predictable primitive data.
  function sanitizeHistory(value, fallback) {
    if (!Array.isArray(value)) return fallback;
    return value.slice(0, 50).filter((item) => item && typeof item === 'object').map((item) => ({
      date: String(item.date || '').slice(0, 30),
      mode: String(item.mode || '').slice(0, 30),
      correct: clampInt(item.correct, 0, 1000000),
      total: clampInt(item.total, 0, 1000000),
      score: clampInt(item.score, 0, 100),
      xp: clampInt(item.xp, 0, 999999999)
    }));
  }

  // Logs only low-risk diagnostic data without tokens, passwords or user content.
  function log(message, metadata = {}) {
    const safeMetadata = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (['token', 'password', 'authorization', 'email', 'access_token', 'refresh_token'].includes(key)) continue;
      safeMetadata[key] = String(value).slice(0, 120);
    }
    console.warn('[Security]', message, safeMetadata);
  }

  return Object.freeze({
    OWASP_2025,
    ALLOWED_EXTERNAL_HOSTS,
    safeUuid,
    safeFirebaseUid,
    safeEmail,
    validPassword,
    clampInt,
    allowListValue,
    safeExternalUrl,
    safeJson,
    safeFetch,
    parseStoredUser,
    normalizeProfile,
    log
  });
})();
