// Controller: user events, navigation, authentication orchestration and boot.
// Business data/rules live in model.js. DOM rendering lives in view.js.

let pendingDataChoice = null;
let notificationTimer = null;
let appNotifications = [];
let activeScreenId = null;

// Repairs the known owner profile identity without affecting other accounts.
function normalizeOwnerIdentity() {
  if (!currentUser || currentUser.email.toLowerCase() !== 'guilhermealisson14@hotmail.com') return false;
  const changed = profile.nome !== 'Guilherme' || profile.sobrenome !== 'Natalino';
  if (changed) {
    profile.nome = 'Guilherme';
    profile.sobrenome = 'Natalino';
  }
  return changed;
}

// Opens the account menu for an authenticated user.
function showAuthMenu() {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  const first = String(profile.nome || '').trim().charAt(0);
  const last = String(profile.sobrenome || '').trim().charAt(0);
  const initials = `${first || '?'}${last || '?'}`.toUpperCase();
  const displayName = [profile.nome, profile.sobrenome].filter(Boolean).join(' ') || 'Conta conectada';
  const analyticsEnabled = Boolean(profile.analyticsConsent);

  document.getElementById('modalBody').innerHTML = `
    <div class="account-panel">
      <div class="account-header">
        <div class="account-avatar">${esc(initials)}</div>
        <div class="account-identity">
          <h2>${esc(displayName)}</h2>
          <p>${esc(currentUser.email || '')}</p>
        </div>
        <span class="account-status"><i></i> Ativo</span>
      </div>

      <div class="account-section-label">CONTA</div>
      <div class="analytics-panel">
        <div class="analytics-heading">
          <span class="account-action-icon analytics-icon">⌁</span>
          <div>
            <b>Analytics de uso</b>
            <p>Ajuda a entender quais telas são usadas e onde melhorar a plataforma.</p>
          </div>
          <span class="analytics-state">${analyticsEnabled ? 'Ativo' : 'Desativado'}</span>
        </div>
        <p class="analytics-detail">Coleta métricas de navegação e interação. Não é necessário para estudar, salvar progresso ou usar sua conta.</p>
        <button class="analytics-toggle ${analyticsEnabled ? 'is-on' : ''}" type="button" data-action="toggle-analytics" aria-pressed="${analyticsEnabled}">
          <span class="toggle-track"><i></i></span>
          <span>${analyticsEnabled ? 'Desativar Analytics' : 'Ativar Analytics'}</span>
        </button>
      </div>

      <div class="account-divider"></div>
      <button class="account-action account-action--danger" type="button" data-action="delete-account">
        <span class="account-action-icon">⌫</span><span><b>Excluir conta</b><small>Remove sua conta e seus dados salvos</small></span><span class="account-chevron">›</span>
      </button>
      <button class="account-action" type="button" data-action="signout">
        <span class="account-action-icon">↪</span><span><b>Sair da conta</b><small>Encerrar esta sessão neste dispositivo</small></span><span class="account-chevron">›</span>
      </button>
      <button class="account-cancel" type="button" data-action="close-modal">Cancelar</button>
    </div>`;

  openModal();
}

function renderNotifications() {
  const list = appNotifications.length
    ? appNotifications.map((item) => `<div class="notification-item"><b>${esc(item.title)}</b><p>${esc(item.message)}</p></div>`).join('')
    : '<div class="empty">Nenhuma notificação nova.</div>';
  document.getElementById('modalBody').innerHTML = `<div class="notification-panel"><h2>Notificações</h2>${list}<button class="account-cancel" type="button" data-action="close-modal">Fechar</button></div>`;
  appNotifications = [];
  updateNotificationBadge();
  openModal();
}

function updateNotificationBadge() {
  const badge = document.getElementById('notificationCount');
  if (!badge) return;
  badge.textContent = String(appNotifications.length);
  badge.hidden = appNotifications.length === 0;
}

async function pollNotifications() {
  if (!currentUser) return;
  try {
    if (isAdminUser()) {
      const tickets = await sb.getAdminTickets();
      const key = 'admin-notification-tickets';
      const previous = JSON.parse(localStorage.getItem(key) || '[]');
      const current = tickets.map((ticket) => ticket.id);
      if (previous.length) tickets.filter((ticket) => !previous.includes(ticket.id)).forEach((ticket) => appNotifications.push({ title: 'Novo chamado', message: `${ticket.subject} · ${ticket.email}` }));
      const detailKey = 'admin-notification-ticket-details';
      const previousDetails = JSON.parse(localStorage.getItem(detailKey) || '{}');
      const currentDetails = {};
      tickets.forEach((ticket) => {
        const marker = `${ticket.status || ''}:${ticket.requester_reply || ''}:${ticket.response || ''}`;
        currentDetails[ticket.id] = marker;
        if (previousDetails[ticket.id] && previousDetails[ticket.id] !== marker && ticket.requester_reply) {
          appNotifications.push({ title: 'Nova resposta do solicitante', message: `${ticket.subject} · ${ticket.email}` });
        }
      });
      localStorage.setItem(key, JSON.stringify(current));
      localStorage.setItem(detailKey, JSON.stringify(currentDetails));
    } else {
      const tickets = await sb.getSupportTickets(currentUser.id);
      const key = `support-notification-responses-${currentUser.id}`;
      const previous = JSON.parse(localStorage.getItem(key) || '{}');
      const current = {};
      tickets.forEach((ticket) => {
        const marker = `${ticket.status || ''}:${ticket.response || ''}`;
        current[ticket.id] = marker;
        if (previous[ticket.id] && previous[ticket.id] !== marker && ticket.response) appNotifications.push({ title: 'Chamado respondido', message: ticket.subject });
      });
      localStorage.setItem(key, JSON.stringify(current));
      const lastActive = Object.keys(profile.activityDays || {}).sort().pop();
      if (lastActive === dayKey()) localStorage.removeItem('streak-risk-notified');
      else if (lastActive && isYesterday(lastActive, dayKey()) && localStorage.getItem('streak-risk-notified') !== dayKey()) {
        appNotifications.push({ title: 'Seu streak está em risco', message: 'Pratique hoje para manter sua sequência de dias.' });
        localStorage.setItem('streak-risk-notified', dayKey());
      }
    }
    updateNotificationBadge();
  } catch (error) {
    Security.log('Notification polling failed', { message: error.message });
  }
}

