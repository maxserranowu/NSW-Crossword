/* The Crossword — Nancy Serrano-Wu archive
   Renders all puzzles, charts, and calendar from data.json */

let DATA = null;
let FILTERED = [];

// venue → tile class mapping
const VENUE_TILE = {
  'Slate':                'tile-Slate',
  'NYT':                  'tile-NYT',
  'Puzzmo':               'tile-Puzzmo',
  'LA Times':             'tile-LATimes',
  'WSJ':                  'tile-WSJ',
  'Inkubator':            'tile-Inkubator',
  'Universal':            'tile-Universal',
  'AVCX':                 'tile-AVCX',
  'Lil AVC X':            'tile-LilAVCX',
  'The Modern Crossword': 'tile-Modern',
};
function tileClass(v) { return VENUE_TILE[v] || 'tile-Other'; }

// Pick a single seed letter for a tile from a title or venue
function tileLetter(p) {
  if (p.title) {
    const stripped = p.title.replace(/[^A-Za-z]/g, '');
    if (stripped) return stripped[0].toUpperCase();
  }
  return p.venue[0];
}

// ----- INIT -----
async function init() {
  const res = await fetch('data.json');
  DATA = await res.json();
  FILTERED = DATA.puzzles;

  setTodayDate();
  renderHero();
  renderHeroTiles();
  renderCardStrip();
  initFilters();
  renderArchive();
  renderStats();
  renderCharts();
  renderVenueList();
  renderCalendar();
  setupModal();
  setupSmoothScroll();
}

function setTodayDate() {
  const d = new Date();
  const opts = { weekday:'long', month:'long', day:'numeric', year:'numeric' };
  document.getElementById('todayDate').textContent = d.toLocaleDateString('en-US', opts);
}

// ----- HERO -----
function renderHero() {
  const latest = DATA.puzzles[0];
  document.getElementById('latestTitle').textContent = latest.title || 'Untitled Puzzle';
  document.getElementById('latestMeta').textContent =
    `${latest.venue} · ${latest.day_of_week}, ${latest.date_display}` +
    (latest.letters_clue ? ` · ${latest.letters_clue}` : '');
  const btn = document.getElementById('latestPlayBtn');
  if (latest.url) {
    btn.href = latest.url;
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

function renderHeroTiles() {
  // Build a 5x5 grid that spells "NANCY" diagonally — playful homage to NYT mini graphic
  const wrap = document.getElementById('heroTiles');
  wrap.innerHTML = '';
  // pattern: 25 cells. Fill with letters and color blocks. Some empty (black) cells.
  const pattern = [
    {l:'N', c:'b1'}, {l:'A', c:'b4'}, {l:'',  c:'empty'}, {l:'X', c:'b3'}, {l:'W', c:'b2'},
    {l:'S', c:'b2'}, {l:'E', c:'b1'}, {l:'R', c:'b6'}, {l:'',  c:'empty'}, {l:'O', c:'b4'},
    {l:'',  c:'empty'}, {l:'R', c:'b3'}, {l:'A', c:'b1'}, {l:'N', c:'b5'}, {l:'O', c:'b6'},
    {l:'L', c:'b7'}, {l:'A', c:'b5'}, {l:'',  c:'empty'}, {l:'C', c:'b1'}, {l:'Y', c:'b4'},
    {l:'U', c:'b6'}, {l:'',  c:'empty'}, {l:'N', c:'b2'}, {l:'S', c:'b3'}, {l:'W', c:'b1'},
  ];
  pattern.forEach(p => {
    const d = document.createElement('div');
    d.className = `hero-tile ${p.c}`;
    d.textContent = p.l;
    wrap.appendChild(d);
  });
}

// ----- CARD STRIP — most recent 4 puzzles -----
function renderCardStrip() {
  const strip = document.getElementById('cardStrip');
  strip.innerHTML = '';
  DATA.puzzles.slice(1, 5).forEach(p => {
    strip.appendChild(makeCard(p));
  });
}

function makeCard(p) {
  const el = document.createElement('div');
  el.className = 'puzzle-card';
  el.dataset.idx = DATA.puzzles.indexOf(p);
  el.innerHTML = `
    <div class="pc-tile ${tileClass(p.venue)}">${tileLetter(p)}</div>
    <div class="pc-venue">${p.venue}</div>
    <h3 class="pc-title">${p.title || 'Untitled'}</h3>
    <div class="pc-meta">
      <span>${p.date_display}</span>
      <span class="pc-day">${p.day_of_week.slice(0,3)}</span>
    </div>
  `;
  el.addEventListener('click', () => openModal(p));
  return el;
}

// ----- ARCHIVE -----
function initFilters() {
  const venueSel = document.getElementById('venueFilter');
  const venues = Object.keys(DATA.stats.venues).sort((a,b) => DATA.stats.venues[b] - DATA.stats.venues[a]);
  venues.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = `${v} (${DATA.stats.venues[v]})`;
    venueSel.appendChild(o);
  });

  const yearSel = document.getElementById('yearFilter');
  const years = Object.keys(DATA.stats.years).sort((a,b) => b - a);
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = y; o.textContent = `${y} (${DATA.stats.years[y]})`;
    yearSel.appendChild(o);
  });

  const search = document.getElementById('searchBox');
  [search, venueSel, yearSel].forEach(el => el.addEventListener('input', applyFilters));
  document.getElementById('clearFilters').addEventListener('click', () => {
    search.value = ''; venueSel.value = ''; yearSel.value = '';
    applyFilters();
  });
}

