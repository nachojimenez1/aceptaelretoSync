chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'INIT_REPOSITORY') {
    inicializarRepositorio().then(() => sendResponse({ success: true }));
    return true;
  } else if (message.action === 'UPLOAD_TO_GITHUB') {
    procesarYSubir(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error('[Background] Error en procesarYSubir:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function inicializarRepositorio() {
  const { githubToken, githubRepo, solvedHistory } = await chrome.storage.local.get([
    'githubToken', 'githubRepo', 'solvedHistory'
  ]);
  if (!githubToken || !githubRepo) return;

  const repoName = githubRepo.split('/')[1] || 'AceptaElReto-Solutions';

  try {
    const repoCheck = await fetch(`https://api.github.com/repos/${githubRepo}`, {
      headers: { 'Authorization': `Bearer ${githubToken}` }
    });

    if (repoCheck.status === 404) {
      console.log(`[Background] Creando repositorio ${repoName} en GitHub...`);
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: repoName,
          description: 'Soluciones automáticas a los retos de programación de Acepta el Reto sincronizadas con mi extensión.',
          private: false,
          auto_init: true
        })
      });

      if (!createRes.ok) {
        throw new Error(`Error al crear el repositorio: ${createRes.status}`);
      }

      const initialReadme = generarContenidoReadmePrincipal(solvedHistory || []);
      await subirArchivoAGitHub(
        githubToken,
        githubRepo,
        'README.md',
        initialReadme,
        'Initial commit: Repositorio inicializado'
      );
    }
  } catch (err) {
    console.error('[Background] Error inicializando repositorio:', err);
  }
}

async function procesarYSubir(payload) {
  const { problemId, language, code, stats, statement } = payload;
  const { githubToken, githubRepo, syncCount, solvedHistory } = await chrome.storage.local.get([
    'githubToken', 'githubRepo', 'syncCount', 'solvedHistory'
  ]);

  if (!githubToken || !githubRepo) {
    throw new Error('No hay sesión iniciada en GitHub. Abre el popup de la extensión y pulsa Conectar.');
  }

  await inicializarRepositorio();

  const langOficial = (stats && stats.language) ? stats.language : language;
  let ext = 'cpp';
  const l = (langOficial || '').toLowerCase();
  
  if (l.includes('java')) ext = 'java';
  else if (l.includes('c') && !l.includes('cpp') && !l.includes('c++') && !l.includes('g++')) ext = 'c';
  else ext = 'cpp';

  const folderName = `${problemId}_${sanitizarTitulo(statement.titulo)}`;
  const basePath = `Problemas/${folderName}`;

  console.log(`[Background] 1/3 Subiendo código (${ext.toUpperCase()})...`);
  await subirArchivoAGitHub(
    githubToken,
    githubRepo,
    `${basePath}/solution.${ext}`,
    code,
    `Solución [AC] al Problema ${problemId} (${ext.toUpperCase()}) - ${statement.titulo}`
  );

  console.log(`[Background] 2/3 Subiendo README del problema...`);
  const problemReadme = generarReadmeProblema(problemId, statement, stats, ext);
  await subirArchivoAGitHub(
    githubToken,
    githubRepo,
    `${basePath}/README.md`,
    problemReadme,
    `Documentación y enunciado del Problema ${problemId}`
  );

  let history = solvedHistory || [];
  const index = history.findIndex(h => h.id === problemId);

  const problemData = {
    id: problemId,
    title: statement.titulo,
    folder: folderName,
    ext: ext,
    time: stats.time,
    memory: stats.memory,
    date: stats.date || new Date().toISOString()
  };

  if (index >= 0) {
    history[index] = problemData;
  } else {
    history.push(problemData);
  }

  history.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  await chrome.storage.local.set({ solvedHistory: history, syncCount: (syncCount || 0) + 1 });
  console.log(`[Background] Historial local actualizado. Total resueltos: ${history.length}`);

  console.log(`[Background] 3/3 Actualizando README.md principal...`);
  const rootReadmeContent = generarContenidoReadmePrincipal(history);
  await subirArchivoAGitHub(
    githubToken,
    githubRepo,
    'README.md',
    rootReadmeContent,
    `Actualizar índice: añadido Problema ${problemId} [${ext.toUpperCase()}]`
  );

  console.log(`[Background] ¡Problema ${problemId} sincronizado con éxito total!`);
}