// Opens the login/register dialog with no inline event handlers or inline CSS.
function showAuthModal() {
  document.getElementById('modalBody').innerHTML = `
    <div class="auth-modal">
      <div class="auth-header">
        <img src="assets/favicon.png" class="auth-logo" alt="Academia Agile">
        <div>
          <h2 class="auth-title">Academia Agile</h2>
          <p class="auth-subtitle">Sua jornada para a excelência</p>
        </div>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab auth-tab--active" id="btnL" type="button" data-auth-mode="login">Entrar</button>
        <button class="auth-tab" id="btnR" type="button" data-auth-mode="register">Criar conta</button>
      </div>

      <div class="auth-form" id="formLogin">
        <div class="auth-field">
          <label class="auth-label" for="aEmail">Email</label>
          <div class="auth-input-wrap">
            <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2 7l8 5 8-5"/></svg>
            <input class="auth-input" id="aEmail" type="email" placeholder="seu@email.com" autocomplete="email" maxlength="254">
          </div>
        </div>
        <div class="auth-field">
          <label class="auth-label" for="aPass">Senha</label>
          <div class="auth-input-wrap">
            <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="9" width="14" height="10" rx="2"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>
            <input class="auth-input" id="aPass" type="password" placeholder="Mínimo de 8 caracteres" autocomplete="current-password" minlength="8" maxlength="128">
            <button class="password-toggle" type="button" data-action="toggle-password" data-password-target="aPass" aria-label="Mostrar senha">◉</button>
          </div>
        </div>
        <button class="auth-link" type="button" data-action="forgot-password">Esqueci minha senha</button>
        <div id="aErr" class="auth-error" role="alert"></div>
        <button class="auth-submit" id="aBtn" type="button" data-action="submit-auth">
          <span>Entrar</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 10h12M12 6l4 4-4 4"/></svg>
        </button>
      </div>

      <div class="auth-form auth-form--hidden" id="formRegister">
        <div class="auth-row">
          <div class="auth-field">
            <label class="auth-label" for="rNome">Nome</label>
            <div class="auth-input-wrap">
              <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="7" r="3"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
              <input class="auth-input" id="rNome" type="text" placeholder="Seu nome" maxlength="60">
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="rSobrenome">Sobrenome</label>
            <div class="auth-input-wrap">
              <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="7" r="3"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
              <input class="auth-input" id="rSobrenome" type="text" placeholder="Seu sobrenome" maxlength="60">
            </div>
          </div>
        </div>
        <div class="auth-field">
          <label class="auth-label" for="rEmail">Email</label>
          <div class="auth-input-wrap">
            <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2 7l8 5 8-5"/></svg>
            <input class="auth-input" id="rEmail" type="email" placeholder="seu@email.com" autocomplete="email" maxlength="254">
          </div>
        </div>
        <div class="auth-field">
          <label class="auth-label" for="rUnidade">Unidade de Serviço</label>
          <div class="auth-input-wrap auth-input-wrap--select">
            <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="16" height="14" rx="2"/><path d="M6 7h8M6 10h8M6 13h5"/></svg>
            <select class="auth-input auth-select" id="rUnidade">
              <option value="" disabled selected>Selecione sua área</option>
              <optgroup label="Engenharia">
                <option value="desenvolvimento">🖥️ Desenvolvimento</option>
                <option value="frontend">🎨 Frontend</option>
                <option value="backend">⚙️ Backend</option>
                <option value="mobile">📱 Mobile</option>
                <option value="fullstack">🔀 Fullstack</option>
                <option value="qa">🧪 QA / Qualidade</option>
                <option value="dados">📊 Dados / Analytics</option>
              </optgroup>
              <optgroup label="Infraestrutura & Operações">
                <option value="devops">🚀 DevOps</option>
                <option value="sre">🛡️ SRE</option>
                <option value="cloud">☁️ Cloud</option>
                <option value="seguranca">🔒 Segurança / SecOps</option>
                <option value="infra">🖧 Infraestrutura</option>
              </optgroup>
              <optgroup label="Produto & Agilidade">
                <option value="produto">📦 Produto</option>
                <option value="ux">🎯 UX / Design</option>
                <option value="multi-times">🏢 Multi-times / Tribo</option>
                <option value="agile-coaching">🧭 Agile Coaching</option>
                <option value="scrum-master">🔄 Scrum Master</option>
              </optgroup>
              <optgroup label="Negócio">
                <option value="financeiro">💰 Financeiro / Fintech</option>
                <option value="comercial">📈 Comercial</option>
                <option value="rh">👥 RH / Pessoas</option>
                <option value="juridico">⚖️ Jurídico / Compliance</option>
                <option value="outro">🔧 Outro</option>
              </optgroup>
            </select>
            <svg class="auth-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>
          </div>
        </div>
        <div class="auth-row">
          <div class="auth-field">
            <label class="auth-label" for="rPass">Senha</label>
            <div class="auth-input-wrap">
              <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="9" width="14" height="10" rx="2"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>
              <input class="auth-input" id="rPass" type="password" placeholder="Mínimo de 8 caracteres" autocomplete="new-password" minlength="8" maxlength="128">
              <button class="password-toggle" type="button" data-action="toggle-password" data-password-target="rPass" aria-label="Mostrar senha">◉</button>
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="rPass2">Confirmar senha</label>
            <div class="auth-input-wrap">
              <svg class="auth-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="9" width="14" height="10" rx="2"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>
              <input class="auth-input" id="rPass2" type="password" placeholder="Repita a senha" autocomplete="new-password" minlength="8" maxlength="128">
              <button class="password-toggle" type="button" data-action="toggle-password" data-password-target="rPass2" aria-label="Mostrar senha">◉</button>
            </div>
          </div>
        </div>
        <label class="consent-check" for="rConsent">
          <input id="rConsent" type="checkbox">
          <span>Li e aceito a <a href="data-policy.html" target="_blank" rel="noopener noreferrer">Política de Privacidade e Termos de Uso</a>.</span>
        </label>
        <label class="consent-check" for="rAdult">
          <input id="rAdult" type="checkbox">
          <span>Confirmo que tenho 18 anos ou mais.</span>
        </label>
        <label class="consent-check" for="rAnalytics">
          <input id="rAnalytics" type="checkbox">
          <span>Concordo opcionalmente com o uso de métricas de navegação para melhorar a plataforma.</span>
        </label>
        <div id="rErr" class="auth-error" role="alert"></div>
        <button class="auth-submit" id="rBtn" type="button" data-action="submit-register">
          <span>Criar minha conta</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 10h12M12 6l4 4-4 4"/></svg>
        </button>
      </div>
    </div>`;

  openModal();
  window._authMode = 'login';
}

