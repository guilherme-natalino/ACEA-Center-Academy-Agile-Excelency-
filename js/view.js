// View: DOM rendering only. No business rules or network calls live here.

// Returns the labels used by the quiz mode chip.
function getModeLabel(mode) {
  return mode === 'exam'
    ? '🧪 Avaliação'
    : mode === 'daily'
      ? '⚔️ Desafio'
      : mode === 'recommended'
        ? '🩹 Recuperação'
        : '🎮 Treinamento';
}

// Returns the readable difficulty name for a question.
function getDifficultyLabel(difficulty) {
  return ['', 'Básico', 'Intermediário', 'Avançado', 'Expert', 'Especialista'][difficulty] || 'Básico';
}

// Renders the current quiz question and safely creates its answer buttons.
function renderQuestion() {
  const question = state.questions[state.idx];
  if (!question) return;

  document.getElementById('modeTag').textContent = getModeLabel(state.mode);
  document.getElementById('qdiff').textContent = getDifficultyLabel(question.diff);
  document.getElementById('qcount').textContent = `${state.idx + 1}/${state.questions.length}`;
  document.getElementById('qtext').textContent = question.q;

  const examBanner = document.getElementById('examBanner');
  examBanner.innerHTML = state.mode === 'exam'
    ? `<div class="exam-box"><b>🧪 Avaliação de promoção</b><div class="small muted">Necessário: ${PROMOTION_SCORE}% geral + mínimo ${REQUIRED_DOMAIN}% nas competências obrigatórias.</div></div>`
    : '';

  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const correctPosition = order.indexOf(question.ans);
  state.optionOrder = order;
  state.correctPosition = correctPosition;
  const options = document.getElementById('opts');
  options.innerHTML = '';

  order.forEach((originalIndex, position) => {
    const button = document.createElement('button');
    button.className = 'opt';
    button.type = 'button';
    button.dataset.action = 'answer';
    button.dataset.pos = String(position);
    button.dataset.correct = String(correctPosition);
    button.dataset.idxArr = order.join(',');

    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = ['A', 'B', 'C', 'D'][position];

    const answerText = document.createElement('span');
    answerText.textContent = question.opts[originalIndex];

    button.append(letter, answerText);
    options.appendChild(button);
  });

  document.getElementById('feedback').className = 'feedback';
  document.getElementById('nextBtn').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Renders the result screen after a training, challenge or promotion assessment.
function showResult(score, competencies, passed) {
  showScreen('result');

  const title = state.mode === 'exam'
    ? (passed ? '🎉 PROMOÇÃO CONQUISTADA!' : '🧪 Avaliação concluída')
    : state.mode === 'daily'
      ? '⚔️ Desafio concluído'
      : '📊 Treinamento concluído';

  let html = `
    <div class="hero">
      <h1>${title}</h1>
      <p>${state.sessionCorrect}/${state.questions.length} acertos · ${score}% · ${profile.xp} XP total</p>
    </div>`;

  if (state.mode === 'exam') {
    html += passed
      ? `<div class="promo"><h2>🔓 Novo nível desbloqueado!</h2><p>${esc(LEVELS[profile.level - 1].label)}</p></div>`
      : `<div class="card"><h3>❌ Promoção não liberada</h3><p class="muted small result-rule">Regra: ${PROMOTION_SCORE}% geral e ${REQUIRED_DOMAIN}% nas competências obrigatórias.</p></div>`;
  }

  html += `
    <div class="stats result-stats">
      <div class="stat"><b class="result-good">${state.sessionCorrect}</b><span>Acertos</span></div>
      <div class="stat"><b class="result-bad">${state.questions.length - state.sessionCorrect}</b><span>Erros</span></div>
      <div class="stat"><b class="result-accent">${profile.xp}</b><span>XP total</span></div>
      <div class="stat"><b class="result-amber">${profile.level}</b><span>Nível</span></div>
    </div>`;

  if (competencies.length) {
    html += '<div class="section-title">Competências da avaliação</div><div class="card">';
    html += competencies.map((item) => `
      <div class="skill">
        <div class="skill-name">${esc(item.g)}</div>
        <div class="bar"><i class="${item.pc >= REQUIRED_DOMAIN ? 'bar-good' : 'bar-bad'}" data-width="${item.pc}"></i></div>
        <div class="pct">${item.pc}%</div>
      </div>`).join('');
    html += '</div>';
  }

  const errors = state.results.filter((result) => !result.ok);
  if (errors.length) {
    html += '<div class="section-title">🩹 Revisão dos erros</div><div class="card">';
    html += errors.map((result) => {
      const material = materialFor(result.q);
      return `
        <div class="review-item">
          <div class="review-q">${esc(result.q.q)}</div>
          <div class="review-line righttxt">✓ Correto: ${esc(result.correctTxt)}</div>
          <div class="review-line wrongtxt">✗ Sua resposta: ${esc(result.yourTxt)}</div>
          <div class="review-line muted small review-explanation">${esc(result.q.exp || '')}</div>
          <a class="material" href="${material.url}" target="_blank" rel="noopener noreferrer">
            <div class="play">▶</div>
            <div><b>🎥 ${esc(material.title)}</b><small>${esc(result.q.concept)}</small></div>
          </a>
        </div>`;
    }).join('');
    html += '</div>';
  }

  html += `
    <div class="actions">
      <button class="btn" type="button" data-action="recommended">🩹 Treinar meu ponto fraco</button>
      <button class="btn secondary" type="button" data-screen="home">🏠 Voltar à jornada</button>
    </div>`;

  document.getElementById('resultBody').innerHTML = html;
}

// Renders the cloud-account strip shown at the top of the Journey screen.
function renderAuthStrip() {
  const wrapper = document.getElementById('auth-strip-wrap');
  if (!wrapper) return;

  if (currentUser) {
    const username = String(currentUser.email || '').split('@')[0];
    wrapper.innerHTML = `
      <div class="auth-strip" data-action="auth-menu">
        <div class="acloud">☁️</div>
        <div class="atext">
          <b>${esc(username)}</b>
          <span>${esc(currentUser.email || '')} · Progresso salvo na nuvem</span>
        </div>
        <div class="achev">›</div>
      </div>`;
    return;
  }

  wrapper.innerHTML = `
    <div class="auth-strip" data-action="auth-modal">
      <div class="acloud">🔐</div>
      <div class="atext">
        <b>Entrar ou criar conta</b>
        <span>Salve seu progresso na nuvem</span>
      </div>
      <div class="achev">›</div>
    </div>`;
}

// Converts a Journey level into the visual state used by its mascot card.
// 'next' = immediately next level (shows as silhouette/shadow)
function getMascotState(levelNumber) {
  if (levelNumber < profile.level) return 'completed';
  if (levelNumber === profile.level) return 'current';
  if (levelNumber === profile.level + 1) return 'next';
  return 'locked';
}

// Renders the five Journey mascots and highlights the user's current level.
// The next level appears as a dark silhouette to build anticipation.
function renderJourneyMascots() {
  const container = document.getElementById('journeyMascots');
  if (!container) return;

  const mascots = [
    { level: 1, role: 'SM Júnior',    file: 'sm-junior.png',    description: 'Inicia sua jornada ágil com curiosidade e determinação' },
    { level: 2, role: 'SM Pleno',     file: 'sm-pleno.png',     description: 'Aprimora facilitação e conduz cerimônias com confiança' },
    { level: 3, role: 'SM Sênior',    file: 'sm-senior.png',    description: 'Lidera times de alta performance e entrega valor consistente' },
    { level: 4, role: 'Agile Coach',  file: 'agile-coach.png',  description: 'Mentora líderes e transforma culturas organizacionais' },
    { level: 5, role: 'Especialista', file: 'especialista.png', description: 'Referência nacional em agilidade e excelência contínua' }
  ];

  container.innerHTML = mascots.map((mascot) => {
    const status = getMascotState(mascot.level);

    const statusLabel = {
      completed: 'Concluído ✓',
      current:   'Nível atual',
      next:      'Próximo nível',
      locked:     'Bloqueado'
    }[status];

    const stateIcon = {
      completed: '✓',
      current:   '●',
      next:      '?',
      locked:    '🔒'
    }[status];

    // Next level: render image but layer a full silhouette on top via CSS class
    // The image is still there so the silhouette matches the real mascot shape exactly
    const imgTag = `<img class="mascot-image${status === 'next' ? ' mascot-image--shadow' : ''}" src="assets/mascots/${esc(mascot.file)}" alt="${status === 'next' ? 'Próximo nível desbloqueável' : 'Mascote ' + esc(mascot.role)}" loading="lazy">`;

    return `
      <article class="journey-mascot journey-mascot--${status}" data-level="${mascot.level}">
        <div class="mascot-image-wrap">
          ${imgTag}
          <span class="mascot-state">${stateIcon}</span>
          ${status === 'next' ? '<div class="mascot-shadow-label"><svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="6"/><line x1="7" y1="4" x2="7" y2="7"/><line x1="7" y1="10" x2="7.01" y2="10"/></svg> Em breve</div>' : ''}
        </div>
        <div class="mascot-role">${status === 'next' ? '???' : esc(mascot.role)}</div>
        <div class="mascot-description">${status === 'next' ? 'Continue evoluindo para revelar este nível' : esc(mascot.description)}</div>
        <div class="mascot-status">${statusLabel}</div>
      </article>`;
  }).join('');
}

// Shows the logo for visitors and the user's name initials after login.
function renderAccountIdentity() {
  const identity = document.getElementById('avatarInitials');
  if (!identity) return;

  if (!currentUser) {
    identity.textContent = '🙍‍♂️';
    return;
  }

  const first = String(profile.nome || '').trim().charAt(0);
  const last = String(profile.sobrenome || '').trim().charAt(0);
  const fallback = String(currentUser.email || 'GM').split('@')[0].slice(0, 2);
  identity.textContent = (first + last || fallback).toUpperCase();
}

// Renders the complete Journey home screen from the current profile state.
function renderHome() {
  ensureDay();
  renderAuthStrip();

  document.getElementById('xp').textContent = `${profile.xp} XP`;
  document.getElementById('streakTop').textContent = `${profile.streak} dias`;
  renderAccountIdentity();
  const welcomeEl = document.getElementById('welcome');
  if (welcomeEl) welcomeEl.textContent = LEVELS[profile.level - 1].label;
  const levelXPEl = document.getElementById('levelXPLabel');
  if (levelXPEl) levelXPEl.textContent = `${profile.xp} XP acumulados`;

  const weakConcept = getWeakConcept();
  const weakPercentage = weakConcept ? masteryPct(weakConcept) : 0;

  document.getElementById('continueConcept').textContent = weakConcept || 'Treinamento adaptativo';
  document.getElementById('continueQuestion').textContent = weakConcept
    ? 'Questões adaptativas focadas no seu nível'
    : 'Comece um treinamento para continuar sua jornada';
  document.getElementById('continueBar').style.width = `${weakConcept ? Math.max(8, weakPercentage) : 8}%`;
  document.getElementById('continuePct').textContent = weakConcept ? `${weakPercentage}% domínio` : 'Pronto';

  document.getElementById('recommendedConcept').textContent = weakConcept || 'Comece seu treinamento';
  document.getElementById('recommendedPct').textContent = `${weakPercentage}%`;
  document.getElementById('recommendedBar').style.width = `${weakPercentage}%`;

  const dailyDone = profile.daily.date === dayKey() && profile.daily.done;
  document.getElementById('dailyCount').textContent = dailyDone ? '5 de 5 questões' : '0 de 5 questões';
  document.getElementById('dailyBar').style.width = dailyDone ? '100%' : '0%';

  const nextLevel = profile.level < LEVELS.length ? LEVELS[profile.level].label : 'Nível máximo alcançado';
  document.getElementById('nextGoal').textContent = nextLevel;
  document.getElementById('goalText').textContent = profile.level < LEVELS.length
    ? `Avaliação + domínio mínimo de ${REQUIRED_DOMAIN}%`
    : 'Você concluiu toda a jornada';
  document.getElementById('goalBar').style.width = profile.level < LEVELS.length ? '75%' : '100%';
  document.getElementById('goalHint').textContent = profile.level < LEVELS.length
    ? `Requisito geral: ${PROMOTION_SCORE}%`
    : 'Continue praticando para manter o domínio';

  const journey = document.getElementById('journeyTrack');

  // Map level number to mascot file (same order as renderJourneyMascots)
  const trackMascots = [
    { n: 1, file: 'sm-junior.png',    label: 'SM Júnior' },
    { n: 2, file: 'sm-pleno.png',     label: 'SM Pleno' },
    { n: 3, file: 'sm-senior.png',    label: 'SM Sênior' },
    { n: 4, file: 'agile-coach.png',  label: 'Agile Coach' },
    { n: 5, file: 'especialista.png', label: 'Especialista' }
  ];

  journey.innerHTML = trackMascots.map((m) => {
    const stateName = getMascotState(m.n);
    const isSilhouette = stateName === 'next' || stateName === 'locked';
    const label = isSilhouette ? '???' : m.label.replace('Scrum Master ', 'SM ');
    const altText = isSilhouette ? 'Nível bloqueado' : esc(m.label);
    return `<div class="journey-node journey-node--${stateName}">
      <div class="track-mascot-wrap">
        <img class="track-mascot-img" src="assets/mascots/${esc(m.file)}" alt="${altText}" loading="lazy">
        
        ${stateName === 'completed' ? '<div class="track-mascot-check">✓</div>' : ''}
      </div>
      <div class="track-level-num">Lv ${m.n}</div>
      <div class="track-mascot-label">${label}</div>
    </div>`;
  }).join('');

  // levelBadge removido da UI — seção PROGRESSÃO VISUAL eliminada
}

// Renders the Studies catalog from the centralized topic and material data.
function renderStudy() {
  let html = '';

  TOPICS.forEach(([group, concepts]) => {
    concepts.forEach((concept) => {
      const material = MATERIALS[concept];
      const count = BANK.filter((question) => question.concept === concept).length;
      const practiceAction = count > 0
        ? `<button class="btn" type="button" data-c="${encodeURIComponent(concept)}" data-action="study-concept">🧠 Praticar</button>`
        : '';
      if (!material) return;

      html += `
        <div class="study-card">
          <h3 class="study-title">${esc(concept)}</h3>
          <div class="meta">
            <span class="chip">${esc(group)}</span>
            <span class="chip">${count} perguntas</span>
            <span class="chip">${masteryPct(concept)}% domínio</span>
          </div>
          <div class="actions">
            <a class="btn secondary" href="${Security.safeExternalUrl(material[1])}" target="_blank" rel="noopener noreferrer">🎥 Vídeo</a>
            ${practiceAction}
          </div>
        </div>`;
    });
  });

  document.getElementById('studyGrid').innerHTML = html;
}

// Renders profile statistics, history and achievements from validated profile state.
function renderProfile() {
  const accuracy = profile.totalAnswered
    ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
    : 0;

  document.getElementById('profileStats').innerHTML = [
    ['XP', profile.xp],
    ['Precisão', `${accuracy}%`],
    ['Streak máx.', profile.bestStreak],
    ['Promoções', profile.level - 1]
  ].map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('');

  document.getElementById('history').innerHTML = profile.history.length
    ? profile.history.slice(0, 12).map((item) => `
      <div class="row">
        <span>${esc(item.date)} · ${esc(item.mode)}</span>
        <span>${item.correct}/${item.total} · ${item.score}%</span>
      </div>`).join('')
    : '<div class="empty">Seu histórico aparecerá aqui.</div>';

  document.getElementById('achievements').innerHTML = ACH.map((achievement) => {
    const earned = Boolean(profile.achievements[achievement[0]]);
    return `
      <div class="achievement ${earned ? '' : 'lock'}">
        <div class="aicon">${achievement[1]}</div>
        <div><b>${esc(achievement[2])}</b><div class="small muted">${esc(achievement[3])}</div></div>
      </div>`;
  }).join('');
}

// Updates only the global values that are shared by multiple screens.
function updateAll() {
  document.getElementById('xp').textContent = `${profile.xp} XP`;
  renderAuthStrip();
  renderJourneyMascots();
}

// Adds a new achievement once and shows a short notification.
function unlock(id) {
  if (profile.achievements[id]) return;
  profile.achievements[id] = Date.now();
  const achievement = ACH.find((item) => item[0] === id);
  if (achievement) toast(`🏅 ${achievement[2]}`);
}

// Displays a temporary notification without inserting HTML.
function toast(message) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 1600);
}