function generarReadmeProblema(id, statement, stats, ext) {
  const langBadges = {
    cpp: { label: 'C++', color: '00599C' },
    java: { label: 'Java', color: 'ED8B00' },
    c: { label: 'C', color: '555555' }
  };
  const bLang = langBadges[ext] || langBadges.cpp;

  return `# [${id}] ${statement.titulo}

[![Juez](https://img.shields.io/badge/Juez-Acepta%20el%20Reto-blue?style=flat-square)](https://aceptaelreto.com/problem/statement.php?id=${id})
[![Resultado](https://img.shields.io/badge/Resultado-Accepted%20(AC)-brightgreen?style=flat-square)](#)
[![Lenguaje](https://img.shields.io/badge/Lenguaje-${encodeURIComponent(bLang.label)}-${bLang.color}?style=flat-square)](#)

## 📊 Estadísticas de la solución

| Métrica | Valor |
| :--- | :--- |
| **Tiempo de CPU** | \`${stats.time}\` |
| **Memoria consumida** | \`${stats.memory}\` |
| **Lenguaje empleado** | \`${bLang.label}\` |
| **ID de Envío** | \`${stats.submissionId}\` |
| **Fecha de resolución** | \`${stats.date}\` |

---

## 📝 Enunciado del Problema

${statement.cuerpo}

---
*Sincronizado automáticamente desde [Acepta el Reto](https://aceptaelreto.com/) con **AceptaElReto Sync**.*
`;
}

function generarContenidoReadmePrincipal(history) {
  let filasTabla = '';

  if (!history || history.length === 0) {
    filasTabla = '| - | *Aún no hay problemas sincronizados* | - | - | - | - |\n';
  } else {
    const langBadgeMini = {
      cpp: '![C++](https://img.shields.io/badge/C%2B%2B-00599C?style=flat-square)',
      java: '![Java](https://img.shields.io/badge/Java-ED8B00?style=flat-square)',
      c: '![C](https://img.shields.io/badge/C-555555?style=flat-square)'
    };

    filasTabla = history.map(item => {
      const bLang = langBadgeMini[item.ext] || langBadgeMini.cpp;
      const folderPath = `./Problemas/${item.folder}`;
      const codePath = `${folderPath}/solution.${item.ext || 'cpp'}`;
      return `| \`${item.id}\` | [${item.title}](${folderPath}) | ${bLang} | [Ver solución](${codePath}) | \`${item.time || 'N/A'}\` | \`${item.memory || 'N/A'}\` |`;
    }).join('\n');
  }

  return `# 🚀 Acepta el Reto - Soluciones Automatizadas

<p align="center">
  <img src="https://img.shields.io/badge/Juez-Acepta%20el%20Reto-007ACC?style=for-the-badge&logo=codeforces&logoColor=white" alt="Juez" />
  <img src="https://img.shields.io/badge/C%2B%2B-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java" />
  <img src="https://img.shields.io/badge/C-555555?style=for-the-badge&logo=c&logoColor=white" alt="C" />
  <img src="https://img.shields.io/badge/Total%20Resueltos-${history.length}-blueviolet?style=for-the-badge" alt="Total Resueltos" />
</p>

Repositorio personal con las soluciones aceptadas (**Accepted - AC**) en la plataforma de programación competitiva **[Acepta el Reto](https://aceptaelreto.com/)**.

Todas las soluciones, estadísticas de ejecución y enunciados son sincronizados de forma instantánea y desatendida mediante la extensión **AceptaElReto Sync** cada vez que el juez valida un envío.

---

## 🏆 Problemas Resueltos (${history.length})

| # | Problema | Lenguaje | Solución | Tiempo | Memoria |
| :---: | :--- | :---: | :---: | :---: | :---: |
${filasTabla}

---

## 📁 Estructura del Repositorio

Los problemas resueltos se organizan de forma independiente dentro del directorio \`Problemas/\`:

\`\`\`text
Problemas/
├── 116_HolaMundo/
│   ├── README.md       # Enunciado formateado, límites y tabla de métricas (CPU/Memoria)
│   └── solution.cpp    # Código fuente en C++ aceptado por el juez
├── 237_Polidivisibles/
│   ├── README.md
│   └── solution.java   # Código fuente en Java
└── ...
\`\`\`

---

## 🛠️ Herramientas y Entorno

* **Lenguajes compatibles:** C++, Java y C.
* **Automatización:** Extensión Manifest V3 con integración OAuth/PAT hacia GitHub REST API.
* **Juez en línea:** [Acepta el Reto](https://aceptaelreto.com/)
`;
}

function sanitizarTitulo(titulo) {
  return titulo
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 30) || "Reto";
}

async function subirArchivoAGitHub(token, repo, path, contenido, commitMsg) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  const contentBase64 = btoa(unescape(encodeURIComponent(contenido)));

  let sha = null;
  const checkRes = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (checkRes.ok) {
    const fileData = await checkRes.json();
    sha = fileData.sha;
  }

  const body = { message: commitMsg, content: contentBase64 };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errJson = await putRes.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(`GitHub API [${putRes.status}] al subir ${path}: ${errJson.message}`);
  }

  return putRes;
}