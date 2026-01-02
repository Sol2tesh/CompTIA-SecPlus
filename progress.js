/* global CISM_QUESTIONS */
(() => {
  const STORAGE_KEY = 'cism_pwa_state_v3';

  const SIM_RANGES = [
    { key: 'sim1', label: 'Exam Simulator #1 (1–100)', min: 1, max: 100 },
    { key: 'sim2', label: 'Exam Simulator #2 (101–200)', min: 101, max: 200 },
    { key: 'sim3', label: 'Exam Simulator #3 (201–300)', min: 201, max: 300 },
    { key: 'sim4', label: 'Exam Simulator #4 (301–400)', min: 301, max: 400 },
    { key: 'sim5', label: 'Exam Simulator #5 (401–500)', min: 401, max: 500 },
    { key: 'sim6', label: 'Exam Simulator #6 (501–600)', min: 501, max: 600 },
  ];

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function computeStats(state) {
    const answered = state.answered || {};
    let attempted = 0, correct = 0, wrong = 0;

    for (const k of Object.keys(answered)) {
      const a = answered[k];
      if (a && a.attempted) attempted += 1;
      if (a && a.attempted && a.correct) correct += 1;
      if (a && a.attempted && a.correct === false) wrong += 1;
    }

    const bookmarks = state.bookmarked ? Object.keys(state.bookmarked).length : 0;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;

    return { attempted, correct, wrong, bookmarks, accuracy };
  }

  function simStats(state) {
    const answered = state.answered || {};
    const out = SIM_RANGES.map(r => ({ ...r, attempted: 0, correct: 0, wrong: 0, accuracy: 0 }));

    for (const k of Object.keys(answered)) {
      const id = Number(k);
      const a = answered[k];
      if (!Number.isFinite(id) || !a || !a.attempted) continue;

      for (const r of out) {
        if (id >= r.min && id <= r.max) {
          r.attempted += 1;
          if (a.correct) r.correct += 1;
          else r.wrong += 1;
          break;
        }
      }
    }

    for (const r of out) {
      r.accuracy = r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0;
    }
    return out;
  }

  function el(id) { return document.getElementById(id); }

  function renderSimTable(rows) {
    const wrap = el('simTableWrap');
    if (!wrap) return;

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,.15)">Simulator</th>
        <th style="text-align:right; padding:8px; border-bottom:1px solid rgba(255,255,255,.15)">Attempted</th>
        <th style="text-align:right; padding:8px; border-bottom:1px solid rgba(255,255,255,.15)">Correct</th>
        <th style="text-align:right; padding:8px; border-bottom:1px solid rgba(255,255,255,.15)">Wrong</th>
        <th style="text-align:right; padding:8px; border-bottom:1px solid rgba(255,255,255,.15)">Accuracy</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid rgba(255,255,255,.08)">${r.label}</td>
        <td style="padding:8px; text-align:right; border-bottom:1px solid rgba(255,255,255,.08)">${r.attempted}</td>
        <td style="padding:8px; text-align:right; border-bottom:1px solid rgba(255,255,255,.08)">${r.correct}</td>
        <td style="padding:8px; text-align:right; border-bottom:1px solid rgba(255,255,255,.08)">${r.wrong}</td>
        <td style="padding:8px; text-align:right; border-bottom:1px solid rgba(255,255,255,.08)">${r.accuracy}%</td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    wrap.innerHTML = '';
    wrap.appendChild(table);
  }

  function renderWeakAreas() {
    const hint = el('weakHint');
    const wrap = el('weakWrap');
    if (!wrap) return;

    // We can only do domain/topic breakdown if question data includes them.
    const qs = Array.isArray(window.CISM_QUESTIONS) ? window.CISM_QUESTIONS : [];
    const hasDomain = qs.some(q => q && q.domain != null);
    const hasTopic = qs.some(q => q && q.topic != null);

    if (!hasDomain && !hasTopic) {
      hint.textContent = 'Your current question set has domain/topic set to null. Add domain/topic fields to questions to unlock breakdown charts.';
      wrap.innerHTML = '';
      return;
    }

    // If in the future you add domain/topic data, this section can be extended.
    hint.textContent = 'Domain/topic data detected — you can extend this section to show weakest areas.';
    wrap.innerHTML = '<p style="opacity:.8; margin:0">Next: we can show weakest domains/topics and add a “Practice weak areas” button.</p>';
  }

  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function init() {
    const state = loadState();
    const stats = computeStats(state);

    el('pAttempted').textContent = String(stats.attempted);
    el('pCorrect').textContent = String(stats.correct);
    el('pWrong').textContent = String(stats.wrong);
    el('pBookmarks').textContent = String(stats.bookmarks);
    el('pAccuracy').textContent = String(stats.accuracy) + '%';

    renderSimTable(simStats(state));
    renderWeakAreas();

    const btnExport = el('btnExport');
    const btnReset = el('btnReset');
    const importFile = el('importFile');

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const payload = {
          exportedAt: new Date().toISOString(),
          storageKey: STORAGE_KEY,
          state: loadState()
        };
        downloadJSON('cism-progress-backup.json', payload);
      });
    }

    if (importFile) {
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const payload = JSON.parse(text);
          const next = payload && payload.state ? payload.state : payload;

          if (!next || typeof next !== 'object') throw new Error('Invalid JSON format.');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          alert('Imported! Reloading…');
          location.reload();
        } catch (err) {
          alert('Import failed: ' + (err && err.message ? err.message : String(err)));
        } finally {
          importFile.value = '';
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (!confirm('Reset all local progress on this device? This cannot be undone.')) return;
        localStorage.removeItem(STORAGE_KEY);
        // Optional timer key (safe if missing)
        localStorage.removeItem('cism_exam_timer_v1');
        alert('Progress reset. Reloading…');
        location.reload();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