// Sends a password reset email without revealing whether the address is registered.
async function forgotPassword() {
  const email = Security.safeEmail(document.getElementById('aEmail')?.value);
  const errorElement = document.getElementById('aErr');
  if (!email) {
    errorElement.textContent = 'Informe um email válido para receber o link de recuperação.';
    errorElement.classList.add('show');
    return;
  }

  const response = await sb.resetPassword(email);
  if (response.error && !/user-not-found/i.test(response.error.message || '')) {
    errorElement.textContent = 'Não foi possível enviar o email agora. Tente novamente.';
    errorElement.classList.add('show');
    return;
  }

  errorElement.className = 'auth-success show';
  errorElement.textContent = 'Se o email estiver cadastrado, você receberá um link para redefinir a senha.';
}

// Reports whether a profile contains meaningful study progress.
function hasProgress(data) {
  return Boolean(data && (data.totalAnswered > 0 || data.xp > 0 || Object.keys(data.mastery || {}).length));
}

// Asks which profile should win when a guest session and cloud data both exist.
function showDataChoice(cloudData, sessionProfile) {
  pendingDataChoice = { cloudData, sessionProfile };
  document.getElementById('modalBody').innerHTML = `
    <div class="data-choice">
      <div class="data-choice-icon">⇄</div>
      <div class="data-choice-heading">
        <span class="eyebrow">SINCRONIZAÇÃO</span>
        <h2>Escolha o progresso</h2>
        <p>Encontramos duas versões da sua jornada. Escolha qual deve continuar na conta.</p>
      </div>
      <div class="data-choice-actions">
        <button class="data-choice-option data-choice-option--primary" type="button" data-action="use-cloud-data">
          <span class="data-choice-option-icon">☁</span><span><b>Usar progresso da nuvem</b><small>Continuar de onde você parou em outros dispositivos.</small></span><strong>›</strong>
        </button>
        <button class="data-choice-option" type="button" data-action="keep-session-data">
          <span class="data-choice-option-icon">◷</span><span><b>Manter esta sessão</b><small>Usar apenas o progresso feito agora neste dispositivo.</small></span><strong>›</strong>
        </button>
      </div>
      <p class="data-choice-note">A escolha será aplicada a esta conta. O progresso não escolhido não será enviado.</p>
      <button class="account-cancel" type="button" data-action="close-modal">Decidir depois</button>
    </div>`;
  openModal();
}

// Resolves the explicit choice between cloud and current-session progress.
async function resolveDataChoice(choice) {
  if (!pendingDataChoice) return;
  const selection = pendingDataChoice;
  pendingDataChoice = null;
  if (choice === 'cloud') applyCloudData(selection.cloudData);
  else {
    profile = selection.sessionProfile;
    await syncToCloud();
  }
  if (normalizeOwnerIdentity()) await syncToCloud();
  closeModal();
  renderHome();
  renderProfile();
  renderMetrics();
  updateAll();
}

