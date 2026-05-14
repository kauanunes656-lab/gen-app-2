/* ════════════════════════════════════════════════════════
   GEN — Sistema de Evolução Pessoal
   app.js — lógica completa (PWA + RPG + UI premium)
   ════════════════════════════════════════════════════════ */

'use strict';

// ───────────────────────────────────────────────────────
// PWA — SERVICE WORKER REGISTRATION
// ───────────────────────────────────────────────────────
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => {
        console.log('[GEN] SW registrado:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Nova versão disponível! Recarregue o app.', 'info');
            }
          });
        });
      })
      .catch(err => console.warn('[GEN] SW erro:', err));
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const dismissed = localStorage.getItem('gen_install_dismissed');
  if (!dismissed) {
    setTimeout(() => {
      const banner = el('pwa-install-banner');
      if (banner) banner.classList.add('show');
    }, 3000);
  }
  updateInstallBtn();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  dismissInstall();
  showToast('🎉 GEN instalado! Acesse pelo ícone.', 'success');
  updateInstallBtn();
});

function triggerInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') showToast('Instalando GEN...', 'success');
      deferredInstallPrompt = null;
      dismissInstall();
      updateInstallBtn();
    });
  } else {
    const statusEl = el('install-status');
    if (statusEl) {
      if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        statusEl.textContent = '✅ App já está instalado!';
      } else if (isIOS()) {
        statusEl.textContent = 'No iPhone: toque em Compartilhar ⬆️ → "Adicionar à Tela de Início".';
      } else {
        statusEl.textContent = 'Use "Adicionar à tela inicial" no menu do navegador.';
      }
    }
  }
}

function dismissInstall() {
  const banner = el('pwa-install-banner');
  if (banner) {
    banner.style.transition = 'transform .3s ease, opacity .3s';
    banner.style.transform = 'translateY(120%)';
    banner.style.opacity = '0';
    setTimeout(() => { banner.classList.remove('show'); banner.style.transform=''; banner.style.opacity=''; }, 320);
  }
  localStorage.setItem('gen_install_dismissed', '1');
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function updateInstallBtn() {
  const btn = el('install-btn-profile');
  const status = el('install-status');
  if (!btn) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) {
    btn.textContent = '✅ App Instalado';
    btn.disabled = true;
    if (status) status.textContent = 'Rodando em modo standalone!';
  } else if (isIOS()) {
    btn.textContent = '📲 Adicionar à Tela de Início';
    if (status) status.textContent = 'No iPhone: toque em Compartilhar ⬆️ → "Adicionar à Tela de Início".';
  } else if (!deferredInstallPrompt) {
    btn.textContent = '📲 Instalar via Menu do Navegador';
    if (status) status.textContent = 'Use "Adicionar à tela inicial" no menu do navegador.';
  } else {
    btn.textContent = '📲 Instalar no Dispositivo';
    if (status) status.textContent = '';
  }
}

// ───────────────────────────────────────────────────────
// CONSTANTS
// ───────────────────────────────────────────────────────
const RANKS = [
  {min:1,  name:'Gênese',    icon:'🌱'},
  {min:5,  name:'Aprendiz',  icon:'⚡'},
  {min:10, name:'Discípulo', icon:'🔥'},
  {min:20, name:'Guardião',  icon:'🛡️'},
  {min:30, name:'Mestre',    icon:'⚔️'},
  {min:50, name:'Elite',     icon:'👑'},
  {min:75, name:'Campeão',   icon:'💎'},
  {min:100,name:'Lenda',     icon:'🏆'},
];
const XP_PER_LEVEL = lvl => Math.floor(100 * Math.pow(1.15, lvl - 1));
const CAT_COLORS = {
  'alimentação':'#ff6b35','transporte':'#4ecdc4','assinaturas':'#a8e063',
  'lazer':'#f7dc6f','investimentos':'#00f5ff','estudos':'#bf5fff',
  'saúde':'#00ff88','salário':'#00ff88','outros':'#8892b0'
};
const MOTIVATIONAL = [
  '"O sucesso é a soma de pequenos esforços repetidos dia após dia."',
  '"Disciplina é fazer o que precisa ser feito, mesmo quando não quer."',
  '"Cada dia é uma nova chance de ser melhor do que ontem."',
  '"Sua única competição é a versão de você de ontem."',
  '"Grandes realizações começam com pequenas ações consistentes."',
  '"Não espere a motivação. Aja e ela virá."',
  '"O segredo do sucesso está na sua rotina diária."',
  '"Evolução não é um evento. É um processo."',
  '"Quem planta com consistência, colhe com abundância."',
  '"Você é o resultado dos hábitos que mantém."',
];

// ───────────────────────────────────────────────────────
// AUTH SYSTEM
// ───────────────────────────────────────────────────────
const AUTH_STORE_KEY = 'gen_users_v1';
const SESSION_KEY    = 'gen_session_v1';

function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = Math.imul(31, h) + pw.charCodeAt(i) | 0;
  return 'H' + Math.abs(h).toString(36) + pw.length.toString(36);
}
function getUsers() { try { return JSON.parse(localStorage.getItem(AUTH_STORE_KEY)) || {}; } catch(e) { return {}; } }
function saveUsers(u) { localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(u)); }
function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) { return null; } }
function saveSession(email) { localStorage.setItem(SESSION_KEY, JSON.stringify({email, ts: Date.now()})); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function userDataKey(email) { return 'gen_data_' + btoa(email.toLowerCase()).replace(/=/g,''); }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function doLogin() {
  const email = el('login-email').value.trim().toLowerCase();
  const pw    = el('login-password').value;
  el('login-error').classList.remove('show');
  if (!email || !pw) return showAuthError('login', 'Preencha todos os campos');
  if (!isValidEmail(email)) return showAuthError('login', 'Email inválido');
  const users = getUsers();
  if (!users[email]) return showAuthError('login', 'Conta não encontrada. Crie uma!');
  if (users[email].pw !== hashPassword(pw)) return showAuthError('login', 'Senha incorreta');
  saveSession(email);
  startApp(email, users[email].name);
}

function doRegister() {
  const name    = el('reg-name').value.trim();
  const email   = el('reg-email').value.trim().toLowerCase();
  const pw      = el('reg-password').value;
  const confirm = el('reg-confirm').value;
  el('register-error').classList.remove('show');
  if (!name || !email || !pw || !confirm) return showAuthError('register', 'Preencha todos os campos');
  if (!isValidEmail(email)) return showAuthError('register', 'Email inválido');
  if (pw.length < 6) return showAuthError('register', 'Senha deve ter mínimo 6 caracteres');
  if (pw !== confirm) return showAuthError('register', 'As senhas não coincidem');
  const users = getUsers();
  if (users[email]) return showAuthError('register', 'Este email já está cadastrado');
  users[email] = { name, pw: hashPassword(pw), createdAt: Date.now() };
  saveUsers(users);
  saveSession(email);
  startApp(email, name);
  showToast('Conta criada! Bem-vindo ao GEN!', 'success');
}

function showAuthError(form, msg) {
  const errId = form === 'login' ? 'login-error' : 'register-error';
  const msgId = form === 'login' ? 'login-error-msg' : 'register-error-msg';
  el(msgId).textContent = msg;
  el(errId).classList.add('show');
}

function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  el('auth-' + tab + '-form').classList.add('active');
  if (btn) btn.classList.add('active');
  el('login-error').classList.remove('show');
  el('register-error').classList.remove('show');
}