function applyFilters() {
  const q = document.getElementById('searchBox').value.trim().toLowerCase();
  const v = document.getElementById('venueFilter').value;
  const y = document.getElementById('yearFilter').value;
  FILTERED = DATA.puzzles.filter(p => {
    if (v && p.venue !== v) return false;
    if (y && String(p.year) !== y) return false;
    if (q) {
      const hay = [p.title, p.venue, p.date_display, p.day_of_week, p.letters_clue, p.full_title]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  renderArchive();
}

function renderArchive() {
  const list = document.getElementById('archiveList');
  document.getElementById('archiveCount').textContent =
    `${FILTERED.length} of ${DATA.puzzles.length} puzzles`;
  list.innerHTML = '';
  FILTERED.forEach(p => {
    const row = document.createElement('div');
    row.className = 'archive-row';
    row.innerHTML = `
      <div class="ar-tile ${tileClass(p.venue)}">${tileLetter(p)}</div>
      <div>
        <div class="ar-date">${p.date_display}</div>
        <div class="ar-day">${p.day_of_week}</div>
      </div>
      <div class="ar-venue">${p.venue}</div>
      <div class="ar-title">${p.title ? p.title : '<em>Untitled puzzle</em>'}${p.co_constructor ? ` <em>· w/ ${p.co_constructor}</em>` : ''}</div>
      <div class="ar-arrow">›</div>
    `;
    row.addEventListener('click', () => openModal(p));
    list.appendChild(row);
  });
  if (FILTERED.length === 0) {
    list.innerHTML = `<div style="padding:48px 8px; color:var(--muted); text-align:center; font-size:14px;">No puzzles match your filters.</div>`;
  }
}

// ----- STATS -----
function renderStats() {
  const s = DATA.stats;
  document.getElementById('statTotal').textContent = s.total;
  document.getElementById('statVenues').textContent = Object.keys(s.venues).length;
  document.getElementById('statYears').textContent = Object.keys(s.years).length;
  document.getElementById('statDebut').textContent = s.first_date_display.split(',')[1].trim();
}

function renderCharts() {
  // Venue chart
  drawBarChart('venueChart', DATA.stats.venues, true);
  // Year chart
  const yearsObj = {};
  Object.keys(DATA.stats.years).sort().forEach(y => yearsObj[y] = DATA.stats.years[y]);
  drawBarChart('yearChart', yearsObj, false);
  // Day of week chart
  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dows = {};
  dayOrder.forEach(d => dows[d] = DATA.stats.days[d] || 0);
  drawBarChart('dowChart', dows, false);
}

function drawBarChart(elId, obj, sortByValue) {
  const container = document.getElementById(elId);
  container.innerHTML = '';
  let entries = Object.entries(obj);
  if (sortByValue) entries.sort((a,b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]));
  entries.forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const pct = (v / max * 100).toFixed(1);
    row.innerHTML = `
      <div class="bar-label" title="${k}">${k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-num">${v}</div>
    `;
    container.appendChild(row);
  });
}

