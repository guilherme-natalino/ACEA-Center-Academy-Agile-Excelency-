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

// Renders the current life state as heart icons; optional shake when one is lost.
function renderLives({ shake = false } = {}) {
  const livesDisplay = document.getElementById('livesState');
  if (!livesDisplay) return;

  const lives = Math.max(0, Number(state.lives ?? MAX_SESSION_LIVES));
  const hearts = Array.from({ length: MAX_SESSION_LIVES }, (_, index) => {
    const active = index < lives;
    return `<span class="life-heart ${active ? '' : 'is-broken'}" aria-hidden="true">${active ? '❤' : '💔'}</span>`;
  }).join('');

  livesDisplay.innerHTML = hearts;
  if (shake) {
    livesDisplay.classList.remove('life-shake');
    void livesDisplay.offsetWidth;
    livesDisplay.classList.add('life-shake');
  }
}

// Renders the current quiz question and safely creates its answer buttons.
function renderQuestion() {
  const question = state.questions[state.idx];
  if (!question) return;

  document.getElementById('modeTag').textContent = getModeLabel(state.mode);
  document.getElementById('qdiff').textContent = getDifficultyLabel(question.diff);
  document.getElementById('qcount').textContent = `${state.idx + 1}/${state.questions.length}`;
  renderLives();
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

  html += `
    <div class="card mission-brief">
      <div class="card-label">🧠 REVISÃO INTELIGENTE</div>
      <h3>Revisar antes de continuar</h3>
      <p class="muted small">O sistema prioriza o conceito mais fraco para você revisar sem perder o ritmo de estudo.</p>
      <button class="btn secondary" type="button" data-action="review-concept">Revisar conceito fraco</button>
    </div>`;

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
    identity.innerHTML = '<svg class="avatar-person-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" aria-label="Entrar ou criar conta"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Zm0 400Z"/></svg>';
    return;
  }

  const first = String(profile.nome || '').trim().charAt(0);
  const last = String(profile.sobrenome || '').trim().charAt(0);
  identity.textContent = `${first || '?'}${last || '?'}`.toUpperCase();
}