function startApp(email, name) {
  currentUserEmail = email;
  const saved = localStorage.getItem(userDataKey(email));
  if (saved) {
    try { state = {...defaultState(), ...JSON.parse(saved)}; }
    catch(e) { state = defaultState(); }
  } else {
    state = defaultState();
    state.name = name;
  }
  state.name = state.name || name;
  checkDailyReset();
  document.body.setAttribute('data-theme', state.theme || 'cyber');
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === (state.theme || 'cyber'));
  });
  if (!state.installDate) { state.installDate = Date.now(); save(); }

  el('auth-screen').classList.add('hidden');
  el('app').style.display = 'flex';
  el('fab-btn').style.display = 'none';
  el('chip-email').textContent = email;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  el('screen-dashboard').classList.add('active');
  el('nav-dashboard').classList.add('active');
  currentTab = 'dashboard';

  spawnHeroParticles();
  refreshAll();
  setTimeout(() => {
    const xpNeeded = XP_PER_LEVEL(state.level);
    el('dash-xp-bar').style.width = Math.min((state.xp / xpNeeded) * 100, 100) + '%';
  }, 350);

  initNotifications();
  updateNotifStatusBadge();
  updateInstallBtn();
}

function doLogout() {
  showConfirm('Sair da conta', 'Deseja sair? Seus dados ficam salvos.', () => {
    clearSession();
    currentUserEmail = null;
    el('auth-screen').classList.remove('hidden');
    el('app').style.display = 'none';
    el('login-email').value = '';
    el('login-password').value = '';
    el('login-error').classList.remove('show');
    clearNotifTimers();
    showToast('Sessão encerrada', 'info');
  });
}

function createAuthParticles() {
  const container = el('auth-particles');
  if (!container) return;
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'auth-particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `left:${Math.random()*100}%;width:${size}px;height:${size}px;animation-duration:${8+Math.random()*12}s;animation-delay:${Math.random()*10}s;opacity:0;`;
    container.appendChild(p);
  }
}

function spawnHeroParticles() {
  const c = el('hero-particles');
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    const size = 2 + Math.random()*3;
    s.style.cssText = `left:${Math.random()*100}%;width:${size}px;height:${size}px;animation-duration:${10+Math.random()*14}s;animation-delay:${Math.random()*12}s;`;
    c.appendChild(s);
  }
}

// ───────────────────────────────────────────────────────
// STATE & STORAGE
// ───────────────────────────────────────────────────────
let currentUserEmail = null;

function defaultState() {
  return {
    name: 'Gênio', avatar: '🧬', xp: 0, level: 1, totalXp: 0,
    habits: [], transactions: [], goals: [], studies: [],
    theme: 'cyber', weeklyActivity: [0,0,0,0,0,0,0],
    lastReset: new Date().toDateString(), installDate: null,
    streak: 0, lastStreakDate: null,
  };
}

let state = defaultState();

function save() {
  if (!currentUserEmail) return;
  localStorage.setItem(userDataKey(currentUserEmail), JSON.stringify(state));
}

function checkDailyReset() {
  const today = new Date().toDateString();
  if (state.lastReset !== today) {
    const todayIdx = new Date().getDay();
    const doneCount = state.habits.filter(h=>h.done).length;
    state.weeklyActivity[todayIdx] = doneCount;

    // Streak: se fez ao menos 1 hábito ontem, mantém; senão reseta
    if (doneCount > 0) {
      // já registrou ontem? trataremos no toggleHabit
    }
    state.habits.forEach(h => h.done = false);
    state.lastReset = today;
    save();
  }
}

function bumpStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (state.lastStreakDate === today) return;
  if (state.lastStreakDate === yesterday) state.streak = (state.streak||0) + 1;
  else state.streak = 1;
  state.lastStreakDate = today;
  save();
}

// ───────────────────────────────────────────────────────
// NOTIFICATION SYSTEM
// ───────────────────────────────────────────────────────
let notifTimers = [];

const NOTIF_MESSAGES = [
  { title:'⚡ GEN — Hora dos Hábitos!', body:'Você ainda não completou seus hábitos hoje. Continue sua evolução!' },
  { title:'🧬 GEN — Evolução em andamento', body:'Cada pequeno passo conta. Que tal marcar um hábito agora?' },
  { title:'💰 GEN — Finanças', body:'Registre suas transações para manter o controle financeiro.' },
  { title:'📚 GEN — Hora de estudar!', body:'Seu progresso nos estudos está esperando por você.' },
  { title:'🎯 GEN — Suas metas', body:'Atualize o progresso das suas metas e continue avançando!' },
  { title:'⚔️ GEN — Guerreiro!', body:'Você ainda não ganhou XP hoje. Não quebre sua sequência!' },
];

function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('Notificações não suportadas', 'error'); return; }
  Notification.requestPermission().then(perm => {
    updateNotifStatusBadge();
    if (perm === 'granted') {
      showToast('Notificações ativadas! 🔔', 'success');
      el('notif-perm-card').style.display = 'none';
      scheduleNotifications();
      try { new Notification('🧬 GEN ativado!', { body: 'Você receberá lembretes para manter sua evolução.' }); } catch(e){}
    } else {
      showToast('Permissão negada. Ative nas configurações.', 'error');
    }
  });
}