// Opens the modal and updates its accessibility state.
function openModal() {
  const modal = document.getElementById('modal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

// Closes the modal and restores its accessibility state.
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

// Allows users to close ticket details with Escape or by clicking the backdrop.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

document.getElementById('modal')?.addEventListener('click', (event) => {
  if (event.target.id === 'modal') closeModal();
});

// Switches between login and registration modes in the authentication dialog.
function setAuthMode(mode) {
  window._authMode = mode === 'register' ? 'register' : 'login';
  const isLogin = window._authMode === 'login';
  document.getElementById('btnL').className = isLogin ? 'auth-tab auth-tab--active' : 'auth-tab';
  document.getElementById('btnR').className = isLogin ? 'auth-tab' : 'auth-tab auth-tab--active';
  document.getElementById('formLogin').className    = isLogin ? 'auth-form' : 'auth-form auth-form--hidden';
  document.getElementById('formRegister').className = isLogin ? 'auth-form auth-form--hidden' : 'auth-form';
}

// Sends login or registration data to Firebase after local validation.
async function submitAuth() {
  const emailInput = document.getElementById('aEmail');
  const passwordInput = document.getElementById('aPass');
  const errorElement = document.getElementById('aErr');
  const button = document.getElementById('aBtn');
  const email = Security.safeEmail(emailInput?.value);
  const password = passwordInput?.value || '';

  if (!email || !Security.validPassword(password)) {
    errorElement.textContent = 'Informe um email válido e uma senha entre 8 e 128 caracteres.';
    errorElement.classList.add('show');
    return;
  }

  const btnSpan = button.querySelector('span'); if (btnSpan) btnSpan.textContent = 'Aguardando...'; else button.textContent = 'Aguardando...';
  button.disabled = true;
  errorElement.classList.remove('show');

  try {
    let response;

    if (window._authMode === 'login') {
      response = await sb.signIn(email, password);
      if (response.error) {
        errorElement.textContent = friendlyAuthError(response.error.message);
        errorElement.classList.add('show');
        const sp3 = button.querySelector('span'); if (sp3) sp3.textContent = 'Entrar'; else button.textContent = 'Entrar';
        button.disabled = false;
        return;
      }

      currentUser = Security.parseStoredUser(JSON.stringify(response.user));
      if (!currentUser) throw new Error('Sessão inválida retornada pelo provedor.');
      renderAdminAccess();

      if (!profile.nome && currentUser.displayName) {
        const nameParts = currentUser.displayName.trim().split(/\s+/);
        profile.nome = nameParts.shift() || '';
        profile.sobrenome = nameParts.join(' ');
      }

      localStorage.setItem('firebase_user', JSON.stringify(currentUser));
      const sessionProfile = Security.normalizeProfile(profile);
      const cloudData = await fetchCloudData();
      const cloudHasProgress = Boolean(cloudData && (hasProgress(cloudData.profile) || cloudData.masteryRows.length));
      if (cloudHasProgress && hasProgress(sessionProfile)) {
        showDataChoice(cloudData, sessionProfile);
        return;
      }
      if (cloudHasProgress) applyCloudData(cloudData);
      else if (cloudData?.profile) applyCloudData(cloudData);
      else await syncToCloud();
    } else {
      response = await sb.signUp(email, password);
      if (response.error) {
        errorElement.textContent = friendlyAuthError(response.error.message);
        errorElement.classList.add('show');
        const sp4 = button.querySelector('span'); if (sp4) sp4.textContent = 'Criar minha conta'; else button.textContent = 'Criar minha conta';
        button.disabled = false;
        return;
      }

      currentUser = Security.parseStoredUser(JSON.stringify(response.user));
      if (currentUser) {
        localStorage.setItem('firebase_user', JSON.stringify(currentUser));
        await syncToCloud();
      }
    }

    if (normalizeOwnerIdentity()) await syncToCloud();
    closeModal();
    toast('✅ Bem-vindo, ' + email.split('@')[0] + '!');
    renderHome();
    renderProfile();
    updateAll();
  } catch (error) {
    Security.log('Authentication flow failed', { message: error.message });
    errorElement.textContent = 'Não foi possível concluir a operação. Tente novamente.';
    errorElement.classList.add('show');
  } finally {
    button.disabled = false;
    const sp2 = button.querySelector('span'); if (sp2) sp2.textContent = 'Entrar'; else button.textContent = 'Entrar';
  }
}

// Converts provider error messages into safe, user-friendly messages.
function friendlyAuthError(message) {
  const text = String(message || '');
  if (/user-not-found|invalid-credential/i.test(text)) return 'E-mail não encontrado ou inexistente.';
  if (/invalid|credentials/i.test(text)) return 'Email ou senha incorretos.';
  if (/email not confirmed/i.test(text)) return 'Confirme seu email antes de entrar.';
  if (/already/i.test(text)) return 'Este email já possui uma conta.';
  return 'Não foi possível autenticar. Verifique os dados e tente novamente.';
}

function togglePassword(targetId, trigger) {
  const input = document.getElementById(targetId);
  if (!input) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  trigger.textContent = visible ? '◉' : '◌';
  trigger.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
}

// Clears draft support data whenever the user leaves and returns to Help.
function resetSupportForm() {
  const form = document.getElementById('supportForm');
  if (!form) return;
  form.reset();
  const label = document.getElementById('supportCategoryLabel');
  const icon = document.querySelector('.support-category-icon');
  const menu = document.getElementById('supportCategoryMenu');
  if (label) label.textContent = 'Reportar bug';
  if (icon) icon.textContent = '🐞';
  if (menu) menu.hidden = true;
  document.querySelector('.support-combobox-trigger')?.setAttribute('aria-expanded', 'false');
  const error = document.getElementById('supportError');
  if (error) { error.className = 'auth-error'; error.textContent = ''; }
}

// Ends the cloud session and restores the last local profile safely.
async function doSignOut() {
  closeModal();
  await sb.signOut();
  clearInterval(notificationTimer);
  notificationTimer = null;
  appNotifications = [];
  updateNotificationBadge();
  currentUser = null;
  localStorage.removeItem('analytics-consent');
  setAnalyticsConsent(false);
  profile = defaultProfile();
  renderHome();
  renderProfile();
  updateAll();
  toast('Sessão encerrada.');
}

// Loads the profile from localStorage after schema and range validation.
function loadLocalProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem('agile-academy-v3') || 'null');
    return Security.normalizeProfile(stored || defaultProfile());
  } catch (error) {
    Security.log('Invalid local profile discarded');
    return defaultProfile();
  }
}

