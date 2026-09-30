document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get([
    'githubToken',
    'githubUser',
    'githubRepo',
    'solvedHistory',
    'subdirectory'
  ]);

  if (!data.githubToken) {
    mostrarLogin();
  } else {
    mostrarDashboard(data);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.solvedHistory) {
      renderizarDonutAnimado(changes.solvedHistory.newValue || []);
      renderizarDiasRacha(changes.solvedHistory.newValue || []);
    }
  });
});

function mostrarLogin() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('dashboardView').classList.add('hidden');

  const connectBtn = document.getElementById('connectBtn');
  const tokenInput = document.getElementById('tokenInput');
  const authError = document.getElementById('authError');

  connectBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    authError.classList.add('hidden');

    if (!token) {
      authError.innerText = 'Introduce tu Personal Access Token de GitHub.';
      authError.classList.remove('hidden');
      return;
    }

    connectBtn.innerText = 'Verificando...';
    connectBtn.disabled = true;

    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!userRes.ok) throw new Error('Token no válido o sin permisos.');

      const user = await userRes.json();
      const defaultRepo = `${user.login}/AceptaElReto-Solutions`;

      await chrome.storage.local.set({
        githubToken: token,
        githubUser: user,
        githubRepo: defaultRepo,
        subdirectory: 'Problemas'
      });

      chrome.runtime.sendMessage({ action: 'INIT_REPOSITORY' });
      location.reload();
    } catch (err) {
      authError.innerText = err.message || 'Error al autenticar.';
      authError.classList.remove('hidden');
      connectBtn.innerText = 'Conectar y crear repositorio';
      connectBtn.disabled = false;
    }
  });
}

function mostrarDashboard(data) {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');

  const user = data.githubUser || { login: 'usuario', avatar_url: 'https://github.com/identicons/user.png' };
  const repo = data.githubRepo || `${user.login}/AceptaElReto-Solutions`;
  const history = data.solvedHistory || [];

  document.getElementById('menuUsername').innerText = user.login;
  document.getElementById('menuRepo').innerText = repo.includes('/') ? repo.split('/')[1] : repo;
  document.getElementById('menuAvatar').src = user.avatar_url;
  document.getElementById('repoDirectLink').href = `https://github.com/${repo}`;

  const gearBtn = document.getElementById('gearBtn');
  const settingsMenu = document.getElementById('settingsMenu');

  gearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => settingsMenu.classList.add('hidden'));
  settingsMenu.addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('unlinkRepoBtn').addEventListener('click', () => {
    const nuevoRepo = prompt('Introduce el repositorio (usuario/repo):', repo);
    if (nuevoRepo && nuevoRepo.trim()) {
      chrome.storage.local.set({ githubRepo: nuevoRepo.trim() }, () => location.reload());
    }
  });

  document.getElementById('setSubdirBtn').addEventListener('click', () => {
    const sub = prompt('Introduce la subcarpeta:', data.subdirectory || 'Problemas');
    if (sub !== null) chrome.storage.local.set({ subdirectory: sub.trim() });
  });

  document.getElementById('resetAllBtn').addEventListener('click', () => {
    if (confirm('¿Reiniciar estadísticas locales? Tus archivos en GitHub no se tocarán.')) {
      chrome.storage.local.remove(['solvedHistory', 'syncCount'], () => location.reload());
    }
  });

  document.getElementById('signOutBtn').addEventListener('click', async () => {
    if (confirm('¿Seguro que quieres cerrar sesión de GitHub?')) {
      await chrome.storage.local.remove(['githubToken', 'githubUser', 'githubRepo']);
      location.reload();
    }
  });

  renderizarDiasRacha(history);
  renderizarDonutAnimado(history);
}

function calcularRacha(history) {
  const solvedDates = new Set(history.map(item => new Date(item.date).toDateString()));
  let streak = 0;
  const d = new Date();

  if (!solvedDates.has(d.toDateString())) {
    d.setDate(d.getDate() - 1);
  }

  while (solvedDates.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}


function renderizarDiasRacha(history) {
  const container = document.getElementById('streakContainer');
  container.innerHTML = '';

  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const solvedDates = new Set(history.map(item => new Date(item.date).toDateString()));

  const hoy = new Date();
  const ultimos5Dias = [];

  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(hoy.getDate() - i);
    ultimos5Dias.push(d);
  }

  const rachaActual = calcularRacha(history);
  const hoyResuelto = solvedDates.has(hoy.toDateString());

  const titleEl = document.querySelector('.title-row h1');
  const subtitleEl = document.querySelector('.subtitle');
  if (titleEl && subtitleEl) {
    if (rachaActual > 0) {
      titleEl.innerText = `${rachaActual} Day Streak!`;
      subtitleEl.innerText = hoyResuelto 
        ? '¡Objetivo diario cumplido! Racha asegurada.' 
        : '¡Resuelve uno hoy para mantener viva tu racha!';
    } else {
      titleEl.innerText = 'Start your streak!';
      subtitleEl.innerText = 'Do one more, and keep up the streak!';
    }
  }

  ultimos5Dias.forEach((date, idx) => {
    const isSolved = solvedDates.has(date.toDateString());
    const isLastDay = (idx === ultimos5Dias.length - 1);
    const dayLetter = dayLetters[date.getDay()];

    const col = document.createElement('div');
    col.className = 'day-col';

    const lbl = document.createElement('span');
    lbl.className = 'day-label';
    lbl.innerText = dayLetter;

    const badge = document.createElement('div');
    badge.className = `day-badge ${isSolved ? 'active' : ''}`;

    if (isLastDay) {
      if (isSolved) {
        badge.innerText = rachaActual;
        badge.classList.add('streak-number');
      } else {
        badge.innerText = '✕';
      }
    } else {
      badge.innerText = isSolved ? '✓' : '✕';
    }

    col.appendChild(lbl);
    col.appendChild(badge);
    container.appendChild(col);
  });
}

function renderizarDonutAnimado(history) {
  let cpp = 0, java = 0, c = 0;

  history.forEach(item => {
    const ext = (item.ext || 'cpp').toLowerCase();
    if (ext === 'java') java++;
    else if (ext === 'c') c++;
    else cpp++;
  });

  const total = cpp + java + c;

  document.getElementById('totalSolved').innerText = total;
  document.getElementById('countCpp').innerText = cpp;
  document.getElementById('countJava').innerText = java;
  document.getElementById('countC').innerText = c;

  const segCpp = document.getElementById('segCpp');
  const segJava = document.getElementById('segJava');
  const segC = document.getElementById('segC');

  segCpp.setAttribute('stroke-dasharray', '0 100');
  segJava.setAttribute('stroke-dasharray', '0 100');
  segC.setAttribute('stroke-dasharray', '0 100');

  if (total === 0) return;

  const pctCpp = (cpp / total) * 100;
  const pctJava = (java / total) * 100;
  const pctC = (c / total) * 100;

  setTimeout(() => {
    segCpp.setAttribute('stroke-dasharray', `${pctCpp} ${100 - pctCpp}`);
    segCpp.setAttribute('stroke-dashoffset', '0');

    segJava.setAttribute('stroke-dasharray', `${pctJava} ${100 - pctJava}`);
    segJava.setAttribute('stroke-dashoffset', `-${pctCpp}`);

    segC.setAttribute('stroke-dasharray', `${pctC} ${100 - pctC}`);
    segC.setAttribute('stroke-dashoffset', `-${pctCpp + pctJava}`);
  }, 50);
}