// Calculates promotion progress from the user's real answers and required groups.
function promotionProgress() {
  if (profile.level >= LEVELS.length || !profile.totalAnswered) return profile.level >= LEVELS.length ? 100 : 0;

  const generalProgress = Math.min(100, (profile.totalCorrect / profile.totalAnswered) * 100);
  const requiredGroups = REQUIRED_BY_LEVEL[profile.level] || [];
  const groupProgress = requiredGroups.map((group) => {
    const questions = BANK.filter((question) => catGroup(question.concept) === group);
    let seen = 0;
    let correct = 0;
    questions.forEach((question) => {
      const data = mastery(question.concept);
      seen += data.seen;
      correct += data.correct;
    });
    return seen ? Math.min(100, (correct / seen) * 100) : 0;
  });

  const domainProgress = groupProgress.length
    ? Math.min(...groupProgress)
    : 0;
  return Math.round(Math.min(generalProgress / PROMOTION_SCORE, domainProgress / REQUIRED_DOMAIN) * 100);
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
  document.getElementById('continueBar').style.width = `${weakConcept ? weakPercentage : 0}%`;
  document.getElementById('continuePct').textContent = weakConcept ? `${weakPercentage}% domínio` : 'Pronto';

  document.getElementById('recommendedConcept').textContent = weakConcept || 'Comece seu treinamento';
  document.getElementById('recommendedPct').textContent = `${weakPercentage}%`;
  document.getElementById('recommendedBar').style.width = `${weakPercentage}%`;

  const missionList = document.getElementById('dailyMissionList');
  if (missionList) {
    const missions = getDailyMissions();
    missionList.innerHTML = missions.map((mission) => {
      const percent = Math.min(100, Math.round((mission.current / mission.goal) * 100));
      return `
        <div class="mission-item">
          <div class="mission-row">
            <span>${esc(mission.label)}</span>
            <strong>${mission.reward}<em> ·· ${mission.current}/${mission.goal}</em></strong>
          </div>
          <div class="mini-progress"><i style="width:${percent}%"></i></div>
        </div>`;
    }).join('');
  }

  const dailyDone = profile.daily.date === dayKey() && profile.daily.done;
  document.getElementById('dailyCount').textContent = dailyDone ? '5 de 5 questões' : '0 de 5 questões';
  document.getElementById('dailyBar').style.width = dailyDone ? '100%' : '0%';

  const nextLevel = profile.level < LEVELS.length ? LEVELS[profile.level].label : 'Nível máximo alcançado';
  document.getElementById('nextGoal').textContent = nextLevel;
  document.getElementById('goalText').textContent = profile.level < LEVELS.length
    ? profile.level >= 2 && !nextStageLessonsReady(profile.level + 1)
      ? 'Conclua as lições da próxima etapa antes da avaliação'
      : `Avaliação + domínio mínimo de ${REQUIRED_DOMAIN}%`
    : 'Você concluiu toda a jornada';
  document.getElementById('goalBar').style.width = `${promotionProgress()}%`;
  document.getElementById('goalHint').textContent = profile.level < LEVELS.length
    ? profile.level >= 2 && !nextStageLessonsReady(profile.level + 1)
      ? 'Lições da próxima etapa: em andamento'
      : `Requisito geral: ${PROMOTION_SCORE}%`
    : 'Continue praticando para manter o domínio';

  const journey = document.getElementById('journeyTrack');
  journey.style.setProperty('--track-fill', `${journeyProgressPercent()}%`);

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
      const answered = mastery(concept).seen;
      const displayedTotal = answered > 0 ? count : 0;
      const practiceAction = answered > 0
        ? `<button class="btn" type="button" data-c="${encodeURIComponent(concept)}" data-action="study-concept">🧠 Praticar</button>`
        : '';
      if (!material) return;

      html += `
        <div class="study-card">
          <h3 class="study-title">${esc(concept)}</h3>
          <div class="meta">
            <span class="chip">${esc(group)}</span>
            <span class="chip">${answered}/${displayedTotal} respondidas</span>
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
  renderAccountIdentity();
  renderAdminAccess();
}

// Opens the current Sunday-to-Saturday activity calendar for authenticated users.
function renderStreakCalendar() {
  if (!currentUser) {
    document.getElementById('modalBody').innerHTML = '<div class="streak-calendar"><h2>Seu streak</h2><p class="muted">Entre na sua conta para registrar dias de atividade e manter seu histórico.</p><button class="account-cancel" type="button" data-action="close-modal">Fechar</button></div>';
    openModal();
    return;
  }

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const days = names.map((name, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    return { name, number: date.getDate(), key, active: Boolean(profile.activityDays?.[key]), today: key === dayKey() };
  });
  document.getElementById('modalBody').innerHTML = `
    <div class="streak-calendar">
      <div class="streak-calendar-head"><div><span class="eyebrow">ATIVIDADE</span><h2>${profile.streak} dias de streak</h2></div><span class="streak-fire">🔥</span></div>
      <p class="muted small">Use a Academia Agile com sua conta para manter o fogo aceso. Dois dias sem praticar zeram o streak atual.</p>
      <div class="streak-week">${days.map((day) => `<div class="streak-day ${day.active ? 'is-active' : ''} ${day.today ? 'is-today' : ''}"><small>${day.name}</small><b>${day.number}</b><span>${day.active ? '🔥' : '·'}</span></div>`).join('')}</div>
      <div class="streak-best"><span>Maior sequência</span><b>${profile.bestStreak} dias</b></div>
      <button class="account-cancel" type="button" data-action="close-modal">Fechar</button>
    </div>`;
  openModal();
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

// Renders the FAQ for everyone and the ticket workflow for authenticated users.
async function renderSupport() {
  const stateElement = document.getElementById('support-auth-state');
  const form = document.getElementById('supportForm');
  if (!stateElement || !form) return;

  if (!currentUser) {
    stateElement.innerHTML = '<div class="empty support-login-note">Entre na sua conta para abrir um chamado e acompanhar o atendimento.</div>';
    form.hidden = true;
    document.getElementById('supportTickets').innerHTML = '';
    return;
  }

  stateElement.innerHTML = `<div class="support-user-note">Chamado em nome de <b>${esc(currentUser.email || '')}</b></div>`;
  form.hidden = false;
  await renderSupportTickets();
}

let supportTicketsCache = [];

// Shows only tickets owned by the currently authenticated user.
async function renderSupportTickets() {
  const container = document.getElementById('supportTickets');
  if (!container || !currentUser) return;
  const tickets = await sb.getSupportTickets(currentUser.id);
  supportTicketsCache = tickets;
  container.innerHTML = tickets.length
    ? `<div class="section-title">Meus chamados</div><div class="support-ticket-list">${tickets.map((ticket) => `
      <button class="support-ticket" type="button" data-action="open-support-ticket" data-ticket-id="${esc(ticket.id)}"><span><b>${esc(ticket.subject)}</b><small>${esc(ticket.category)} · ${esc(ticket.status)} · ${esc(ticket.created_at)}</small></span><strong>›</strong></button>`).join('')}</div>`
    : '';
}

// Shows the admin navigation only for the verified owner account.
function renderAdminAccess() {
  const button = document.getElementById('nav-admin');
  if (button) button.hidden = !isAdminUser();
}

// Renders all tickets for the restricted administrator and allows responses.
async function renderAdmin() {
  const container = document.getElementById('adminContent');
  const filters = document.getElementById('adminFilters');
  if (!container) return;
  if (!isAdminUser()) {
    container.innerHTML = '<div class="empty">Acesso não autorizado.</div>';
    if (filters) filters.hidden = true;
    return;
  }
  if (filters) {
    filters.hidden = false;
    filters.innerHTML = `<label class="admin-filter-search-wrap" for="adminSearch"><span aria-hidden="true">⌕</span><input class="admin-filter-search" id="adminSearch" type="search" placeholder="Pesquisar chamados" aria-label="Buscar chamados"></label><label class="admin-filter-field"><span>Status</span><select id="adminStatusFilter" class="admin-filter-select"><option value="all">Todos os status</option><option value="open">Abertos</option><option value="answered">Respondidos</option><option value="closed">Fechados</option></select></label><label class="admin-filter-field"><span>Categoria</span><select id="adminCategoryFilter" class="admin-filter-select"><option value="all">Todas as categorias</option><option value="bug">Bugs</option><option value="account">Conta</option><option value="progress">Progresso</option><option value="suggestion">Sugestões</option><option value="other">Outros</option></select></label>`;
  }
  container.innerHTML = '<div class="empty">Carregando chamados...</div>';
  try {
    const tickets = await sb.getAdminTickets();
    window.adminTicketsCache = tickets;
    renderAdminTicketList(tickets);
    filters?.querySelectorAll('input, select').forEach((field) => field.addEventListener('input', () => renderAdminTicketList(tickets)));
    filters?.querySelectorAll('select').forEach((field) => field.addEventListener('change', () => renderAdminTicketList(tickets)));
  } catch (error) {
    Security.log('Admin tickets load failed', { message: error.message });
    container.innerHTML = '<div class="auth-error show">Não foi possível carregar os chamados. Verifique se as regras Firestore atualizadas foram publicadas e se seu email está verificado.</div>';
  }
}

function renderAdminTicketList(tickets) {
  const container = document.getElementById('adminContent');
  const search = String(document.getElementById('adminSearch')?.value || '').toLowerCase();
  const status = document.getElementById('adminStatusFilter')?.value || 'all';
  const category = document.getElementById('adminCategoryFilter')?.value || 'all';
  const filtered = tickets.filter((ticket) => {
    const matchesSearch = !search || `${ticket.subject || ''} ${ticket.email || ''} ${ticket.description || ''}`.toLowerCase().includes(search);
    return matchesSearch && (status === 'all' || ticket.status === status) && (category === 'all' || ticket.category === category);
  });
  const openCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const filterSummary = `<div class="admin-summary">${tickets.length} chamados · <b>${openCount} em aberto</b></div>`;
  container.innerHTML = filterSummary + (filtered.length
      ? filtered.map((ticket) => `
        <article class="admin-ticket">
          <div class="admin-ticket-meta"><span class="tag">${esc(ticket.status || 'open')}</span><span>${esc(ticket.category || '')}</span><span>${esc(ticket.email || '')}</span><small>${esc(ticket.created_at || '')}</small></div>
          <h3>${esc(ticket.subject || '')}</h3>
          <p>${esc(ticket.description || '')}</p>
          ${ticket.response ? `<div class="support-detail-block support-response has-response"><b>Resposta enviada</b><p>${esc(ticket.response)}</p></div>` : ''}
          ${ticket.requester_reply ? `<div class="support-detail-block support-response has-response"><b>Resposta do solicitante</b><p>${esc(ticket.requester_reply)}</p></div>` : ''}
          ${ticket.status === 'closed' ? '<div class="support-closed-note">Chamado encerrado. Somente consulta.</div>' : `<textarea class="admin-response" rows="4" data-ticket-response="${esc(ticket.id)}" placeholder="Escreva a resposta para o solicitante...">${esc(ticket.response || '')}</textarea><button class="btn" type="button" data-action="admin-respond" data-ticket-id="${esc(ticket.id)}">Salvar resposta</button>`}
        </article>`).join('')
      : '<div class="empty">Nenhum chamado corresponde aos filtros.</div>');
}

async function respondToSupportTicket(ticketId) {
  const ticket = (window.adminTicketsCache || []).find((item) => item.id === ticketId);
  const field = document.querySelector(`[data-ticket-response="${CSS.escape(ticketId)}"]`);
  if (!ticket || !field) return;
  const response = field.value.trim();
  if (response.length < 3) { toast('Escreva uma resposta antes de salvar.'); return; }
  await sb.updateAdminTicket(ticket, response, 'answered');
  toast('Resposta salva para o solicitante.');
  renderAdmin();
}

// Opens the selected ticket with its description and the team's response.
function openSupportTicket(ticketId) {
  const ticket = supportTicketsCache.find((item) => item.id === ticketId);
  if (!ticket) return;
  const response = String(ticket.response || '').trim();
  const requesterReply = String(ticket.requester_reply || '').trim();
  document.getElementById('modalBody').innerHTML = `
    <div class="support-ticket-detail">
      <div class="support-ticket-detail-head"><span class="tag">${esc(ticket.status || 'open')}</span><span>${esc(ticket.category || '')}</span></div>
      <h2>${esc(ticket.subject)}</h2>
      <small>${esc(ticket.created_at || '')}</small>
      <div class="support-detail-block"><b>Descrição enviada</b><p>${esc(ticket.description || '')}</p></div>
      <div class="support-detail-block support-response ${response ? 'has-response' : ''}"><b>Resposta da equipe</b><p>${response ? esc(response) : 'Aguardando atendimento da equipe.'}</p></div>
      ${requesterReply ? `<div class="support-detail-block support-response has-response"><b>Resposta do solicitante</b><p>${esc(requesterReply)}</p></div>` : ''}
      ${ticket.status === 'closed'
        ? '<div class="support-closed-note">Chamado encerrado. Não são permitidas novas respostas ou alterações.</div>'
        : response ? `
          <div class="support-reply-box">
            <label class="auth-label" for="requesterReply">Responder ao atendimento</label>
            <textarea class="auth-input support-textarea" id="requesterReply" rows="4" maxlength="2000" placeholder="Escreva sua resposta para a equipe...">${esc(ticket.requester_reply || '')}</textarea>
            <button class="btn" type="button" data-action="support-user-reply" data-ticket-id="${esc(ticket.id)}">Responder chamado</button>
          </div>
        ` : ''}
      ${ticket.status === 'closed' ? '' : '<button class="btn support-close-ticket" type="button" data-action="close-support-ticket" data-ticket-id="' + esc(ticket.id) + '">Encerrar chamado</button>'}
      <button class="account-cancel" type="button" data-action="close-modal">Fechar</button>
    </div>`;
  openModal();
}

async function closeSupportTicket(ticketId) {
  const ticket = supportTicketsCache.find((item) => item.id === ticketId);
  if (!ticket || !confirm('Encerrar este chamado? Depois disso ele não poderá mais ser alterado.')) return;
  const result = await sb.closeSupportTicket(ticket);
  if (!result.ok) { toast(result.reason || 'Não foi possível encerrar o chamado.'); return; }
  closeModal();
  toast('Chamado encerrado.');
  renderSupportTickets();
}