// Changes the visible application screen and renders only what that screen needs.
function showScreen(id) {
  const allowedScreens = new Set(['home', 'study', 'metrics', 'profile', 'support', 'admin', 'quiz', 'result']);
  const screenId = allowedScreens.has(id) ? id : 'home';

  if (activeScreenId && activeScreenId !== screenId && (activeScreenId === 'support' || screenId === 'support')) resetSupportForm();
  activeScreenId = screenId;

  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === screenId);
  });

  const navigationId = screenId === 'quiz' || screenId === 'result' ? 'home' : screenId;
  document.querySelectorAll('.nav button').forEach((button) => {
    button.classList.toggle('active', button.id === `nav-${navigationId}`);
  });

  if (screenId === 'home') renderHome();
  if (screenId === 'study') renderStudy();
  if (screenId === 'metrics') renderMetrics();
  if (screenId === 'profile') renderProfile();
  if (screenId === 'support') renderSupport();
  if (screenId === 'admin') renderAdmin();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Opens the quiz screen and renders its first question.
function openQuiz() {
  showScreen('quiz');
  renderQuestion();
}

// Validates the selected answer against controller-owned quiz state, then records the result.
function answer(button) {
  const position = Number(button.dataset.pos);
  const question = state.questions[state.idx];
  const order = Array.isArray(state.optionOrder) ? state.optionOrder : [];
  const correctPosition = Number(state.correctPosition);

  if (!question || !Number.isInteger(position) || position < 0 || position > 3 || order.length !== 4) return;

  document.querySelectorAll('.opt').forEach((option) => { option.disabled = true; });
  const options = document.querySelectorAll('.opt');
  if (options[correctPosition]) options[correctPosition].classList.add('correct');

  const isCorrect = position === correctPosition;
  if (!isCorrect) {
    button.classList.add('wrong');
    state.lives = Math.max(0, Number(state.lives ?? MAX_SESSION_LIVES) - 1);
    renderLives({ shake: true });
  }

  const masteryData = mastery(question.concept);
  const previousPercentage = masteryPct(question.concept);
  masteryData.seen += 1;

  if (isCorrect) {
    masteryData.correct += 1;
    state.sessionCorrect += 1;
    state.sessionStreak += 1;
    profile.totalCorrect += 1;
  } else {
    state.sessionStreak = 0;
    masteryData.recovery = (masteryData.recovery || 0) + 1;
    profile.recovered += 1;
  }

  masteryData.last = Date.now();
  profile.totalAnswered += 1;
  recordActivity();

  const correctIndex = order[correctPosition];
  const answerIndex = order[position];
  state.results.push({
    q: question,
    ok: isCorrect,
    correctTxt: question.opts[correctIndex],
    yourTxt: question.opts[answerIndex]
  });

  const material = materialFor(question);
  const feedback = document.getElementById('feedback');
  feedback.className = 'feedback show';
  feedback.innerHTML = `
    <div class="fb ${isCorrect ? 'ok' : 'err'}">
      <h4>${isCorrect ? `✅ Correto! +${xpFor(question)} XP` : '❌ Não desta vez — revise o conceito'}</h4>
      <div class="small feedback-explanation">${esc(question.exp || '')}</div>
      <a class="material" href="${material.url}" target="_blank" rel="noopener noreferrer">
        <div class="play">▶</div>
        <div><b>🎥 ${esc(material.title)}</b><small>Material: ${esc(question.concept)}</small></div>
        <div class="material-arrow">↗</div>
      </a>
      ${isCorrect ? '' : `
        <div class="recovery-video">
          <iframe src="${material.embedUrl}" title="${esc(material.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div class="small recovery-note">🩹 Assista ao vídeo para revisar este conceito; a próxima recuperação será considerada no seu domínio.</div>`}
    </div>`;

  addXP(isCorrect ? xpFor(question) : 5);
  unlock('first');
  if (profile.totalAnswered >= 25) unlock('marathon');
  if (profile.totalAnswered >= 100) unlock('centurion');
  if (state.sessionStreak >= 5) unlock('streak5');
  if (state.sessionStreak >= 10) unlock('streak10');
  if (profile.streak >= 7) unlock('streak7');
  if (profile.streak >= 5) unlock('streakDays5');
  if (profile.streak >= 10) unlock('streakDays10');
  if (profile.streak >= 50) unlock('streakDays50');
  if (startedCompetencies() >= 5) unlock('explorer');
  if (masteryPct(question.concept) >= 90) unlock('master90');
  if (masteryPct(question.concept) - previousPercentage >= 30) unlock('turnaround');
  if (allCompetenciesMastered(70)) unlock('polymath');
  if (!isCorrect && masteryData.recovery >= 10) unlock('recover10');

  const nextButton = document.getElementById('nextBtn');
  nextButton.style.display = 'block';
  if (!isCorrect && state.lives <= 0) {
    nextButton.textContent = 'Revisar conceito →';
    toast('💔 Sem vidas nesta rodada. Revise o conceito fraco antes de continuar.');
  } else {
    nextButton.textContent = state.idx < state.questions.length - 1 ? 'Próxima →' : 'Ver resultado →';
  }
  save();
}

function reviewWeakConcept() {
  const weakConcept = getWeakConcept();
  if (!weakConcept) {
    startTraining();
    return;
  }

  const pool = BANK.filter((question) => question.concept === weakConcept).sort((a, b) => a.diff - b.diff);
  state = {
    mode: 'recommended',
    questions: uniquePick(pool, Math.min(6, pool.length)),
    idx: 0,
    results: [],
    sessionCorrect: 0,
    sessionStreak: 0,
    lives: MAX_SESSION_LIVES,
    optionOrder: [],
    correctPosition: 0
  };
  markSeen(state.questions);
  save();
  openQuiz();
  toast(`🩹 Revisão focada em ${weakConcept}`);
}

// Advances to the next question or closes the session when the last question is reached.
function nextQuestion() {
  if (!state.questions.length) return;
  const hasNoLives = Number(state.lives ?? MAX_SESSION_LIVES) <= 0;
  if (hasNoLives && document.getElementById('nextBtn')?.textContent?.includes('Revisar')) {
    reviewWeakConcept();
    return;
  }

  if (state.idx < state.questions.length - 1) {
    state.idx += 1;
    renderQuestion();
    return;
  }

  finishSession();
}

// Finalizes a session, evaluates promotion rules and persists the outcome.
async function finishSession() {
  const total = state.questions.length;
  if (!total) return;

  const correct = state.sessionCorrect;
  const score = Math.round((correct / total) * 100);
  if (score === 100) unlock('perfect');

  if (state.mode === 'daily') {
    profile.daily = { date: dayKey(), done: true, score };
    addXP(100);
  }

  if (currentUser) {
    try {
      await sb.insertSession({
        user_id: currentUser.id,
        mode: state.mode,
        score,
        correct,
        total,
        xp_earned: profile.xp
      });
    } catch (error) {
      Security.log('Session persistence failed', { message: error.message });
    }
  }

  if (state.mode === 'exam') {
    profile.promotionCount += 1;
    const requiredGroups = REQUIRED_BY_LEVEL[profile.level] || [];
    const competencies = requiredGroups.map((group) => {
      const results = state.results.filter((result) => catGroup(result.q.concept) === group);
      const percentage = results.length
        ? Math.round((results.filter((result) => result.ok).length / results.length) * 100)
        : 0;
      return { g: group, pc: percentage };
    });

    const lessonsReady = profile.level < 2 || nextStageLessonsReady(profile.level + 1);
    const passed = score >= PROMOTION_SCORE
      && competencies.every((item) => item.pc >= REQUIRED_DOMAIN)
      && lessonsReady;
    if (passed && profile.level < LEVELS.length) {
      profile.level += 1;
      addXP(250);
      unlock('coach');
    }

    showResult(score, competencies, passed);
  } else {
    profile.trainingCount += 1;
    profile.history.unshift({
      date: new Date().toLocaleDateString('pt-BR'),
      mode: state.mode,
      score,
      correct,
      total,
      xp: profile.xp
    });
    profile.history = profile.history.slice(0, 20);
    showResult(score, [], false);
  }

  save();
}

// Starts a focused session for one concept selected by the Studies screen.
function studyConcept(encodedConcept) {
  const concept = decodeURIComponent(encodedConcept || '');
  const pool = BANK.filter((question) => question.concept === concept);
  if (!pool.length) return;

  state = {
    mode: 'recommended',
    questions: uniquePick(pool, Math.min(8, pool.length)),
    idx: 0,
    results: [],
    sessionCorrect: 0,
    sessionStreak: 0,
    optionOrder: [],
    correctPosition: 0
  };
  markSeen(state.questions);
  save();
  openQuiz();
}

// Starts a focused session for all questions in one competency group.
function studyGroup(encodedGroup) {
  const group = decodeURIComponent(encodedGroup || '');
  const pool = BANK.filter((question) => catGroup(question.concept) === group);
  if (!pool.length) return;

  state = {
    mode: 'recommended',
    questions: uniquePick(pool, Math.min(8, pool.length)),
    idx: 0,
    results: [],
    sessionCorrect: 0,
    sessionStreak: 0,
    optionOrder: [],
    correctPosition: 0
  };
  markSeen(state.questions);
  save();
  openQuiz();
}

// Resets local and cloud progress after explicit user confirmation.
async function resetProgress() {
  if (!confirm('Zerar todo o progresso?')) return;

  const identity = {
    nome: profile.nome,
    sobrenome: profile.sobrenome,
    unidade: profile.unidade,
    analyticsConsent: profile.analyticsConsent,
    consentVersion: profile.consentVersion,
    consentAt: profile.consentAt
  };

  try {
    if (currentUser) {
      await sb.clearProgress(currentUser.id);
      await sb.upsertProfile({
        user_id: currentUser.id,
        level: 1,
        xp: 0,
        streak: 0,
        best_streak: 0,
        last_day: null,
        total_answered: 0,
        total_correct: 0,
        recovered: 0,
        achievements: {},
        daily: {},
        training_count: 0,
        promotion_count: 0,
        nome: identity.nome,
        sobrenome: identity.sobrenome,
        unidade: identity.unidade,
        analytics_consent: identity.analyticsConsent,
        consent_version: identity.consentVersion,
        consent_at: identity.consentAt
      });
    }
  } catch (error) {
    Security.log('Progress reset failed', { message: error.message });
    toast('Não foi possível zerar o progresso agora.');
    return;
  }

  profile = { ...defaultProfile(), ...identity };
  save();
  showScreen('home');
}

// Handles navigation and button actions through event delegation.
document.addEventListener('click', (event) => {
  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) {
    showScreen(screenButton.dataset.screen);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  const categoryOption = event.target.closest('[data-support-value]');
  if (categoryOption) {
    selectSupportCategory(categoryOption.dataset.supportValue, categoryOption);
    return;
  }
  if (!actionButton) return;

  switch (actionButton.dataset.action) {
    case 'training': startTraining(); break;
    case 'exam': startExam(); break;
    case 'daily': startDaily(); break;
    case 'recommended': startRecommended(); break;
    case 'review-concept': reviewWeakConcept(); break;
    case 'next': nextQuestion(); break;
    case 'reset': resetProgress(); break;
    case 'auth-menu': currentUser ? showAuthMenu() : showAuthModal(); break;
    case 'notifications': renderNotifications(); break;
    case 'streak-calendar': renderStreakCalendar(); break;
    case 'slack-community': window.open('https://slack.com/', '_blank', 'noopener,noreferrer'); break;
    case 'auth-modal': showAuthModal(); break;
    case 'close-modal': closeModal(); break;
    case 'submit-auth': submitAuth(); break;
    case 'toggle-password': togglePassword(actionButton.dataset.passwordTarget, actionButton); break;
    case 'forgot-password': forgotPassword(); break;
    case 'submit-register': submitRegister(); break;
    case 'signout': doSignOut(); break;
    case 'study-concept': studyConcept(actionButton.dataset.c); break;
    case 'study-group': studyGroup(actionButton.dataset.group); break;
    case 'open-support-ticket': openSupportTicket(actionButton.dataset.ticketId); break;
    case 'close-support-ticket': closeSupportTicket(actionButton.dataset.ticketId); break;
    case 'support-user-reply': submitRequesterReply(actionButton.dataset.ticketId); break;
    case 'admin-respond': respondToSupportTicket(actionButton.dataset.ticketId); break;
    case 'toggle-support-category': toggleSupportCategory(actionButton); break;
    case 'use-cloud-data': resolveDataChoice('cloud'); break;
    case 'keep-session-data': resolveDataChoice('session'); break;
    case 'toggle-analytics': toggleAnalytics(); break;
    case 'delete-account': deleteAccount(); break;
    case 'answer': answer(actionButton); break;
    default: break;
  }
});

function toggleSupportCategory(trigger) {
  const menu = document.getElementById('supportCategoryMenu');
  if (!menu) return;
  const isOpen = !menu.hidden;
  menu.hidden = isOpen;
  trigger.setAttribute('aria-expanded', String(!isOpen));
}

function selectSupportCategory(value, option) {
  const select = document.getElementById('supportCategory');
  const label = document.getElementById('supportCategoryLabel');
  const trigger = document.querySelector('.support-combobox-trigger');
  const menu = document.getElementById('supportCategoryMenu');
  const icon = option?.querySelector('span');
  const text = option?.querySelector('b');
  if (!select || !label || !trigger || !menu) return;
  select.value = value;
  label.textContent = text?.textContent || value;
  const triggerIcon = trigger.querySelector('.support-category-icon');
  if (triggerIcon && icon) triggerIcon.textContent = icon.textContent;
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
}

// Sends a support ticket after validating the authenticated user's input.
async function submitRequesterReply(ticketId) {
  const ticket = supportTicketsCache.find((item) => item.id === ticketId);
  if (!ticket) return;
  const field = document.getElementById('requesterReply');
  const reply = field ? field.value.trim() : '';
  if (!reply || reply.length < 3) {
    toast('Escreva uma resposta antes de enviar.');
    return;
  }

  const result = await sb.submitRequesterReply(ticket, reply);
  if (!result.ok) {
    toast(result.reason || 'Não foi possível enviar sua resposta.');
    return;
  }

  closeModal();
  toast('Resposta enviada para a equipe.');
  renderSupportTickets();
}

async function submitSupportTicket(event) {
  event.preventDefault();
  const errorElement = document.getElementById('supportError');
  const submitButton = document.querySelector('#supportForm button[type="submit"]');
  const subject = document.getElementById('supportSubject').value.trim();
  const description = document.getElementById('supportDescription').value.trim();
  if (!currentUser) return;
  errorElement.className = 'auth-error';
  if (subject.length < 3) {
    errorElement.textContent = 'Informe um assunto com pelo menos 3 caracteres.';
    errorElement.classList.add('show');
    return;
  }
  if (description.length < 15) {
    errorElement.textContent = 'Descreva o problema com pelo menos 15 caracteres.';
    errorElement.classList.add('show');
    return;
  }
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = 'Enviando...';
  }

  try {
    const response = await sb.createSupportTicket({
      category: document.getElementById('supportCategory').value,
      subject,
      description,
      status: 'open',
      created_at: new Date().toISOString()
    });
    if (!response) throw new Error('Não foi possível salvar o chamado.');

    const emailResult = await sb.sendSupportEmail(response);
    document.getElementById('supportForm').reset();
    errorElement.className = 'auth-success show';
    errorElement.textContent = emailResult.sent
      ? `Chamado #${response.id.slice(0, 8)} criado e enviado para nossa equipe por email.`
      : `Chamado #${response.id.slice(0, 8)} criado no sistema, mas o email não foi enviado. Motivo: ${emailResult.reason || 'erro desconhecido'}`;
    renderSupportTickets();
  } catch (error) {
    Security.log('Support ticket submission failed', { message: error.message });
    errorElement.className = 'auth-error show';
    errorElement.textContent = 'Não foi possível criar o chamado. Verifique sua conexão e tente novamente.';
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.querySelector('span').textContent = 'Enviar chamado';
    }
  }
}