function scheduleNotifications() {
  clearNotifTimers();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const intervals = [
    {delay:3600000,msg:0},{delay:10800000,msg:1},{delay:21600000,msg:2},
    {delay:43200000,msg:3},{delay:64800000,msg:4},{delay:79200000,msg:5},
  ];
  intervals.forEach(({delay,msg}) => {
    notifTimers.push(setTimeout(() => sendScheduledNotif(msg), delay));
  });
  const pending = state.habits.filter(h => !h.done).length;
  if (pending > 0) {
    notifTimers.push(setTimeout(() => {
      sendNotification('⚡ GEN — Hábitos Pendentes', `Você tem ${pending} hábito${pending>1?'s':''} pendente${pending>1?'s':''} hoje!`);
    }, 900000));
  }
}

function sendScheduledNotif(idx) { const m = NOTIF_MESSAGES[idx%NOTIF_MESSAGES.length]; sendNotification(m.title, m.body); }

function sendNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, vibrate:[200,100,200] });
    el('notif-dot').classList.add('show');
  } catch(e) {}
}

function sendTestNotification() {
  if (!('Notification' in window)) return showToast('Notificações não disponíveis', 'error');
  if (Notification.permission === 'default') return requestNotifPermission();
  if (Notification.permission === 'denied') return showToast('Notificações bloqueadas.', 'error');
  const m = NOTIF_MESSAGES[Math.floor(Math.random()*NOTIF_MESSAGES.length)];
  sendNotification(m.title, m.body);
  showToast('Notificação de teste enviada!', 'success');
}

function toggleNotifPanel() {
  el('notif-dot').classList.remove('show');
  switchTab('profile');
  setTimeout(() => el('screen-perfil').scrollTop = 0, 100);
}
function clearNotifTimers() { notifTimers.forEach(t => clearTimeout(t)); notifTimers = []; }

function initNotifications() {
  if (!('Notification' in window)) return;
  updateNotifStatusBadge();
  const perm = Notification.permission;
  if (perm === 'default') el('notif-perm-card').style.display = 'flex';
  else if (perm === 'granted') { el('notif-perm-card').style.display = 'none'; scheduleNotifications(); }
  const lastNotif = localStorage.getItem('gen_last_notif');
  const today = new Date().toDateString();
  if (perm === 'granted' && lastNotif !== today) {
    localStorage.setItem('gen_last_notif', today);
    setTimeout(() => {
      const pending = state.habits.filter(h => !h.done).length;
      if (pending > 0) sendNotification('🌅 GEN — Bom dia, Guerreiro!', `Você tem ${pending} hábito${pending>1?'s':''} para completar hoje. Vamos evoluir!`);
      else if (state.habits.length === 0) sendNotification('🌱 GEN — Comece hoje!', 'Crie seus primeiros hábitos e inicie sua jornada de evolução.');
    }, 5000);
  }
}

function updateNotifStatusBadge() {
  const badge = el('notif-status-badge');
  if (!badge) return;
  if (!('Notification' in window)) { badge.textContent = 'Não suportado'; badge.className = 'badge badge-danger'; }
  else if (Notification.permission === 'granted') { badge.textContent = '✅ Ativas'; badge.className = 'badge badge-success'; }
  else if (Notification.permission === 'denied') { badge.textContent = '🚫 Bloqueadas'; badge.className = 'badge badge-danger'; }
  else { badge.textContent = '⚠️ Pendente'; badge.className = 'badge badge-gold'; }
}

// ───────────────────────────────────────────────────────
// RPG SYSTEM
// ───────────────────────────────────────────────────────
function getRank(level) {
  let rank = RANKS[0];
  for (const r of RANKS) { if (level >= r.min) rank = r; else break; }
  return rank;
}

function addXP(amount) {
  state.xp += amount;
  state.totalXp += amount;
  let leveled = false;
  while (state.xp >= XP_PER_LEVEL(state.level)) {
    state.xp -= XP_PER_LEVEL(state.level);
    state.level++;
    leveled = true;
  }
  save();
  refreshAll();
  if (leveled) showLevelUp();
}

function showLevelUp() {
  const rank = getRank(state.level);
  el('levelup-level').textContent = state.level;
  el('levelup-rank').textContent = rank.icon + ' ' + rank.name;
  el('levelup-msg').textContent = `Você chegou ao nível ${state.level}!`;
  document.querySelector('.levelup-icon').textContent = rank.icon;
  el('levelup-popup').classList.add('show');
  spawnLevelUpParticles();
  sendNotification('⚡ LEVEL UP!', `Você atingiu o nível ${state.level} — ${rank.icon} ${rank.name}!`);
  if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
}

function spawnLevelUpParticles() {
  const container = el('levelup-particles');
  if (!container) return;
  container.innerHTML = '';
  const emojis = ['⚡','🌟','✨','💫','🔥','⭐'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    const tx = (Math.random() - 0.5) * 240;
    const ty = -Math.random() * 220 - 50;
    p.style.cssText = `position:absolute;top:50%;left:50%;font-size:${14+Math.random()*12}px;pointer-events:none;--tx:${tx}px;--ty:${ty}px;animation:xpParticle ${0.8+Math.random()*0.6}s ${Math.random()*0.3}s ease-out forwards;`;
    p.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    container.appendChild(p);
  }
}

function closeLevelUp() { el('levelup-popup').classList.remove('show'); }

// ───────────────────────────────────────────────────────
// NAV
// ───────────────────────────────────────────────────────
let currentTab = 'dashboard';

function switchTab(tab) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const screenId = tab === 'profile' ? 'perfil' : tab;
  const sc = el('screen-' + screenId);
  if (sc) sc.classList.add('active');
  const nb = el('nav-' + (tab === 'profile' ? 'perfil' : tab));
  if (nb) nb.classList.add('active');
  currentTab = tab;
  refreshAll();
  const fab = el('fab-btn');
  fab.style.display = ['habitos','estudos'].includes(tab) ? 'flex' : 'none';
  if (tab === 'profile') { updateNotifStatusBadge(); updateInstallBtn(); }
  // Scroll to top do screens
  el('screens').scrollTo({top:0, behavior:'smooth'});
}

function fabAction() {
  if (currentTab === 'habitos') openHabitModal();
  else if (currentTab === 'estudos') openStudyModal();
}

