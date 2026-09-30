(() => {
  console.log(">>> [AceptaElReto Sync v3.4] Activo en:", window.location.href);

  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target && target.type === 'file' && target.files && target.files.length > 0) {
      const file = target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const fileContent = event.target.result || '';
        const problemId = obtenerProblemId(file.name);
        const language = detectarLenguaje(file.name);

        const draft = {
          problemId: problemId,
          language: language,
          code: fileContent,
          fileName: file.name,
          timestamp: Date.now()
        };

        chrome.storage.local.set({ lastDraft: draft }, () => {
          console.log(`>>> [AceptaElReto Sync] Archivo local guardado anticipadamente: ${file.name} (${fileContent.length} bytes, Prob: ${problemId})`);
        });
      };

      reader.readAsText(file, 'UTF-8');
    }
  }, true);


  document.addEventListener('input', (e) => {
    if (e.target && e.target.tagName.toLowerCase() === 'textarea') {
      const code = e.target.value;
      if (code && code.trim()) {
        const problemId = obtenerProblemId();
        const language = detectarLenguaje();

        chrome.storage.local.set({
          lastDraft: {
            problemId: problemId,
            language: language,
            code: code,
            timestamp: Date.now()
          }
        });
      }
    }
  }, true);

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || form.tagName.toLowerCase() !== 'form') return;

    const fileInput = form.querySelector('input[type="file"]');
    const textarea = form.querySelector('textarea');

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const draft = {
          problemId: obtenerProblemId(file.name),
          language: detectarLenguaje(file.name),
          code: event.target.result || '',
          fileName: file.name,
          timestamp: Date.now()
        };
        chrome.storage.local.set({ lastDraft: draft });
      };
      reader.readAsText(file, 'UTF-8');
    } else if (textarea && textarea.value.trim()) {
      chrome.storage.local.set({
        lastDraft: {
          problemId: obtenerProblemId(),
          language: detectarLenguaje(),
          code: textarea.value,
          timestamp: Date.now()
        }
      });
    }
  }, true);

  function detectarLenguaje(fileNameOpt) {
    if (fileNameOpt) {
      const lower = fileNameOpt.toLowerCase();
      if (lower.endsWith('.java')) return 'java';
      if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp';
      if (lower.endsWith('.c')) return 'c';
    }

    const langSelect = document.querySelector('select[name="language"], select[name="lang"], select');
    if (langSelect) {
      const val = (langSelect.value || '').toLowerCase();
      const txt = (langSelect.options[langSelect.selectedIndex]?.text || '').toLowerCase();
      if (val.includes('java') || txt.includes('java')) return 'java';
      if (val.includes('c++') || val.includes('cpp') || txt.includes('c++')) return 'cpp';
      if (val.includes('c') || txt.includes('c')) return 'c';
    }
    return 'cpp';
  }

  function obtenerProblemId(fileNameOpt) {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('id');
    if (fromUrl) return fromUrl.trim();

    const inputId = document.querySelector('input[name="id"], input[name="problem"], input[name="problema"]');
    if (inputId && inputId.value.trim()) return inputId.value.trim();

    if (fileNameOpt) {
      const match = fileNameOpt.match(/\b(\d{3,4})\b/);
      if (match) return match[1];
    }

    return '0';
  }

  if (window.location.pathname.includes('submission')) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['lastDraft'], async (data) => {
        const draft = data.lastDraft;
        const { isAccepted, inProgress, veredictoEncontrado } = verificarEstadoEnvio();

        console.log('>>> [AceptaElReto Sync] Diagnóstico detallado:', {
          veredictoLeido: veredictoEncontrado,
          isAccepted: isAccepted,
          inProgress: inProgress,
          borradorEncontrado: !!draft,
          longitudCodigo: draft?.code ? draft.code.length : 0
        });

        if (inProgress && !isAccepted) {
          console.log(`>>> [AceptaElReto Sync] Evaluando (${veredictoEncontrado}). Recargando en 2s...`);
          setTimeout(() => window.location.reload(), 2000);
          return;
        }

        if (isAccepted) {
          const stats = extraerMetricasDesdeDOM();
          const problemId = (draft && draft.problemId && draft.problemId !== '0')
            ? draft.problemId
            : (extraerProblemIdDePagina() || '0');

          const codigoFinal = (draft && draft.code) ? draft.code : extraerCodigoDePagina();
          const statement = await extraerEnunciadoLimpio(problemId);

          console.log(`>>> [AceptaElReto Sync] Enviando a GitHub Problema ${problemId} con código de ${codigoFinal.length} bytes...`);

          chrome.runtime.sendMessage({
            action: 'UPLOAD_TO_GITHUB',
            payload: {
              problemId: problemId,
              language: draft?.language || stats.language || 'cpp',
              code: codigoFinal,
              stats: stats,
              statement: statement
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[AceptaElReto Sync] Error comunicando con background:', chrome.runtime.lastError.message);
            } else if (response && response.success) {
              console.log('>>> [AceptaElReto Sync] ¡ÉXITO! Código y README actualizados en GitHub.');
            } else {
              console.error('>>> [AceptaElReto Sync] Error reportado por background:', response?.error);
            }
          });
        }
      });
    }
  }

  function verificarEstadoEnvio() {
    const fullText = document.body.innerText || '';
    const fullTextLower = fullText.toLowerCase();

    let veredictoEncontrado = '';
    const rows = document.querySelectorAll('tr');
    rows.forEach(r => {
      const cells = Array.from(r.querySelectorAll('th, td'));
      if (cells.length >= 2) {
        const lbl = cells[0].innerText.trim().toLowerCase();
        if (lbl.includes('resultado') || lbl.includes('veredicto') || lbl.includes('estado')) {
          veredictoEncontrado = cells[1].innerText.trim();
        }
      }
    });

    if (!veredictoEncontrado) {
      const m = fullText.match(/(?:resultado|veredicto|estado)[\s:]*([^\n\r]+)/i);
      if (m) veredictoEncontrado = m[1].trim();
    }

    const resLower = veredictoEncontrado.toLowerCase();

    const isAccepted = resLower.includes('aceptad') || 
                       resLower.includes('accept') || 
                       resLower.includes('correct') ||
                       /\bac\b/i.test(veredictoEncontrado) ||
                       fullTextLower.includes('(ac)');

    const inProgress = resLower.includes('queue') || 
                       resLower.includes('iq') || 
                       resLower.includes('compil') || 
                       resLower.includes('run') || 
                       resLower.includes('cola') || 
                       resLower.includes('pend') || 
                       resLower.includes('eval') || 
                       fullTextLower.includes('in queue') || 
                       fullTextLower.includes('(iq)') || 
                       fullTextLower.includes('compiling') || 
                       fullTextLower.includes('running');

    return { isAccepted, inProgress, veredictoEncontrado };
  }

  function extraerCodigoDePagina() {
    const pre = document.querySelector('pre#code, pre.code, pre');
    if (pre && pre.innerText.trim().length > 10) {
      return pre.innerText.trim();
    }
    return '// Solución aceptada en Acepta el Reto';
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
    const link = document.querySelector('a[href*="id="][href*="statement"], a[href*="problem/statement"]');
    if (link) {
      const m = link.href.match(/id=(\d+)/);
      if (m) return m[1];
    }
    const matchText = document.body.innerText.match(/Problema[^\d]*(\d+)/i);
    return matchText ? matchText[1] : null;
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
})();