document.getElementById('supportForm')?.addEventListener('submit', submitSupportTicket);

// Handles login/register mode changes in the authentication dialog.
document.addEventListener('click', (event) => {
  const modeButton = event.target.closest('[data-auth-mode]');
  if (modeButton) setAuthMode(modeButton.dataset.authMode);
});

// Handles new account registration with full field validation.
async function submitRegister() {
  const nome      = document.getElementById('rNome')?.value?.trim() || '';
  const sobrenome = document.getElementById('rSobrenome')?.value?.trim() || '';
  const email     = Security.safeEmail(document.getElementById('rEmail')?.value);
  const unidade   = document.getElementById('rUnidade')?.value || '';
  const pass      = document.getElementById('rPass')?.value || '';
  const pass2     = document.getElementById('rPass2')?.value || '';
  const consent   = document.getElementById('rConsent')?.checked === true;
  const adult     = document.getElementById('rAdult')?.checked === true;
  const analytics = document.getElementById('rAnalytics')?.checked === true;
  const errorEl   = document.getElementById('rErr');
  const button    = document.getElementById('rBtn');
  const btnSpan   = button?.querySelector('span');

  errorEl.classList.remove('show');

  if (!nome)    { errorEl.textContent = 'Informe seu nome.'; errorEl.classList.add('show'); return; }
  if (!email)   { errorEl.textContent = 'Informe um email válido.'; errorEl.classList.add('show'); return; }
  if (!unidade) { errorEl.textContent = 'Selecione sua unidade de serviço.'; errorEl.classList.add('show'); return; }
  if (!Security.validPassword(pass)) { errorEl.textContent = 'A senha deve ter entre 8 e 128 caracteres.'; errorEl.classList.add('show'); return; }
  if (pass !== pass2) { errorEl.textContent = 'As senhas não coincidem.'; errorEl.classList.add('show'); return; }
  if (!consent) { errorEl.textContent = 'Aceite a Política de Privacidade e os Termos de Uso para criar sua conta.'; errorEl.classList.add('show'); return; }
  if (!adult) { errorEl.textContent = 'A Academia Agile é destinada apenas a pessoas maiores de 18 anos.'; errorEl.classList.add('show'); return; }

  if (btnSpan) btnSpan.textContent = 'Criando conta...';
  if (button) button.disabled = true;

  try {
    const response = await sb.signUp(email, pass);
    if (response.error) {
      errorEl.textContent = friendlyAuthError(response.error.message);
      errorEl.classList.add('show');
      return;
    }
    currentUser = Security.parseStoredUser(JSON.stringify(response.user));
    if (currentUser) {
      profile.nome      = nome;
      profile.sobrenome = sobrenome;
      profile.unidade   = unidade;
      profile.consentVersion = '1.0';
      profile.consentAt = new Date().toISOString();
      profile.analyticsConsent = analytics;
      setAnalyticsConsent(analytics);
      if (firebaseAuth.currentUser?.updateProfile) await firebaseAuth.currentUser.updateProfile({ displayName: `${nome} ${sobrenome}`.trim() });
      localStorage.setItem('firebase_user', JSON.stringify(currentUser));
      await syncToCloud();
    }
    closeModal();
    toast('✅ Conta criada! Bem-vindo, ' + nome + '!');
    renderHome();
    renderProfile();
    updateAll();
  } catch (error) {
    Security.log('Register failed', { message: error.message });
    errorEl.textContent = 'Não foi possível criar a conta. Tente novamente.';
    errorEl.classList.add('show');
  } finally {
    if (button) button.disabled = false;
    if (btnSpan) btnSpan.textContent = 'Criar minha conta';
  }
}

