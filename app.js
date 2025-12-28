
/* global CISM_QUESTIONS */
(() => {
  const PAGE_SIZE = 50;

  // Exam simulator buckets (based on question ID ranges)
  const SIMULATORS = [
    { value: 'all', label: 'All questions', min: null, max: null },
    { value: 'sim1', label: 'Exam Simulator #1 (1–100)', min: 1, max: 100 },
    { value: 'sim2', label: 'Exam Simulator #2 (101–200)', min: 101, max: 200 },
    { value: 'sim3', label: 'Exam Simulator #3 (201–300)', min: 201, max: 300 },
    { value: 'sim4', label: 'Exam Simulator #4 (301–400)', min: 301, max: 400 },
    { value: 'sim5', label: 'Exam Simulator #5 (401–500)', min: 401, max: 500 },
    { value: 'sim6', label: 'Exam Simulator #6 (501–600)', min: 501, max: 600 },
  ];


  // Mode: practice vs exam (exam shows countdown timer)
  const MODE = (document.body && document.body.dataset && document.body.dataset.mode) ? document.body.dataset.mode : 'practice';
  const IS_EXAM = MODE === 'exam';
  // Exam duration: 1 hour 40 minutes (100 minutes)
  const EXAM_MINUTES = 100;
  const TIMER_KEY = 'cism_exam_timer_v1';

  // Timer internals so we can reset on simulator changes
  let examTimerInterval = null;
  let examTimerState = null;

  function formatHMS(totalSeconds){
    const s = Math.max(0, Math.floor(totalSeconds));
    const hh = String(Math.floor(s / 3600)).padStart(2,'0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2,'0');
    const ss = String(s % 60).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function initExamTimer(){
    const el = document.getElementById('examTimer');
    if (!IS_EXAM || !el) return;

    // Ensure only one interval runs
    if (examTimerInterval) {
      clearInterval(examTimerInterval);
      examTimerInterval = null;
    }

    // Store end timestamp so refresh keeps time
    try { examTimerState = JSON.parse(sessionStorage.getItem(TIMER_KEY) || 'null'); } catch { examTimerState = null; }
    if (!examTimerState || !examTimerState.endsAt){
      examTimerState = { endsAt: Date.now() + EXAM_MINUTES * 60 * 1000 };
      sessionStorage.setItem(TIMER_KEY, JSON.stringify(examTimerState));
    }

    const tick = () => {
      const remaining = Math.max(0, (examTimerState?.endsAt || 0) - Date.now());
      const secs = remaining / 1000;
      el.textContent = formatHMS(secs);

      if (remaining <= 0){
        el.textContent = '00:00:00';
        document.body.classList.add('exam-ended');
        // Soft lock (keep review possible, but prevent answering)
        document.querySelectorAll('input[type="radio"], input[type="checkbox"], button').forEach(b=>{
          if (b && b.id !== 'prevBtn' && b.id !== 'nextBtn') b.disabled = true;
        });
        if (examTimerInterval) {
          clearInterval(examTimerInterval);
          examTimerInterval = null;
        }
      }
    };

    tick();
    examTimerInterval = setInterval(tick, 500);
  }

  function resetExamTimer(){
    if (!IS_EXAM) return;
    const el = document.getElementById('examTimer');
    if (!el) return;

    // Reset end time
    examTimerState = { endsAt: Date.now() + EXAM_MINUTES * 60 * 1000 };
    try { sessionStorage.setItem(TIMER_KEY, JSON.stringify(examTimerState)); } catch (e) {}

    // If the exam had ended previously, unlock UI again
    document.body.classList.remove('exam-ended');
    document.querySelectorAll('input[type="radio"], input[type="checkbox"], button').forEach(b=>{
      if (!b) return;
      // keep nav buttons enabled
      if (b.id === 'prevBtn' || b.id === 'nextBtn') return;
      b.disabled = false;
    });

    // Restart ticking
    initExamTimer();
  }

  const domainSelect = document.getElementById('domainSelect');
  const pageSelect = document.getElementById('pageSelect');
  const filterSelect = document.getElementById('filterSelect');

  // Inject "Exam simulator" dropdown (works for both Practice and Exam pages)
  let simulatorSelect = document.getElementById('simulatorSelect');
  if (!simulatorSelect) {
    const grid = document.querySelector('.controls-grid');
    if (grid) {
      const label = document.createElement('label');
      label.className = 'field';
      const span = document.createElement('span');
      span.textContent = 'Exam simulator';
      simulatorSelect = document.createElement('select');
      simulatorSelect.id = 'simulatorSelect';
      for (const s of SIMULATORS) {
        const opt = document.createElement('option');
        opt.value = s.value;
        opt.textContent = s.label;
        simulatorSelect.appendChild(opt);
      }
      label.appendChild(span);
      label.appendChild(simulatorSelect);

      // Insert before nav buttons if present, else append at end
      const navBtns = grid.querySelector('.nav-btns');
      if (navBtns) grid.insertBefore(label, navBtns);
      else grid.appendChild(label);
    }

  // Remove Domain dropdown (use Exam simulator only)
  if (domainSelect) {
    try {
      const field = domainSelect.closest('.field');
      if (field) field.remove();
    } catch (e) {}
  }
  }

  const totalCountEl = document.getElementById('totalCount');
  const pageScoreEl = document.getElementById('pageScore');
  const overallScoreEl = document.getElementById('overallScore');
  const statusLine = document.getElementById('statusLine');
  const questionList = document.getElementById('questionList');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  // Persist across reloads
  const STORAGE_KEY = 'cism_pwa_state_v3';
  const loadState = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  };
  const saveState = (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));

  // Optional: quick reset for local progress (useful during study/testing)
  const resetBtn = document.getElementById('resetProgress');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const ok = window.confirm('Reset saved progress, bookmarks, and scores on this device?');
      if (!ok) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      try { sessionStorage.removeItem(TIMER_KEY); } catch (e) {}
      // Reload to re-initialize state + (if in Exam mode) restart the timer cleanly.
      window.location.reload();
    });
  }

  const state = {
    domain: 'all',        // 'all' or '1'..'4'
    simulator: 'all',   // all | sim1..sim6 (question ID ranges)
    filter: 'all',      // all | bookmarked | weak | unanswered
    bookmarked: {},     // { [questionId]: true }
    page: 1,
    answered: {},         // { [questionId]: { chosen:'A', correct:true, revealed:true } }
    overall: { correct: 0, attempted: 0 },
    // Merge any previously-saved state (progress, bookmarks, etc.)
    ...loadState()
  };


  // Force domain filter off
  state.domain = 'all';
  // Ensure overall counters match answered map (in case older state)
  const recomputeOverall = () => {
    let attempted = 0, correct = 0;
    for (const k of Object.keys(state.answered || {})) {
      const a = state.answered[k];
      if (a && a.attempted) attempted += 1;
      if (a && a.correct) correct += 1;
    }
    state.overall = { correct, attempted };
  };
  if (!state.overall) state.overall = { correct: 0, attempted: 0 };
  if (!state.bookmarked) state.bookmarked = {};
  if (!state.filter) state.filter = 'all';
  if (!state.answered) state.answered = {};
  recomputeOverall();

  // Helpers
  const uniqDomains = () => {
    const set = new Set();
    for (const q of CISM_QUESTIONS) {
      if (q.domain != null) set.add(String(q.domain));
    }
    return Array.from(set).sort((a,b)=>Number(a)-Number(b));
  };

  
  const filteredQuestions = () => {
    let list = (Array.isArray(CISM_QUESTIONS) ? CISM_QUESTIONS : []).slice();

    // domain filter removed (using Exam simulator only)

    // exam simulator filter (by question id range)
    if (state.simulator && state.simulator !== 'all') {
      const sim = SIMULATORS.find(s => s.value === state.simulator);
      if (sim && sim.min != null && sim.max != null) {
        list = list.filter(q => {
          const idNum = Number(q.id);
          return Number.isFinite(idNum) && idNum >= sim.min && idNum <= sim.max;
        });
      }
    }

    // extra filter
    if (state.filter === 'bookmarked') {
      list = list.filter(q => !!state.bookmarked[String(q.id)]);
    } else if (state.filter === 'weak') {
      // weak area = attempted AND incorrect
      list = list.filter(q => {
        const a = state.answered[String(q.id)];
        return !!(a && a.attempted && a.correct === false);
      });
    } else if (state.filter === 'unanswered') {
      list = list.filter(q => {
        const a = state.answered[String(q.id)];
        return !(a && a.attempted);
      });
    }

    return list;
  };


  const totalPages = () => Math.max(1, Math.ceil(filteredQuestions().length / PAGE_SIZE));

  const clampPage = () => {
    const tp = totalPages();
    if (state.page < 1) state.page = 1;
    if (state.page > tp) state.page = tp;
  };

  const optionText = (q, letter) => (q.options && q.options[letter]) ? q.options[letter] : '';

  const buildDomainSelect = () => {
    if (!domainSelect) return;
    domainSelect.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'All Domains';
    domainSelect.appendChild(optAll);

    for (const d of uniqDomains()) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `Domain ${d}`;
      domainSelect.appendChild(opt);
    }
    domainSelect.value = state.domain;
  };

  const buildFilterSelect = () => {
    if (!filterSelect) return;
    const opts = [
      { v: 'all', t: 'All' },
      { v: 'bookmarked', t: 'Bookmarked' },
      { v: 'weak', t: 'Weak Areas (Incorrect)' },
      { v: 'unanswered', t: 'Unanswered' },
    ];
    filterSelect.innerHTML = opts.map(o => `<option value="${o.v}">${o.t}</option>`).join('');
    filterSelect.value = state.filter || 'all';
  };
  const buildSimulatorSelect = () => {
    if (!simulatorSelect) return;
    // ensure options exist (in case select was present in HTML)
    if (!simulatorSelect.options || simulatorSelect.options.length === 0) {
      simulatorSelect.innerHTML = '';
      for (const s of SIMULATORS) {
        const opt = document.createElement('option');
        opt.value = s.value;
        opt.textContent = s.label;
        simulatorSelect.appendChild(opt);
      }
    }
    simulatorSelect.value = state.simulator || 'all';
  };



  const buildPageSelect = () => {
    clampPage();
    const tp = totalPages();
    pageSelect.innerHTML = '';
    for (let i = 1; i <= tp; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Page ${i} / ${tp}`;
      pageSelect.appendChild(opt);
    }
    pageSelect.value = String(state.page);
  };

  const pageSlice = () => {
    const list = filteredQuestions();
    const start = (state.page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  };

  const computePageScore = (pageQs) => {
    let attempted = 0, correct = 0;
    for (const q of pageQs) {
      const a = state.answered[String(q.id)];
      if (a && a.attempted) attempted++;
      if (a && a.correct) correct++;
    }
    return { attempted, correct };
  };

  const setStatusLine = () => {
    const fq = filteredQuestions();
    const tp = totalPages();
    const domainLabel = (state.domain === 'all') ? 'All Domains' : `Domain ${state.domain}`;
    const simObj = SIMULATORS.find(s => s.value === (state.simulator || 'all')) || SIMULATORS[0];
    const simLabel = (simObj && simObj.value !== 'all') ? simObj.label : null;

    const pageCount = pageSlice().length;
    statusLine.textContent =
      `Showing ${pageCount} questions • ${domainLabel}` +
      (simLabel ? ` • ${simLabel}` : '') +
      ` • Page ${state.page} / ${tp}`;

    totalCountEl.textContent = String(fq.length);
  };

  const render = () => {
    clampPage();
    buildDomainSelect();
    buildSimulatorSelect();
    buildPageSelect();
    buildFilterSelect();

    const pageQs = pageSlice();
    const ps = computePageScore(pageQs);

    pageScoreEl.textContent = `${ps.correct} / ${ps.attempted}`;
    overallScoreEl.textContent = `${state.overall.correct} / ${state.overall.attempted}`;
    setStatusLine();
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= totalPages();

    questionList.innerHTML = '';

    for (const q of pageQs) {
      const card = document.createElement('section');
      card.className = 'qcard';

      const head = document.createElement('div');
      head.className = 'qhead';
      const topicText = q.topic ? q.topic : (q.domain ? `Domain ${q.domain}` : 'Topic');

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = `Question #${q.id} (Topic: ${topicText})`;
      head.appendChild(title);

      const bm = document.createElement('button');
      bm.className = 'bm-btn' + (state.bookmarked[String(q.id)] ? ' active' : '');
      bm.type = 'button';
      bm.title = state.bookmarked[String(q.id)] ? 'Remove bookmark' : 'Bookmark';
      bm.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>`;
      bm.addEventListener('click', (e) => {
        e.stopPropagation();
        const k = String(q.id);
        state.bookmarked[k] = !state.bookmarked[k];
        if (!state.bookmarked[k]) delete state.bookmarked[k];
        saveState(state);
        render();
      });
      head.appendChild(bm);

      card.appendChild(head);

      const body = document.createElement('div');
      body.className = 'qbody';

      const qtext = document.createElement('p');
      qtext.className = 'qtext';
      qtext.textContent = q.question || '';
      body.appendChild(qtext);

      const badgeRow = document.createElement('div');
      badgeRow.className = 'badge-row';
      const ans = state.answered[String(q.id)] || null;
      if (ans && ans.attempted) {
        const b = document.createElement('div');
        b.className = 'badge ' + (ans.correct ? 'ok' : 'bad');
        b.textContent = ans.correct ? 'Correct' : 'Incorrect';
        badgeRow.appendChild(b);
      } else {
        const b = document.createElement('div');
        b.className = 'badge';
        b.textContent = 'Unanswered';
        badgeRow.appendChild(b);
      }
      if (state.bookmarked[String(q.id)]) {
        const b2 = document.createElement('div');
        b2.className = 'badge';
        b2.textContent = 'Bookmarked';
        badgeRow.appendChild(b2);
      }
      body.appendChild(badgeRow);

      const answerState = state.answered[String(q.id)] || null;
      const locked = !!(answerState && answerState.attempted); // lock after first attempt

      const letters = ['A','B','C','D'];
      for (const L of letters) {
        if (!q.options || !q.options[L]) continue;

        const opt = document.createElement('div');
        opt.className = 'opt' + (locked ? ' disabled' : '');
        opt.dataset.letter = L;
        opt.textContent = `${L}. ${optionText(q, L)}`;

        // If already answered, re-apply styling
        if (answerState && answerState.revealed) {
          const correct = (q.answer || '').trim().toUpperCase();
          if (L === correct) opt.classList.add('correct');
          if (answerState.chosen === L && !answerState.correct) opt.classList.add('wrong');
        }

        opt.addEventListener('click', () => {
          if (locked) return;
          handleChoice(q, L);
        });

        body.appendChild(opt);
      }

      const actions = document.createElement('div');
      actions.className = 'actions';

      const revealBtn = document.createElement('button');
      revealBtn.className = 'btn primary';
      revealBtn.type = 'button';

      const answerBox = document.createElement('div');
      answerBox.className = 'answerBox';
      const ansLine = document.createElement('div');
      ansLine.className = 'answerLine';
      ansLine.textContent = 'Answer:';
      const ansText = document.createElement('div');
      ansText.className = 'answerText';
      const correctLetter = (q.answer || '').trim().toUpperCase();
      ansText.textContent = correctLetter ? `${correctLetter}. ${optionText(q, correctLetter)}` : '—';
      answerBox.appendChild(ansLine);
      answerBox.appendChild(ansText);

      const feedback = document.createElement('div');
      feedback.className = 'feedback';

      // Initial reveal state
      if (answerState && answerState.revealed) {
        answerBox.classList.add('visible');
        revealBtn.textContent = 'Solution Revealed';
        revealBtn.disabled = true;
        feedback.textContent = answerState.correct ? 'Correct.' : 'Incorrect.';
        feedback.classList.add(answerState.correct ? 'good' : 'bad');
      } else {
        revealBtn.textContent = 'Solution Reveal';
        revealBtn.disabled = false;
      }

      revealBtn.addEventListener('click', () => {
        if (answerState && answerState.revealed) return;
        // reveal without scoring if not attempted
        const existing = state.answered[String(q.id)] || { attempted:false, correct:false, chosen:null };
        existing.revealed = true;
        state.answered[String(q.id)] = existing;
        saveState(state);
        render();
      });

      actions.appendChild(revealBtn);

      // Next question button (scrolls to next card within page)
      const nextBtnQ = document.createElement('button');
      nextBtnQ.className = 'btn secondary';
      nextBtnQ.type = 'button';
      nextBtnQ.textContent = 'Next Question';
      nextBtnQ.addEventListener('click', () => {
        const nextCard = card.nextElementSibling;
        if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else if (nextBtn) nextBtn.click();
      });
      actions.appendChild(nextBtnQ);

      body.appendChild(actions);
      body.appendChild(feedback);
      body.appendChild(answerBox);

      card.appendChild(body);
      questionList.appendChild(card);
    }

    saveState(state);
  };

  const handleChoice = (q, chosenLetter) => {
    const correct = (q.answer || '').trim().toUpperCase();
    const isCorrect = chosenLetter === correct;

    // update state (first attempt only)
    state.answered[String(q.id)] = {
      chosen: chosenLetter,
      correct: isCorrect,
      revealed: true,
      attempted: true
    };

    // overall
    state.overall.attempted += 1;
    if (isCorrect) state.overall.correct += 1;

    saveState(state);
    render();
  };

  // Events

  // Filter dropdown
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      state.filter = filterSelect.value || 'all';
      state.page = 1;
      saveState(state);
      render();
    });
  }

  // Exam simulator dropdown
  if (simulatorSelect) {
    simulatorSelect.addEventListener('change', () => {
      state.simulator = simulatorSelect.value || 'all';
      state.page = 1;

      // Exam mode: restart the 1h40m timer whenever the simulator changes
      if (IS_EXAM) {
        resetExamTimer();
      }

      saveState(state);
      render();
    });
  }
  if (domainSelect) {
    domainSelect.addEventListener('change', () => {
    state.domain = domainSelect.value;
    state.page = 1;
    saveState(state);
    render();
    });
  }
  if (pageSelect) {
    pageSelect.addEventListener('change', () => {
    state.page = Number(pageSelect.value);
    saveState(state);
    render();
    });
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
    state.page -= 1;
    saveState(state);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
    state.page += 1;
    saveState(state);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // PWA SW
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }

  initExamTimer();
  render();
})();


// Theme toggle (shared across pages)
(function initThemeToggle(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const KEY = 'cism_theme';
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch(e) {}
    // Update icon: sun for dark->light? Keep simple
    btn.textContent = (theme === 'light') ? '🌙' : '🌞';
    btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  };

  let saved = 'dark';
  try { saved = localStorage.getItem(KEY) || 'dark'; } catch(e) {}
  if (saved !== 'light' && saved !== 'dark') saved = 'dark';
  setTheme(saved);

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    setTheme(current === 'light' ? 'dark' : 'light');
  });
})();