function renderVenueList() {
  const ul = document.getElementById('venueList');
  ul.innerHTML = '';
  Object.entries(DATA.stats.venues)
    .sort((a,b) => b[1] - a[1])
    .forEach(([v, n]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="vl-name">${v}</span><span class="vl-count">${n} ${n === 1 ? 'puzzle' : 'puzzles'}</span>`;
      ul.appendChild(li);
    });
}

// ----- CALENDAR HEATMAP (per year) -----
function renderCalendar() {
  const wrap = document.getElementById('calendarHeatmap');
  wrap.innerHTML = '';
  const years = Object.keys(DATA.stats.years).sort();

  // Build map: YYYY-MM-DD -> [puzzles]
  const dateMap = {};
  DATA.puzzles.forEach(p => {
    if (!dateMap[p.date]) dateMap[p.date] = [];
    dateMap[p.date].push(p);
  });

  years.forEach(year => {
    const yEl = document.createElement('div');
    yEl.className = 'cal-year';
    const label = document.createElement('div');
    label.className = 'cal-year-label';
    label.textContent = `${year} · ${DATA.stats.years[year]}`;
    yEl.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    const start = new Date(`${year}-01-01T00:00:00`);
    const end = new Date(`${year}-12-31T00:00:00`);
    // Pad with empty cells from preceding sunday→saturday days so columns align by week
    // Grid auto-flow column with 7 rows: row 0 = Sunday (or Monday). Use Sunday-first to match NYT/GH style.
    const firstDow = start.getDay(); // 0=Sun..6=Sat
    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.style.visibility = 'hidden';
      grid.appendChild(empty);
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const puzzles = dateMap[iso] || [];
      const cell = document.createElement('div');
      const n = puzzles.length;
      let cls = 'cal-cell';
      if (n === 1) cls += ' c1 has-data';
      else if (n === 2) cls += ' c2 has-data';
      else if (n >= 3) cls += ' c3 has-data';
      cell.className = cls;
      const label = puzzles.length
        ? `${iso}: ${puzzles.map(p => `${p.venue} — ${p.title || 'Untitled'}`).join(' · ')}`
        : iso;
      cell.title = label;
      if (puzzles.length) {
        cell.addEventListener('click', () => openModal(puzzles[0]));
      }
      grid.appendChild(cell);
    }
    yEl.appendChild(grid);
    wrap.appendChild(yEl);
  });
}

// ----- MODAL -----
function setupModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openModal(p) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="modal-tile ${tileClass(p.venue)}">${tileLetter(p)}</div>
    <div class="modal-venue">${p.venue}${p.puzzle_type ? ` · ${p.puzzle_type}` : ''}</div>
    <h2 class="modal-title">${p.title || 'Untitled puzzle'}</h2>
    <div class="modal-byline">By Nancy Serrano-Wu${p.co_constructor ? ` & ${p.co_constructor}` : ''}</div>
    <div class="modal-meta">
      <span>📅 ${p.day_of_week}, ${p.date_display}</span>
      ${p.letters_clue ? `<span>🔤 ${p.letters_clue}</span>` : ''}
    </div>
    ${p.url ? `<a class="modal-cta" href="${p.url}" target="_blank" rel="noopener">
      Open puzzle on ${p.venue}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>` : `<p style="color:var(--muted);font-size:13px;margin:0;">No direct link available for this puzzle.</p>`}
  `;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal').hidden = true;
  document.body.style.overflow = '';
}

// ----- Smooth scroll & active nav -----
function setupSmoothScroll() {
  const links = document.querySelectorAll('.topnav-item');
  links.forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  // Update active section on scroll
  const sections = ['today','archive','stats','calendar','about','subscribe'];
  window.addEventListener('scroll', () => {
    const y = window.scrollY + 200;
    let active = sections[0];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= y) active = id;
    });
    links.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + active);
    });
  }, { passive: true });
}

// Show a 'last updated' timestamp from data.json if present
function showLastUpdated() {
  if (DATA && DATA.last_updated) {
    const el = document.createElement('span');
    el.style.cssText = 'display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:6px;';
    const d = new Date(DATA.last_updated);
    el.textContent = 'Auto-updated ' + d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const tag = document.querySelector('.logo-tag');
    if (tag) tag.appendChild(el);
  }
}

init().then(showLastUpdated);
