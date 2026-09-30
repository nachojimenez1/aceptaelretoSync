console.log(">>> [AceptaElReto Sync] Script activo en:", window.location.href);

const URL_PATH = window.location.pathname;

if (URL_PATH.includes('send.php')) {
  const form = document.querySelector('form[enctype*="multipart"]') || 
               document.querySelector('input[type="file"]')?.closest('form') || 
               document.querySelector('form');

  if (form) {
    let isSubmitting = false;

    form.addEventListener('submit', async (e) => {
      if (isSubmitting) return;
      e.preventDefault();
      isSubmitting = true;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const problemId = urlParams.get('id') || 'desconocido';

        const langSelect = form.querySelector('select[name="language"], select[name="lang"], select');
        const language = langSelect ? langSelect.value.toLowerCase() : 'cpp';

        let code = '';
        const fileInput = form.querySelector('input[type="file"]');
        const textarea = form.querySelector('textarea');

        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          try {
            code = await fileInput.files[0].text();
          } catch (err) {
            console.error('[AceptaElReto Sync] Error leyendo archivo:', err);
          }
        }

        if (!code && textarea && textarea.value.trim()) {
          code = textarea.value;
        }

        const submissionDraft = {
          problemId: problemId.trim(),
          language: language,
          code: code,
          timestamp: Date.now()
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ lastDraft: submissionDraft });
          console.log(`>>> [AceptaElReto Sync] Código guardado (${code.length} chars).`);
        }
      } catch (err) {
        console.error('[AceptaElReto Sync] Error en captura:', err);
      } finally {
        HTMLFormElement.prototype.submit.call(form);
      }
    });
  }
}


if (URL_PATH.includes('submission')) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['lastDraft'], async (data) => {
      const draft = data.lastDraft;
      const urlParams = new URLSearchParams(window.location.search);
      const currentSubmissionId = urlParams.get('id') || 'N/A';

      const pageText = document.body.innerText;
      const isAccepted = pageText.includes('Accepted') || 
                         pageText.includes('Aceptado') || 
                         pageText.includes('(AC)');

      const inProgress = pageText.includes('En cola') || 
                         pageText.includes('Compilando') || 
                         pageText.includes('Ejecutando');

      if (isAccepted) {
        console.log('>>> [AceptaElReto Sync] ¡ACCEPTED! Extrayendo métricas...');

        const stats = extraerMetricasDesdeDOM();
        const problemId = draft ? draft.problemId : (extraerProblemIdDePagina() || '0');
        const statement = await extraerEnunciadoLimpio(problemId);

        console.log(`>>> [AceptaElReto Sync] Enviando Problema ${problemId} al background...`);

        chrome.runtime.sendMessage({
          action: 'UPLOAD_TO_GITHUB',
          payload: {
            problemId: problemId,
            language: stats.language || draft?.language || 'cpp',
            code: (draft && draft.code) ? draft.code : '// Código fuente resuelto en Acepta el Reto',
            stats: stats,
            statement: statement
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[AceptaElReto Sync] Error comunicando con background:', chrome.runtime.lastError.message);
          } else if (response && response.success) {
            console.log('>>> [AceptaElReto Sync] ¡ÉXITO! GitHub y Donut actualizados.');
          } else {
            console.error('>>> [AceptaElReto Sync] Error desde background:', response?.error);
          }
        });

      } else if (inProgress) {
        console.log('>>> [AceptaElReto Sync] Evaluando... recargando en 2 segundos.');
        setTimeout(() => window.location.reload(), 2000);
      }
    });
  }
}

function extraerMetricasDesdeDOM() {
  const urlParams = new URLSearchParams(window.location.search);
  const stats = {
    time: 'N/A',
    memory: 'N/A',
    language: 'C++',
    date: new Date().toLocaleDateString('es-ES'),
    submissionId: urlParams.get('id') || 'N/A'
  };

  const rows = document.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    if (cells.length >= 2) {
      const label = cells[0].innerText.trim().toLowerCase();
      const val = cells[1].innerText.trim();

      if (label.startsWith('tiempo') && !label.includes('máximo')) stats.time = val;
      else if (label.startsWith('memoria') && !label.includes('máxima')) stats.memory = val;
      else if (label.includes('lenguaje')) stats.language = val;
      else if (label.startsWith('fecha')) stats.date = val;
    }
  });

  const bodyText = document.body.innerText;
  if (stats.time === 'N/A') {
    const m = bodyText.match(/Tiempo[:\s\t\n]+([0-9.,]+\s*(?:segs?\.?|s)?)/i);
    if (m) stats.time = m[1].trim();
  }
  if (stats.memory === 'N/A') {
    const m = bodyText.match(/Memoria[:\s\t\n]+([0-9.,]+\s*(?:KiB|MiB|KB|MB|B)?)/i);
    if (m) stats.memory = m[1].trim();
  }
  if (!stats.language || stats.language === 'C++') {
    const m = bodyText.match(/Lenguaje(?:\s+del\s+env[íi]o)?[:\s\t\n]+([^\n\r]+)/i);
    if (m) stats.language = m[1].trim();
  }

  return stats;
}

function extraerProblemIdDePagina() {
  const match = document.body.innerText.match(/Problema\s+(\d+)/i);
  return match ? match[1] : null;
}

async function extraerEnunciadoLimpio(problemId) {
  try {
    const res = await fetch(`https://aceptaelreto.com/problem/statement.php?id=${problemId}`);
    if (!res.ok) return { titulo: `Problema ${problemId}`, cuerpo: 'Enunciado disponible en Acepta el Reto.' };

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('script, style, noscript, nav, header, footer, .navbar, .breadcrumb, a').forEach(el => el.remove());

    let titulo = doc.querySelector('h1')?.innerText?.trim() || '';
    titulo = titulo.replace(new RegExp(`^${problemId}\\s*[:-]?\\s*`, 'i'), '').trim();
    if (!titulo) titulo = `Problema ${problemId}`;

    let limites = '';
    const bodyText = doc.body.innerText;
    const limitesMatch = bodyText.match(/Tiempo m[áa]ximo:[^\n]+Memoria m[áa]xima:[^\n]+/i);
    if (limitesMatch) {
      limites = `> **Límites:** \`${limitesMatch[0].replace(/\s+/g, ' ').trim()}\`\n\n`;
    }

    let cuerpoMarkdown = '';
    const elementos = doc.querySelectorAll('h2, h3, p, pre');

    elementos.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const txt = el.innerText.trim();
      if (!txt || txt.includes('Tiempo máximo:') || txt.includes('Acepta el reto, 2013') || txt.includes('JavaScript')) return;

      if (tag === 'h2') cuerpoMarkdown += `\n### ${txt}\n\n`;
      else if (tag === 'h3') cuerpoMarkdown += `\n#### ${txt}\n\n`;
      else if (tag === 'pre') cuerpoMarkdown += `\`\`\`text\n${txt}\n\`\`\`\n\n`;
      else if (tag === 'p') cuerpoMarkdown += `${txt}\n\n`;
    });

    return {
      titulo: titulo,
      cuerpo: (limites + cuerpoMarkdown).trim()
    };
  } catch (err) {
    return { titulo: `Problema ${problemId}`, cuerpo: 'No se pudo cargar el enunciado automáticamente.' };
  }
}