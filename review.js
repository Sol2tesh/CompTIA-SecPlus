/* global CISM_QUESTIONS */
(() => {
  const STORAGE_KEY = 'cism_pwa_state_v3';

  const $ = (id) => document.getElementById(id);

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalize(s){ return String(s || '').toLowerCase().trim(); }

  function buildIndex() {
    const qs = Array.isArray(window.CISM_QUESTIONS) ? window.CISM_QUESTIONS : [];
    const byId = new Map();
    for (const q of qs) {
      const id = Number(q?.id);
      if (Number.isFinite(id)) byId.set(id, q);
    }
    return byId;
  }

  function getCorrectText(q) {
    const correct = q?.answer;
    if (correct == null) return '';
    // support numeric index or letter
    const choices = q?.choices || q?.options || q?.answers || [];
    if (typeof correct === 'number' && choices[correct] != null) return choices[correct];
    if (typeof correct === 'string') {
      const letter = correct.trim().toUpperCase();
      const map = { A:0, B:1, C:2, D:3, E:4, F:5 };
      if (map[letter] != null && choices[map[letter]] != null) return choices[map[letter]];
      // sometimes answer stored as full text
      return correct;
    }
    return '';
  }

  function getUserText(q, attempt) {
    const chosen = attempt?.selected;
    const choices = q?.choices || q?.options || q?.answers || [];
    if (chosen == null) return '';
    if (typeof chosen === 'number' && choices[chosen] != null) return choices[chosen];
    if (typeof chosen === 'string') {
      const letter = chosen.trim().toUpperCase();
      const map = { A:0, B:1, C:2, D:3, E:4, F:5 };
      if (map[letter] != null && choices[map[letter]] != null) return choices[map[letter]];
      return chosen;
    }
    return '';
  }

  function renderItem(container, id, q, attempt, bookmarked) {
    const card = document.createElement('div');
    card.style.border = '1px solid rgba(255,255,255,.12)';
    card.style.borderRadius = '16px';
    card.style.padding = '14px';
    card.style.background = 'rgba(255,255,255,.04)';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.gap = '12px';
    title.innerHTML = `
      <div style="font-weight:800; opacity:.95;">Question #${id}</div>
      <div style="opacity:.75;">${bookmarked ? '🔖 Bookmarked' : ''}</div>
    `;

    const question = document.createElement('div');
    question.style.marginTop = '10px';
    question.style.fontSize = '16px';
    question.style.lineHeight = '1.45';
    question.textContent = q?.question || q?.prompt || '(Question text missing)';

    const user = getUserText(q, attempt);
    const correct = getCorrectText(q);

    const meta = document.createElement('div');
    meta.style.marginTop = '10px';
    meta.style.display = 'grid';
    meta.style.gap = '6px';
    meta.innerHTML = `
      <div style="opacity:.9;"><strong>Your answer:</strong> <span style="opacity:.85;">${escapeHtml(user || '—')}</span></div>
      <div style="opacity:.9;"><strong>Correct:</strong> <span style="opacity:.85;">${escapeHtml(correct || '—')}</span></div>
    `;

    const exp = document.createElement('div');
    exp.style.marginTop = '10px';
    exp.style.opacity = '.85';
    exp.style.fontSize = '14px';
    exp.style.lineHeight = '1.45';
    exp.innerHTML = `<strong>Explanation:</strong> ${escapeHtml(q?.explanation || q?.rationale || '—')}`;

    const actions = document.createElement('div');
    actions.style.marginTop = '12px';
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.flexWrap = 'wrap';

    const btnPractice = document.createElement('a');
    btnPractice.className = 'btn subtle';
    btnPractice.href = `practice.html?jump=${encodeURIComponent(id)}`;
    btnPractice.textContent = 'Open in Practice';

    const btnToggleBm = document.createElement('button');
    btnToggleBm.className = 'btn ghost';
    btnToggleBm.type = 'button';
    btnToggleBm.textContent = bookmarked ? 'Remove Bookmark' : 'Bookmark';
    btnToggleBm.addEventListener('click', () => {
      const state = loadState();
      state.bookmarked = state.bookmarked || {};
      if (state.bookmarked[String(id)]) delete state.bookmarked[String(id)];
      else state.bookmarked[String(id)] = true;
      saveState(state);
      // re-render fast by toggling label
      btnToggleBm.textContent = state.bookmarked[String(id)] ? 'Remove Bookmark' : 'Bookmark';
      title.querySelector('div:last-child').textContent = state.bookmarked[String(id)] ? '🔖 Bookmarked' : '';
    });

    actions.appendChild(btnPractice);
    actions.appendChild(btnToggleBm);

    card.appendChild(title);
    card.appendChild(question);
    card.appendChild(meta);
    card.appendChild(exp);
    card.appendChild(actions);

    container.appendChild(card);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = String(s ?? '');
    return div.innerHTML;
  }

  function getWrongIds(state) {
    const answered = state.answered || {};
    const wrong = [];
    for (const k of Object.keys(answered)) {
      const a = answered[k];
      if (a && a.attempted && a.correct === false) wrong.push(Number(k));
    }
    wrong.sort((a,b) => a-b);
    return wrong.filter(Number.isFinite);
  }

  function render() {
    const state = loadState();
    const idx = buildIndex();

    const search = normalize($('searchBox')?.value);
    const onlyBm = $('btnOnlyBookmarked')?.dataset?.on === '1';

    const bookmarkedMap = state.bookmarked || {};
    const wrongIdsAll = getWrongIds(state);

    let wrongIds = wrongIdsAll.slice();

    if (onlyBm) {
      wrongIds = wrongIds.filter(id => !!bookmarkedMap[String(id)]);
    }

    if (search) {
      wrongIds = wrongIds.filter(id => {
        const q = idx.get(id);
        const txt = normalize((q?.question || q?.prompt || '') + ' ' + (q?.explanation || ''));
        return txt.includes(search);
      });
    }

    $('wrongCount').textContent = String(wrongIdsAll.length);
    $('showingCount').textContent = String(wrongIds.length);

    const list = $('mistakeList');
    const empty = $('emptyState');
    list.innerHTML = '';

    if (wrongIds.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    for (const id of wrongIds) {
      const q = idx.get(id);
      const attempt = (state.answered || {})[String(id)] || {};
      const bookmarked = !!bookmarkedMap[String(id)];
      renderItem(list, id, q, attempt, bookmarked);
    }
  }

  function init() {
    const searchBox = $('searchBox');
    const bmBtn = $('btnOnlyBookmarked');
    const clearBtn = $('btnClearWrong');

    if (searchBox) searchBox.addEventListener('input', render);

    if (bmBtn) {
      bmBtn.dataset.on = '0';
      bmBtn.addEventListener('click', () => {
        const on = bmBtn.dataset.on === '1';
        bmBtn.dataset.on = on ? '0' : '1';
        bmBtn.textContent = on ? 'Only Bookmarked' : 'Showing Bookmarked';
        render();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('Clear only mistakes (wrong answers) from this device?')) return;
        const state = loadState();
        const answered = state.answered || {};
        for (const k of Object.keys(answered)) {
          const a = answered[k];
          if (a && a.attempted && a.correct === false) {
            // keep the record but mark not attempted? (so progress isn't fully wiped)
            // safer: delete the entry
            delete answered[k];
          }
        }
        state.answered = answered;
        saveState(state);
        render();
      });
    }

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