// Applies numeric progress widths after the DOM has been safely rendered.
function applyProgressWidths(root = document) {
  root.querySelectorAll('[data-width]').forEach((bar) => {
    const percentage = Math.max(0, Math.min(100, Number(bar.dataset.width) || 0));
    bar.style.width = percentage + '%';
  });
}

// Renders aggregated competency metrics in the dedicated Metrics screen.
function renderMetrics() {
  const groups = {};

  BANK.forEach((question) => {
    const group = catGroup(question.concept);
    const data = mastery(question.concept);
    groups[group] = groups[group] || { answered: 0, correct: 0, total: 0 };
    groups[group].answered += data.seen;
    groups[group].correct += data.correct;
    groups[group].total += 1;
  });

  const rows = Object.keys(groups)
    .map((group) => {
      const data = groups[group];
      return {
        group,
        answered: data.answered,
        correct: data.correct,
        total: data.total,
        percentage: data.answered ? Math.round((data.correct / data.answered) * 100) : null
      };
    })
    .sort((a, b) => (a.percentage ?? -1) - (b.percentage ?? -1));

  const precision = profile.totalAnswered
    ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
    : 0;
  const answeredRows = rows.filter((row) => row.answered > 0);
  const totalAnswered = answeredRows.reduce((sum, row) => sum + row.answered, 0);
  const totalCorrect = answeredRows.reduce((sum, row) => sum + row.correct, 0);
  const average = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : null;

  document.getElementById('metricsOverview').innerHTML = [
    ['📊', average === null ? '—' : `${average}%`, 'Domínio médio', 'Apenas competências iniciadas'],
    ['🎯', `${precision}%`, 'Precisão', 'Acertos gerais'],
    ['📝', profile.totalAnswered, 'Questões respondidas', 'Histórico total'],
    ['🔥', `${profile.streak} dias`, 'Streak atual', 'Consistência']
  ].map((item) => `<div class="metric-big"><b>${item[1]}</b><span>${item[2]}</span><div class="metric-note">${item[3]}</div></div>`).join('');

  document.getElementById('metricsSkills').innerHTML = rows.length
    ? rows.map((row) => `
      <div class="skill">
        <div class="skill-name">${esc(row.group)}</div>
        <div class="bar"><i data-width="${row.percentage || 0}"></i></div>
        <div class="pct">${row.percentage === null ? 'Não iniciado' : `${row.percentage}% · ${row.correct}/${row.answered}`}</div>
      </div>`).join('')
    : '<div class="empty">Responda questões para começar a medir seu domínio.</div>';

  const focus = rows.filter((row) => row.percentage === null || row.percentage < 70);
  document.getElementById('metricsFocus').innerHTML = focus.length
    ? focus.map((row) => `
      <div class="metric-focus">
        <b>${esc(row.group)}</b>
        <span>${row.percentage === null ? 'Não iniciado' : `${row.percentage}% · ${row.correct}/${row.answered}`} <button class="btn metric-focus-action" type="button" data-group="${encodeURIComponent(row.group)}" data-action="study-group">Praticar</button></span>
      </div>`).join('')
    : '<div class="empty">Nenhum ponto de atenção no momento. Continue assim.</div>';

  applyProgressWidths(document.getElementById('metricsSkills'));
}