// Changes optional analytics consent without affecting account functionality.
async function toggleAnalytics() {
  profile.analyticsConsent = !profile.analyticsConsent;
  setAnalyticsConsent(profile.analyticsConsent);
  await syncToCloud();
  showAuthMenu();
}

// Deletes the authenticated account and all user-owned Firestore documents.
async function deleteAccount() {
  if (!currentUser || !confirm('Excluir sua conta e todos os seus dados? Esta ação não pode ser desfeita.')) return;
  try {
    await sb.deleteAccount(currentUser.id);
    clearInterval(notificationTimer);
    notificationTimer = null;
    appNotifications = [];
    updateNotificationBadge();
    currentUser = null;
    profile = defaultProfile();
    closeModal();
    renderHome();
    renderProfile();
    renderMetrics();
    updateAll();
    toast('Conta e dados excluídos.');
  } catch (error) {
    Security.log('Account deletion failed', { message: error.code || error.message });
    toast('Não foi possível excluir agora. Faça login novamente e tente de novo.');
  }
}

// Boots the application, restores local data, then checks the cloud session.
async function boot() {
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    localStorage.removeItem('agile-academy-v3');
    profile = defaultProfile();
    showScreen('home');
    ensureDay();
    renderStudy();
    renderProfile();
    renderMetrics();
    updateAll();
    window.scrollTo(0, 0);

    await loadAuth();
    if (currentUser) {
      const loaded = await loadFromCloud();
      if (loaded) {
        if (normalizeOwnerIdentity()) await syncToCloud();
        recordActivity();
        checkActivityAchievements();
        save();
        renderHome();
        renderProfile();
        renderMetrics();
        updateAll();
      }
    }
    await pollNotifications();
    clearInterval(notificationTimer);
    notificationTimer = setInterval(pollNotifications, 60000);
  } catch (error) {
    Security.log('Boot failed', { message: error.message });
  }
}

boot();