// ───────────────────────────────────────────────────────
// REFRESH
// ───────────────────────────────────────────────────────
function refreshAll() {
  updateXpDisplay();
  renderDashboard();
  renderHabits();
  renderTransactions();
  renderGoals(goalsFilter);
  renderStudy(studyFilter);
  renderProfile();
}

function updateXpDisplay() {
  const xpNeeded = XP_PER_LEVEL(state.level);
  const pct = Math.min((state.xp / xpNeeded) * 100, 100);
  const rank = getRank(state.level);
  el('dash-level').textContent = state.level;
  el('dash-xp-label').textContent = `${state.xp} / ${xpNeeded} XP`;
  el('dash-xp-bar').style.width = pct + '%';
  el('dash-rank-badge').textContent = rank.icon + ' ' + rank.name;
  const heroRank = el('hero-rank'); if (heroRank) heroRank.textContent = rank.icon + ' ' + rank.name;
  if (state.avatar && state.avatar.startsWith && state.avatar.startsWith('data:')) {
    el('dash-avatar').innerHTML = `<img src="${state.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    el('dash-avatar').textContent = state.avatar || '🧬';
  }
}

// ───────────────────────────────────────────────────────
// DASHBOARD (refatorado)
// ───────────────────────────────────────────────────────
function renderDashboard() {
  // Frase motivacional rotativa
  const idx = new Date().getDay();
  el('motivational-card').textContent = MOTIVATIONAL[idx % MOTIVATIONAL.length];

  // Quick stats: Streak / Nível / XP Total
  const daysSinceInstall = Math.floor((Date.now() - (state.installDate || Date.now())) / 86400000) + 1;
  const streakValue = state.streak || daysSinceInstall;
  animateNumber('stat-streak', streakValue);
  animateNumber('stat-level', state.level);
  animateNumber('stat-totalxp', state.totalXp);

  // Financeiro
  const inc = state.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+t.value,0);
  const exp = state.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.value,0);
  el('dash-balance').textContent = fmtMoney(inc - exp);
  el('dash-income').textContent = fmtMoney(inc).replace('R$ ','');
  el('dash-expense').textContent = fmtMoney(exp).replace('R$ ','');

  // Mission diária — próximo hábito não feito (ou criar primeiro)
  renderMission();

  // Progresso semanal (ring)
  renderWeeklyRing();

  // Atributos principais
  renderAttributes();

  // Hábitos preview
  const preview = el('dash-habits-preview');
  const toShow = state.habits.slice(0, 3);
  if (!toShow.length) {
    preview.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:14px;">Nenhum hábito criado ainda.</div>';
  } else {
    preview.innerHTML = toShow.map(h => `
      <div class="habit-item ${h.done?'done':''}">
        <div class="habit-check">${h.done?'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div class="habit-name">${escapeHTML(h.name)}</div>
        <div class="habit-xp">+${h.xp}XP</div>
      </div>
    `).join('');
  }
  animateGreeting();
}

function renderMission() {
  const card = el('mission-card');
  const badge = el('mission-badge');
  const total = state.habits.length;
  const done = state.habits.filter(h=>h.done).length;
  badge.textContent = `${done}/${total}`;
  if (!total) {
    el('mission-icon').textContent = '🚀';
    el('mission-title').textContent = 'Crie seu primeiro hábito';
    el('mission-sub').textContent = 'Inicie sua jornada de evolução';
    el('mission-btn').textContent = 'Criar';
    el('mission-btn').onclick = () => { switchTab('habitos'); setTimeout(openHabitModal, 250); };
    return;
  }
  const next = state.habits.find(h=>!h.done);
  if (!next) {
    el('mission-icon').textContent = '🏆';
    el('mission-title').textContent = 'Missão completa!';
    el('mission-sub').textContent = `Todos ${total} hábitos concluídos hoje`;
    el('mission-btn').textContent = 'Ver';
    el('mission-btn').onclick = () => switchTab('habitos');
    card.classList.add('card-glow');
    return;
  }
  card.classList.remove('card-glow');
  el('mission-icon').textContent = '⚔️';
  el('mission-title').textContent = next.name;
  el('mission-sub').textContent = `${next.category} · +${next.xp} XP`;
  el('mission-btn').textContent = 'Concluir';
  el('mission-btn').onclick = () => { toggleHabit(next.id); };
}

function renderWeeklyRing() {
  const total = state.habits.length;
  const sumWeek = (state.weeklyActivity || []).reduce((a,b)=>a+b,0);
  const todayDone = state.habits.filter(h=>h.done).length;
  const totalDone = sumWeek + todayDone;
  // Ideal: total habits × 7
  const ideal = Math.max(total * 7, 1);
  const pct = Math.min(Math.round((totalDone / ideal) * 100), 100);
  el('weekly-pct').textContent = pct + '%';
  el('weekly-done').textContent = totalDone;
  el('weekly-ring').setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
  el('weekly-sub').textContent = pct >= 80 ? '🔥 Em chamas!' : pct >= 50 ? '⚡ Bom ritmo' : 'Continue evoluindo!';
}

function renderAttributes() {
  // Disciplina = % hábitos feitos hoje
  const totalH = state.habits.length;
  const doneH = state.habits.filter(h=>h.done).length;
  const disc = totalH ? Math.round((doneH/totalH)*100) : 0;

  // Mente = % estudos feitos
  const totalS = state.studies.length;
  const doneS = state.studies.filter(s=>s.done).length;
  const mind = totalS ? Math.round((doneS/totalS)*100) : 0;

  // Riqueza = saldo positivo (income vs expense ratio)
  const inc = state.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+t.value,0);
  const exp = state.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.value,0);
  let rich = 0;
  if (inc + exp > 0) rich = Math.max(0, Math.min(100, Math.round(((inc - exp) / Math.max(inc, 1)) * 100)));

  // Foco = média de progresso das metas
  const goals = state.goals;
  let focs = 0;
  if (goals.length) {
    const sum = goals.reduce((a,g)=>a + Math.min(100, (g.current/g.target)*100), 0);
    focs = Math.round(sum / goals.length);
  }

  setAttr('disc', disc);
  setAttr('mind', mind);
  setAttr('rich', rich);
  setAttr('focs', focs);
}

function setAttr(key, pct) {
  const bar = el('attr-' + key);
  const v = el('attr-' + key + '-v');
  if (!bar || !v) return;
  bar.style.width = pct + '%';
  v.textContent = pct;
}

function animateNumber(id, target) {
  const node = el(id);
  if (!node) return;
  const start = parseInt(node.textContent.replace(/\D/g,'')) || 0;
  if (start === target) { node.textContent = target; return; }
  const dur = 700;
  const t0 = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - t0)/dur);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = Math.round(start + (target - start) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

let greetingAnim = null;
function animateGreeting() {
  const node = el('greeting-text');
  if (!node) return;
  const text = `Olá, ${state.name}`;
  // Evita relançar se mesmo nome e já completo
  if (node.dataset.last === text) return;
  node.dataset.last = text;
  if (greetingAnim) clearInterval(greetingAnim);
  node.innerHTML = '';
  let i = 0;
  const cursor = '<span class="greeting-cursor">_</span>';
  greetingAnim = setInterval(() => {
    if (i <= text.length) { node.innerHTML = escapeHTML(text.slice(0,i)) + cursor; i++; }
    else { clearInterval(greetingAnim); greetingAnim = null; }
  }, 55);
}

// ───────────────────────────────────────────────────────
// HABITS
// ───────────────────────────────────────────────────────
let editingHabitId = null;

function openHabitModal(id=null) {
  editingHabitId = id;
  if (id) {
    const h = state.habits.find(h=>h.id===id);
    el('habit-modal-title').textContent = '✏️ Editar Hábito';
    el('habit-name').value = h.name;
    el('habit-category').value = h.category;
    el('habit-xp').value = h.xp;
  } else {
    el('habit-modal-title').textContent = '✅ Novo Hábito';
    el('habit-name').value = ''; el('habit-category').value = 'saúde'; el('habit-xp').value = '20';
  }
  openModal('habit-modal');
}

function saveHabit() {
  const name = el('habit-name').value.trim();
  if (!name) return showToast('Digite o nome do hábito','error');
  if (editingHabitId) {
    const h = state.habits.find(h=>h.id===editingHabitId);
    h.name=name; h.category=el('habit-category').value; h.xp=parseInt(el('habit-xp').value);
    showToast('Hábito atualizado!','success');
  } else {
    state.habits.push({id:uid(),name,category:el('habit-category').value,xp:parseInt(el('habit-xp').value),done:false,createdAt:Date.now()});
    showToast('Hábito criado!','success');
  }
  save(); closeModal('habit-modal'); refreshAll();
}

function toggleHabit(id) {
  const h = state.habits.find(h=>h.id===id);
  if (!h) return;
  if (h.done) {
    h.done = false; showToast('Hábito desmarcado','info');
    save(); renderHabits(); renderDashboard();
  } else {
    h.done = true;
    bumpStreak();
    addXP(h.xp);
    showToast(`+${h.xp} XP! Hábito concluído! 🔥`, 'success');
    if ('vibrate' in navigator) navigator.vibrate(50);
    renderHabits(); renderDashboard();
    const allDone = state.habits.every(h => h.done);
    if (allDone && state.habits.length > 0) sendNotification('🏆 GEN — Missão Completa!', 'Parabéns! Você completou TODOS os hábitos de hoje!');
  }
}

function deleteHabit(id) {
  showConfirm('Excluir Hábito', 'Tem certeza que deseja excluir este hábito?', () => {
    state.habits = state.habits.filter(h=>h.id!==id);
    save(); renderHabits(); renderDashboard();
    showToast('Hábito excluído','info');
  });
}

function renderHabits() {
  const list = el('habits-list'); const empty = el('habits-empty');
  const done = state.habits.filter(h=>h.done).length;
  const total = state.habits.length;
  el('hab-done-badge').textContent = `${done}/${total}`;
  const pct = total ? Math.round((done/total)*100) : 0;
  el('hab-pct').textContent = pct + '%';
  el('hab-progress-bar').style.width = pct + '%';
  if (!total) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const catIcons = {saúde:'💪',mente:'🧠',produtividade:'⚡',estudos:'📚',finanças:'💰',social:'👥',outro:'🎯'};
  list.innerHTML = state.habits.map(h => `
    <div class="habit-item ${h.done?'done':''}" id="hab-${h.id}">
      <div class="habit-check" data-toggle="${h.id}">
        ${h.done?'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="habit-name">${escapeHTML(h.name)}</div>
        <div class="habit-meta" style="margin-top:4px;">
          <span class="badge badge-primary" style="font-size:9px;">${catIcons[h.category]||'🎯'} ${escapeHTML(h.category)}</span>
          <span class="habit-xp">+${h.xp}XP</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-icon btn-sm" data-edit-habit="${h.id}">✏️</button>
        <button class="btn btn-danger btn-icon btn-sm" data-del-habit="${h.id}">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ───────────────────────────────────────────────────────
// FINANCEIRO
// ───────────────────────────────────────────────────────
function openFinModal(type, id=null) {
  el('fin-type').value = type; el('fin-edit-id').value = id || '';
  if (id) {
    const t = state.transactions.find(t=>t.id===id);
    el('fin-modal-title').textContent = '✏️ Editar Transação';
    el('fin-desc').value=t.desc; el('fin-value').value=t.value; el('fin-cat').value=t.category; el('fin-type').value=t.type;
  } else {
    el('fin-modal-title').textContent = type==='income'?'💚 Nova Entrada':'🔴 Nova Saída';
    el('fin-desc').value=''; el('fin-value').value=''; el('fin-cat').value=type==='income'?'salário':'alimentação';
  }
  openModal('fin-modal');
}

function saveTransaction() {
  const desc = el('fin-desc').value.trim(); const value = parseFloat(el('fin-value').value);
  if (!desc) return showToast('Digite a descrição','error');
  if (!value || value<=0) return showToast('Digite um valor válido','error');
  const editId = el('fin-edit-id').value;
  if (editId) {
    const t = state.transactions.find(t=>t.id===editId);
    t.desc=desc; t.value=value; t.category=el('fin-cat').value; t.type=el('fin-type').value;
    showToast('Transação atualizada!','success');
  } else {
    state.transactions.unshift({id:uid(),desc,value,category:el('fin-cat').value,type:el('fin-type').value,date:new Date().toLocaleDateString('pt-BR')});
    showToast('Transação adicionada!','success');
    const exp = state.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.value,0);
    const inc = state.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+t.value,0);
    if (el('fin-type').value==='expense' && exp>inc*0.8 && inc>0) sendNotification('💰 GEN — Atenção Financeira','Suas despesas estão acima de 80% das receitas. Fique de olho!');
  }
  save(); closeModal('fin-modal'); renderTransactions(); renderDashboard();
}

function deleteTransaction(id) {
  showConfirm('Excluir Transação','Tem certeza?',()=>{
    state.transactions=state.transactions.filter(t=>t.id!==id);
    save(); renderTransactions(); renderDashboard();
    showToast('Transação excluída','info');
  });
}

function renderTransactions() {
  const inc = state.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+t.value,0);
  const exp = state.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.value,0);
  el('fin-balance').textContent=fmtMoney(inc-exp);
  el('fin-income').textContent=fmtMoney(inc);
  el('fin-expense').textContent=fmtMoney(exp);
  renderPieChart();
  const list=el('transactions-list'); const empty=el('transactions-empty');
  if (!state.transactions.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  list.innerHTML=state.transactions.map(t=>`
    <div class="tx-item tx-${t.type}">
      <div class="tx-icon">${t.type==='income'?'💚':'🔴'}</div>
      <div class="tx-info"><div class="tx-title">${escapeHTML(t.desc)}</div><div class="tx-cat">${escapeHTML(t.category)} · ${t.date}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="tx-amount">${t.type==='income'?'+':'-'}${fmtMoney(t.value)}</div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" style="padding:4px 8px;" data-edit-tx="${t.id}" data-tx-type="${t.type}">✏️</button>
          <button class="btn btn-danger btn-sm" style="padding:4px 8px;" data-del-tx="${t.id}">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPieChart() {
  const expenses=state.transactions.filter(t=>t.type==='expense');
  if (!expenses.length) { el('pie-section').style.display='none'; return; }
  el('pie-section').style.display='flex';
  const catTotals={};
  expenses.forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+t.value;});
  const total=Object.values(catTotals).reduce((a,b)=>a+b,0);
  const cats=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const svg=el('pie-svg'); let offset=0;
  const r=15.9; const circ=2*Math.PI*r;
  let paths=`<circle cx="18" cy="18" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="3"/>`;
  cats.forEach(([cat,val])=>{
    const pct=val/total; const dash=pct*circ;
    const color=CAT_COLORS[cat]||'#8892b0';
    paths+=`<circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" style="transition:all .6s"/>`;
    offset+=dash;
  });
  svg.innerHTML=paths;
  el('pie-legend').innerHTML=cats.slice(0,4).map(([cat,val])=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${CAT_COLORS[cat]||'#8892b0'};flex-shrink:0;box-shadow:0 0 6px ${CAT_COLORS[cat]||'#8892b0'};"></div>
      <span style="font-size:11px;color:var(--text2);flex:1;">${escapeHTML(cat)}</span>
      <span style="font-size:11px;font-family:'Share Tech Mono',monospace;color:var(--text);">${fmtMoney(val)}</span>
    </div>
  `).join('');
}

// ───────────────────────────────────────────────────────
// METAS
// ───────────────────────────────────────────────────────
let goalsFilter='all';

function openGoalModal(id=null) {
  el('goal-edit-id').value=id||'';
  if (id) {
    const g=state.goals.find(g=>g.id===id);
    el('goal-modal-title').textContent='✏️ Editar Meta';
    el('goal-title').value=g.title; el('goal-target').value=g.target; el('goal-current').value=g.current; el('goal-cat').value=g.category;
  } else {
    el('goal-modal-title').textContent='🎯 Nova Meta';
    el('goal-title').value=''; el('goal-target').value=''; el('goal-current').value='0'; el('goal-cat').value='financeiro';
  }
  openModal('goal-modal');
}

function saveGoal() {
  const title=el('goal-title').value.trim();
  const target=parseFloat(el('goal-target').value);
  const current=parseFloat(el('goal-current').value)||0;
  if (!title) return showToast('Digite o título','error');
  if (!target||target<=0) return showToast('Digite um objetivo válido','error');
  const editId=el('goal-edit-id').value;
  if (editId) {
    const g=state.goals.find(g=>g.id===editId);
    g.title=title; g.target=target; g.current=current; g.category=el('goal-cat').value;
    showToast('Meta atualizada!','success');
  } else {
    state.goals.push({id:uid(),title,target,current,category:el('goal-cat').value,createdAt:Date.now()});
    showToast('Meta criada!','success');
  }
  save(); closeModal('goal-modal'); renderGoals(goalsFilter); renderDashboard();
}

function deleteGoal(id) {
  showConfirm('Excluir Meta','Tem certeza?',()=>{
    state.goals=state.goals.filter(g=>g.id!==id);
    save(); renderGoals(goalsFilter); renderDashboard(); showToast('Meta excluída','info');
  });
}

function openUpdateGoal(id) {
  const g=state.goals.find(g=>g.id===id);
  el('goal-update-id').value=id; el('goal-update-value').value=g.current;
  openModal('goal-update-modal');
}

function updateGoalProgress() {
  const id=el('goal-update-id').value; const val=parseFloat(el('goal-update-value').value)||0;
  const g=state.goals.find(g=>g.id===id);
  g.current=Math.min(val,g.target);
  save(); closeModal('goal-update-modal'); renderGoals(goalsFilter); renderDashboard();
  if (g.current>=g.target) { showToast('🏆 Meta concluída!','success'); sendNotification('🏆 GEN — Meta Concluída!',`Parabéns! Você concluiu: ${g.title}`); }
  else showToast('Progresso atualizado!','success');
}

function filterGoals(cat,btn) {
  goalsFilter=cat;
  document.querySelectorAll('#screen-metas .tab-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGoals(cat);
}

function renderGoals(filter='all') {
  const list=el('goals-list'); const empty=el('goals-empty');
  const filtered=filter==='all'?state.goals:state.goals.filter(g=>g.category===filter);
  if (!filtered.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const catIcons={financeiro:'💰',corpo:'💪',estudos:'📚',produtividade:'⚡',pessoal:'🌟'};
  list.innerHTML=filtered.map(g=>{
    const pct=Math.min(Math.round((g.current/g.target)*100),100); const done=pct>=100;
    return `
    <div class="goal-item ${done?'card-glow':''}">
      <div class="goal-header">
        <div style="min-width:0;"><div class="goal-title-text">${escapeHTML(g.title)}</div><span class="badge badge-primary" style="margin-top:4px;">${catIcons[g.category]||'🎯'} ${escapeHTML(g.category)}</span></div>
        <div class="goal-pct">${pct}%</div>
      </div>
      <div class="goal-progress-label">${g.current} / ${g.target}</div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%;${done?'background:linear-gradient(90deg,var(--success),var(--primary))':''}"></div></div>
      <div class="goal-footer">
        ${done?'<span class="badge badge-success">✅ Concluída</span>':`<button class="btn btn-ghost btn-sm" data-update-goal="${g.id}">📈 Atualizar</button>`}
        <div class="goal-actions">
          <button class="btn btn-ghost btn-sm" data-edit-goal="${g.id}">✏️</button>
          <button class="btn btn-danger btn-sm" data-del-goal="${g.id}">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ───────────────────────────────────────────────────────
// ESTUDOS
// ───────────────────────────────────────────────────────
let studyFilter='all';

function openStudyModal(id=null) {
  el('study-edit-id').value=id||'';
  if (id) {
    const s=state.studies.find(s=>s.id===id);
    el('study-modal-title').textContent='✏️ Editar';
    el('study-title').value=s.title; el('study-type').value=s.type; el('study-date').value=s.date||''; el('study-note').value=s.note||'';
  } else {
    el('study-modal-title').textContent='📚 Adicionar Estudo';
    el('study-title').value=''; el('study-type').value='materia'; el('study-date').value=''; el('study-note').value='';
  }
  openModal('study-modal');
}

function saveStudy() {
  const title=el('study-title').value.trim();
  if (!title) return showToast('Digite o título','error');
  const editId=el('study-edit-id').value;
  if (editId) {
    const s=state.studies.find(s=>s.id===editId);
    s.title=title; s.type=el('study-type').value; s.date=el('study-date').value; s.note=el('study-note').value;
    showToast('Atualizado!','success');
  } else {
    state.studies.push({id:uid(),title,type:el('study-type').value,date:el('study-date').value,note:el('study-note').value,done:false,createdAt:Date.now()});
    showToast('Adicionado!','success');
  }
  save(); closeModal('study-modal'); renderStudy(studyFilter); renderDashboard();
}

function toggleStudy(id) {
  const s=state.studies.find(s=>s.id===id);
  if (!s) return;
  s.done=!s.done;
  if (s.done) { addXP(15); showToast('+15 XP! Estudo concluído!','success'); }
  save(); renderStudy(studyFilter); renderDashboard();
}

function deleteStudy(id) {
  showConfirm('Excluir','Tem certeza?',()=>{
    state.studies=state.studies.filter(s=>s.id!==id);
    save(); renderStudy(studyFilter); renderDashboard(); showToast('Excluído','info');
  });
}

function filterStudy(type,btn) {
  studyFilter=type;
  document.querySelectorAll('#screen-estudos .tab-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active'); renderStudy(type);
}

function renderStudy(filter='all') {
  const list=el('study-list'); const empty=el('study-empty');
  const filtered=filter==='all'?state.studies:state.studies.filter(s=>s.type===filter);
  const done=state.studies.filter(s=>s.done).length; const total=state.studies.length;
  const pct=total?Math.round((done/total)*100):0;
  el('study-pct').textContent=pct+'%'; el('study-progress-bar').style.width=pct+'%';
  if (!filtered.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const typeIcons={materia:'📖',prova:'📝',tarefa:'✅',horario:'🕐'};
  list.innerHTML=filtered.map(s=>`
    <div class="study-item ${s.done?'done':''}">
      <div class="study-check" data-toggle-study="${s.id}">
        ${s.done?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="study-label">${escapeHTML(s.title)}</div>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
          <span class="badge badge-primary" style="font-size:9px;">${typeIcons[s.type]} ${s.type}</span>
          ${s.date?`<span style="font-size:10px;color:var(--text3);">📅 ${s.date}</span>`:''}
          ${s.note?`<span style="font-size:10px;color:var(--text3);">${escapeHTML(s.note.slice(0,30))}${s.note.length>30?'...':''}</span>`:''}
        </div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-ghost btn-sm" style="padding:4px 8px;" data-edit-study="${s.id}">✏️</button>
        <button class="btn btn-danger btn-sm" style="padding:4px 8px;" data-del-study="${s.id}">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ───────────────────────────────────────────────────────
// PROFILE
// ───────────────────────────────────────────────────────
function renderProfile() {
  const rank=getRank(state.level);
  el('profile-name').textContent=state.name;
  el('profile-rank-badge').textContent=rank.icon+' '+rank.name;
  el('profile-level').textContent=state.level;
  el('profile-xp').textContent=state.totalXp;
  el('profile-habits').textContent=state.habits.filter(h=>h.done).length;
  el('name-input').value=state.name;
  const av = el('profile-avatar-emoji');
  av.textContent = (typeof state.avatar==='string' && !state.avatar.startsWith('data:')) ? state.avatar : '🧬';
  if (state.avatar && state.avatar.startsWith && state.avatar.startsWith('data:')) {
    av.style.display='none';
    el('profile-avatar').style.backgroundImage=`url(${state.avatar})`;
    el('profile-avatar').style.backgroundSize='cover';
  }
  el('stat-total-habits').textContent=state.habits.length;
  el('stat-total-xp').textContent=state.totalXp;
  el('stat-total-goals').textContent=state.goals.length;
  el('stat-total-tx').textContent=state.transactions.length;
  if (currentUserEmail) el('chip-email').textContent=currentUserEmail;
}

function updateName(v) {
  state.name=v||'Gênio'; save();
  // forçar re-typing
  const node = el('greeting-text'); if (node) node.dataset.last = '';
  renderDashboard();
}

function handleAvatarUpload(input) {
  if (!input.files||!input.files[0]) return;
  const reader=new FileReader();
  reader.onload=e=>{
    state.avatar=e.target.result; save(); renderProfile();
    el('dash-avatar').innerHTML=`<img src="${state.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(input.files[0]);
}

function setTheme(theme,btn) {
  state.theme=theme;
  document.body.setAttribute('data-theme',theme);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active'); save();
  // Update theme-color meta
  const colors = {cyber:'#00f5ff', forest:'#00ff88', inferno:'#ff4500', gold:'#ffd700', void:'#bf5fff'};
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', colors[theme]||'#00f5ff'));
  showToast('Tema aplicado!','success');
}

// ───────────────────────────────────────────────────────
// CONFIRM / RESET
// ───────────────────────────────────────────────────────
let confirmCallback=null;
function showConfirm(title,msg,cb) {
  confirmCallback=cb;
  el('confirm-title').textContent=title; el('confirm-msg').textContent=msg;
  el('confirm-ok-btn').onclick=()=>{closeModal('confirm-modal');if(confirmCallback)confirmCallback();};
  openModal('confirm-modal');
}

function confirmReset() {
  showConfirm('⚠️ Resetar Dados','Todos os dados serão apagados permanentemente. Tem certeza?',()=>{
    if (currentUserEmail) localStorage.removeItem(userDataKey(currentUserEmail));
    state=defaultState(); save(); refreshAll();
    showToast('Dados resetados','info');
  });
}

// ───────────────────────────────────────────────────────
// UTILS
// ───────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function uid() { return Math.random().toString(36).slice(2,10); }
function fmtMoney(v) { return 'R$ '+(v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function openModal(id) { el(id).classList.add('open'); }
function closeModal(id) { el(id).classList.remove('open'); }
function escapeHTML(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(msg, type='info') {
  const container=el('toast-container');
  const toast=document.createElement('div');
  toast.className=`toast toast-${type}`;
  const icons={success:'✅',error:'❌',info:'ℹ️'};
  toast.innerHTML=`<span>${icons[type]||'•'}</span><span>${escapeHTML(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(()=>{ toast.style.opacity='0'; toast.style.transform='translateY(-10px)'; toast.style.transition='all .3s'; setTimeout(()=>toast.remove(),300); }, 3000);
}

// ───────────────────────────────────────────────────────
// EVENT DELEGATION (substitui inline onclick)
// ───────────────────────────────────────────────────────
function bindEvents() {
  // Auth
  document.querySelectorAll('.auth-tab').forEach(b => b.addEventListener('click', () => switchAuthTab(b.dataset.tab, b)));
  el('btn-login').addEventListener('click', doLogin);
  el('btn-register').addEventListener('click', doRegister);

  // Top bar
  el('notif-bell-btn').addEventListener('click', toggleNotifPanel);
  el('dash-avatar').addEventListener('click', () => switchTab('profile'));

  // Nav
  document.querySelectorAll('#navbar .nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // Goto buttons
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.goto)));

  // FAB
  el('fab-btn').addEventListener('click', fabAction);

  // Banner
  el('banner-install').addEventListener('click', triggerInstall);
  el('banner-dismiss').addEventListener('click', dismissInstall);
  el('install-btn-profile').addEventListener('click', triggerInstall);

  // Profile
  el('profile-avatar').addEventListener('click', () => el('avatar-input').click());
  el('avatar-input').addEventListener('change', e => handleAvatarUpload(e.target));
  el('name-input').addEventListener('input', e => updateName(e.target.value));
  el('btn-logout').addEventListener('click', doLogout);
  el('btn-reset').addEventListener('click', confirmReset);

  // Theme
  document.querySelectorAll('.theme-btn').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme, b)));

  // Filters
  document.querySelectorAll('[data-filter="goals"]').forEach(b => b.addEventListener('click', () => filterGoals(b.dataset.val, b)));
  document.querySelectorAll('[data-filter="study"]').forEach(b => b.addEventListener('click', () => filterStudy(b.dataset.val, b)));

  // Modal close (X / overlay)
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));

  // Action buttons
  document.body.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    if (a === 'fin-income') openFinModal('income');
    else if (a === 'fin-expense') openFinModal('expense');
    else if (a === 'open-goal') openGoalModal();
    else if (a === 'open-study') openStudyModal();
    else if (a === 'notif-perm') requestNotifPermission();
    else if (a === 'notif-test') sendTestNotification();
  });

  // Save buttons
  el('save-habit-btn').addEventListener('click', saveHabit);
  el('save-tx-btn').addEventListener('click', saveTransaction);
  el('save-goal-btn').addEventListener('click', saveGoal);
  el('upd-goal-btn').addEventListener('click', updateGoalProgress);
  el('save-study-btn').addEventListener('click', saveStudy);
  el('closeup-btn').addEventListener('click', closeLevelUp);

  // Delegação para itens dinâmicos
  document.body.addEventListener('click', e => {
    const tgt = e.target.closest('[data-toggle],[data-edit-habit],[data-del-habit],[data-toggle-study],[data-edit-study],[data-del-study],[data-edit-tx],[data-del-tx],[data-update-goal],[data-edit-goal],[data-del-goal]');
    if (!tgt) return;
    if (tgt.dataset.toggle) toggleHabit(tgt.dataset.toggle);
    else if (tgt.dataset.editHabit) openHabitModal(tgt.dataset.editHabit);
    else if (tgt.dataset.delHabit) deleteHabit(tgt.dataset.delHabit);
    else if (tgt.dataset.toggleStudy) toggleStudy(tgt.dataset.toggleStudy);
    else if (tgt.dataset.editStudy) openStudyModal(tgt.dataset.editStudy);
    else if (tgt.dataset.delStudy) deleteStudy(tgt.dataset.delStudy);
    else if (tgt.dataset.editTx) openFinModal(tgt.dataset.txType, tgt.dataset.editTx);
    else if (tgt.dataset.delTx) deleteTransaction(tgt.dataset.delTx);
    else if (tgt.dataset.updateGoal) openUpdateGoal(tgt.dataset.updateGoal);
    else if (tgt.dataset.editGoal) openGoalModal(tgt.dataset.editGoal);
    else if (tgt.dataset.delGoal) deleteGoal(tgt.dataset.delGoal);
  });

  // Enter key on auth
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const auth = el('auth-screen');
    if (auth.classList.contains('hidden')) return;
    if (el('auth-login-form').classList.contains('active')) doLogin();
    else if (el('auth-register-form').classList.contains('active')) doRegister();
  });
}

// ───────────────────────────────────────────────────────
// INIT
// ───────────────────────────────────────────────────────
(function init() {
  bindEvents();
  createAuthParticles();
  el('app').style.display='none';
  el('fab-btn').style.display='none';

  const session=getSession();
  if (session && session.email) {
    const users=getUsers();
    if (users[session.email]) { startApp(session.email, users[session.email].name); return; }
    else clearSession();
  }
  el('auth-screen').classList.remove('hidden');
  updateInstallBtn();
})();
