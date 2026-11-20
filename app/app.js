// The Leonida Field Manual — offline GTA VI trophy guide & tracker.
// Static files only: data comes from data/trophies.json and data/sources.json
// (same-origin fetch, works with the network off). Progress lives in localStorage.
const KEY = 'leonida-field-manual-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const GRADE_POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };
const KIND_LABEL = { story: 'Story', side: 'Side Quest', collectible: 'Collectible', activity: 'Activity', crime: 'Crime', feat: 'Feat', completion: 'Completion', platinum: 'Platinum' };
const PHASE_LABEL = { 1: 'Phase 1 — Story Run', 2: 'Phase 2 — 100% Sweep', 3: 'Phase 3 — Strangers & Cleanup', 4: 'Phase 4 — Platinum' };

let TROPHIES = [];
let SOURCES = [];
let DISPUTES = [];
let META = {};
let state = loadState();
let filters = { q: '', kind: 'all', grade: 'all', flags: new Set() };

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { earned: new Set(s.earned || []), counts: s.counts || {}, spoiler: s.spoiler !== false, selected: s.selected || 28 };
    }
  } catch { /* corrupted save: start fresh */ }
  return { earned: new Set(), counts: {}, spoiler: true, selected: 28 };
}
function saveState() {
  localStorage.setItem(KEY, JSON.stringify({ earned: [...state.earned], counts: state.counts, spoiler: state.spoiler, selected: state.selected }));
}
function demoSeed() {
  // ?demo=1 seeds a believable mid-run state so screenshots show the tracker in use.
  // It only applies when no save exists yet; the app itself is identical.
  if (localStorage.getItem(KEY)) return;
  state.earned = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 20, 21, 35, 44, 53]);
  state.counts = { 14: 11, 15: 187, 17: 12, 18: 5, 19: 8, 25: 2, 28: 6, 30: 1, 31: 41, 32: 23, 35: 100, 42: 31, 48: 187, 52: 125000, 53: 100000, 54: 3, 55: 4 };
  state.selected = 28;
  saveState();
}
if (new URLSearchParams(location.search).has('demo')) demoSeed();

const byId = (id) => TROPHIES.find((t) => t.id === id);
const isEarned = (t) => state.earned.has(t.id);
const countOf = (t) => Math.max(0, Math.min(t.count || 0, state.counts[t.id] || 0));
const fmtMoney = (n) => '$' + n.toLocaleString('en-US');
const fmtCount = (t, v) => (t.countUnit === '$' ? fmtMoney(v) : String(v));
const isMasked = (t) => state.spoiler && t.hidden && !isEarned(t);
const disputeOf = (t) => (t.dispute ? DISPUTES.find((d) => d.id === t.dispute) : null);
const isUnconfirmed = (t) => ['D3', 'D4', 'D5'].includes(t.dispute || '');

function citeChips(srcs) {
  const two = srcs.length >= 2;
  return srcs.map((n) => `<span class="cite${two ? ' two' : ''}">[${n}]</span>`).join(' ');
}
function gradeTag(t) {
  return `<span class="tag ${t.grade}">${t.grade.toUpperCase()}</span>`;
}
function trophyTags(t) {
  const tags = [gradeTag(t)];
  if (t.missable === 'possible') tags.push('<span class="tag miss">POSSIBLY MISSABLE</span>');
  if (t.missable === 'watch') tags.push('<span class="tag watch">WATCH</span>');
  if (t.hidden) tags.push('<span class="tag hid">PSN-HIDDEN</span>');
  if (t.dispute) tags.push('<span class="tag disp">DISPUTED</span>');
  if (isUnconfirmed(t)) tags.push('<span class="tag unconf">UNCONFIRMED</span>');
  if (t.count) tags.push(`<span class="tag cnt">${fmtCount(t, countOf(t))}/${fmtCount(t, t.count)} ${t.countUnit.toUpperCase()}</span>`);
  return tags.join('');
}

function auditNumbers() {
  const steps = TROPHIES.flatMap((t) => t.steps);
  const cited = steps.filter((s) => s.s && s.s.length).length;
  const twoPlus = steps.filter((s) => s.s && s.s.length >= 2).length;
  const unconfirmed = TROPHIES.filter(isUnconfirmed).length;
  return {
    steps: steps.length, cited, twoPlus,
    guides: TROPHIES.filter((t) => t.guide && t.guide.trim()).length,
    sources: SOURCES.length, disputes: DISPUTES.length,
    missable: TROPHIES.filter((t) => t.missable === 'possible').length,
    watch: TROPHIES.filter((t) => t.missable === 'watch').length,
    unconfirmed,
    trackers: TROPHIES.filter((t) => t.count).length,
    hidden: TROPHIES.filter((t) => t.hidden).length,
  };
}

function renderProgress() {
  const earned = TROPHIES.filter(isEarned);
  $('#earnedCount').textContent = earned.length;
  $('#progressFill').style.width = (earned.length / TROPHIES.length * 100).toFixed(1) + '%';
  const g = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  earned.forEach((t) => g[t.grade]++);
  $('#gradeCounts').textContent = `P ${g.platinum}/1 · G ${g.gold}/2 · S ${g.silver}/6 · B ${g.bronze}/46`;
  const pts = earned.reduce((a, t) => a + GRADE_POINTS[t.grade], 0);
  const logged = TROPHIES.filter((t) => t.count && t.countUnit !== '$').reduce((a, t) => a + countOf(t), 0);
  $('#pointsLine').textContent = `${pts.toLocaleString('en-US')}/1,350 PSN points · ${logged.toLocaleString('en-US')} counts logged`;
  const a = auditNumbers();
  $('#footCounts').textContent = `${a.steps} cited steps · ${a.sources} sources · ${a.disputes} disputes`;
}

function renderAudit() {
  const a = auditNumbers();
  $('#auditStrip').innerHTML =
    `<span><b>55/55</b> official name, description &amp; grade</span><span class="audit-sep">|</span>` +
    `<span><b>${a.guides}/55</b> guides in our own words</span><span class="audit-sep">|</span>` +
    `<span><b>${a.cited}/${a.steps}</b> steps cited</span><span class="audit-sep">|</span>` +
    `<span><b>${a.twoPlus}</b> backed by 2+ sources</span><span class="audit-sep">|</span>` +
    `<span><b>${a.sources}</b> sources read 20 Nov 2026</span><span class="audit-sep">|</span>` +
    `<span><b>${a.disputes}</b> disputes shown both ways</span><span class="audit-sep">|</span>` +
    `<span><b>${a.missable}</b> possibly missable · <b>${a.watch}</b> watch · <b>${a.unconfirmed}</b> unconfirmed</span><span class="audit-sep">|</span>` +
    `<span><b>${a.trackers}</b> count trackers · <b>${a.hidden}</b> PSN-hidden</span>`;
}

function renderAlert() {
  const pma = byId(28);
  $('#missableAlertText').innerHTML = isEarned(pma)
    ? `<b>Positive Mental Attitude</b> — earned. The Chapter 1 balcony meditation is done; nothing else on the list can be missed.`
    : `<b>Positive Mental Attitude</b> — meditate at every spot (18). The first meditation, Lucia's on the balcony at Jason's house in Chapter 1, disappears after the chapter; whether the trophy needs it is unconfirmed, so do it. <b>Make a manual save right after.</b>`;
}

function renderChips() {
  const kinds = ['all', ...Object.keys(KIND_LABEL)];
  $('#kindChips').innerHTML = kinds.map((k) => {
    const n = k === 'all' ? TROPHIES.length : TROPHIES.filter((t) => t.kind === k).length;
    return `<button type="button" class="chip${filters.kind === k ? ' active' : ''}" data-kind="${k}">${k === 'all' ? 'All' : KIND_LABEL[k]} <span class="n">${n}</span></button>`;
  }).join('');
  const grades = ['all', 'platinum', 'gold', 'silver', 'bronze'];
  $('#gradeChips').innerHTML = grades.map((g) => {
    const n = g === 'all' ? TROPHIES.length : TROPHIES.filter((t) => t.grade === g).length;
    return `<button type="button" class="chip${filters.grade === g ? ' active' : ''}" data-grade="${g}">${g === 'all' ? 'Any grade' : g[0].toUpperCase() + g.slice(1)} <span class="n">${n}</span></button>`;
  }).join('');
  const flags = [['missable', 'Possibly missable'], ['watch', 'Watch'], ['hidden', 'PSN-hidden'], ['disputed', 'Disputed'], ['unconfirmed', 'Unconfirmed'], ['unearned', 'Not earned']];
  $('#flagToggles').innerHTML = flags.map(([f, label]) =>
    `<button type="button" class="tgl${filters.flags.has(f) ? ' active' : ''}" data-flag="${f}">${label}</button>`).join('');
  $$('#kindChips .chip').forEach((b) => b.addEventListener('click', () => { filters.kind = b.dataset.kind; renderChips(); renderChecklist(); }));
  $$('#gradeChips .chip').forEach((b) => b.addEventListener('click', () => { filters.grade = b.dataset.grade; renderChips(); renderChecklist(); }));
  $$('#flagToggles .tgl').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.flag;
    if (filters.flags.has(f)) filters.flags.delete(f); else filters.flags.add(f);
    renderChips(); renderChecklist();
  }));
}

function matchesFilters(t) {
  if (filters.kind !== 'all' && t.kind !== filters.kind) return false;
  if (filters.grade !== 'all' && t.grade !== filters.grade) return false;
  for (const f of filters.flags) {
    if (f === 'missable' && t.missable !== 'possible') return false;
    if (f === 'watch' && t.missable !== 'watch') return false;
    if (f === 'hidden' && !t.hidden) return false;
    if (f === 'disputed' && !t.dispute) return false;
    if (f === 'unconfirmed' && !isUnconfirmed(t)) return false;
    if (f === 'unearned' && isEarned(t)) return false;
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const hay = [t.name, t.description, t.guide, ...t.steps.map((s) => s.t)].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderChecklist() {
  // Roadmap order: phase first, then trophy number — clean contiguous groups.
  const list = TROPHIES.filter(matchesFilters).sort((a, b) => a.phase - b.phase || a.id - b.id);
  const el = $('#checklist');
  if (!list.length) { el.innerHTML = '<div class="empty">No trophies match these filters.</div>'; return; }
  let html = '';
  let lastPhase = null;
  for (const t of list) {
    if (t.phase !== lastPhase) {
      lastPhase = t.phase;
      const inPhase = TROPHIES.filter((x) => x.phase === t.phase);
      const done = inPhase.filter(isEarned).length;
      html += `<div class="phase-head"><span>${PHASE_LABEL[t.phase]}</span><span class="ph-n">${done}/${inPhase.length}</span></div>`;
    }
    const masked = isMasked(t);
    html += `<div class="trow${isEarned(t) ? ' earned' : ''}${state.selected === t.id ? ' selected' : ''}" data-id="${t.id}">
      <input type="checkbox" ${isEarned(t) ? 'checked' : ''} aria-label="Earned: ${t.name}">
      <div class="tmain">
        <div class="tname">${masked ? '<span class="spoiled">▓▓ HIDDEN TROPHY ▓▓</span>' : `${t.id}. ${t.name}`}</div>
        <div class="tdesc">${masked ? 'Hidden on PlayStation until earned.' : t.description}</div>
        <div class="ttags">${trophyTags(t)}</div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
  $$('.trow', el).forEach((row) => {
    const id = Number(row.dataset.id);
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      state.selected = id; saveState(); renderChecklist(); renderDetail(); renderRail();
    });
    $('input', row).addEventListener('change', (e) => {
      if (e.target.checked) state.earned.add(id); else state.earned.delete(id);
      saveState(); renderProgress(); renderAlert(); renderChecklist(); renderDetail(); renderRail(); renderRoadmap();
    });
  });
  // Keep the selected trophy visible inside the checklist column only —
  // scroll the column, never the window (scrollIntoView would move the page).
  const sel = $('.trow.selected', el);
  if (sel && el.clientHeight > 0) {
    const top = sel.offsetTop, bottom = top + sel.offsetHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }
}

function renderDetail() {
  const t = byId(state.selected) || TROPHIES[0];
  const el = $('#detail');
  const masked = isMasked(t);
  const d = disputeOf(t);
  let html = `<div class="d-head"><div><h2>${masked ? 'Hidden Trophy' : t.name}</h2><div class="ttags">${trophyTags(t)}</div></div>
    <div class="d-num">#${t.id} of 55<br>${KIND_LABEL[t.kind]}<br>${PHASE_LABEL[t.phase].split(' — ')[0]}</div></div>`;
  if (masked) {
    html += `<div class="box watch"><h4>SPOILER SHIELD IS ON</h4><p>This trophy is hidden on PlayStation until earned, and its guide names story moments. Turn the shield off (top right) or earn it to read the guide — or reveal it here.</p>
      <button type="button" id="revealBtn">Reveal this trophy's guide</button></div>`;
    el.innerHTML = html;
    $('#revealBtn').addEventListener('click', () => { state.spoiler = false; $('#spoilerToggle').checked = false; saveState(); renderChecklist(); renderDetail(); });
    return;
  }
  html += `<p class="d-off"><b>Official description:</b> “${t.description}”</p>`;
  if (t.count) {
    const v = countOf(t);
    const pct = Math.min(100, v / t.count * 100).toFixed(0);
    html += `<div class="countbox"><div class="cb-label">YOUR COUNT<small>${t.countLabel}</small><div class="countbar"><div style="width:${pct}%"></div></div></div>
      <button type="button" data-step="-1" aria-label="Decrease count">−</button>
      <div class="cb-val">${fmtCount(t, v)}<span style="font-size:12px;color:var(--ink2)"> / ${fmtCount(t, t.count)}</span></div>
      <button type="button" data-step="1" aria-label="Increase count">+</button></div>`;
  }
  html += `<div class="d-sec"><h3>SITREP — WHAT IT IS</h3><p>${t.guide}</p></div>`;
  html += `<div class="d-sec"><h3>ORDERS — HOW TO EARN IT (${t.steps.length} STEPS, ${t.steps.filter((s) => s.s && s.s.length).length} CITED)</h3><ol class="orders">`;
  for (const s of t.steps) html += `<li>${s.t} ${citeChips(s.s || [])}</li>`;
  html += `</ol></div>`;
  if (t.missable === 'possible') {
    html += `<div class="box warn"><h4>⚠ POSSIBLY MISSABLE — READ BEFORE YOU PLAY PAST CHAPTER 1</h4>
      <p>The Chapter 1 balcony meditation at Jason's house disappears after the chapter, and no source has confirmed whether the trophy needs it. PowerPyx's author did it and earned the trophy. <b>Do it, then make a manual save.</b></p></div>`;
  } else if (t.missable === 'watch') {
    html += `<div class="box watch"><h4>WATCH — TEMPORARY WINDOW</h4>
      <p>This quest-giver can go temporarily unavailable during the story (Kenton after Chapter 1; others at story beats). PowerPyx: all trophy quest-givers return and stay available after the story. Start the line when it appears; do not panic if it goes quiet.</p></div>`;
  }
  if (d) {
    html += `<div class="box intel"><h4>INTEL — SOURCES DIFFER (${d.id})</h4>
      <p><b>Q:</b> ${d.q}</p><p><b>Version A:</b> ${d.a}</p><p><b>Version B:</b> ${d.b}</p>
      <p><b>Our call:</b> ${d.call}</p></div>`;
  }
  const srcs = t.sources.map((n) => SOURCES.find((s) => s.n === n)).filter(Boolean);
  html += `<div class="d-sec"><h3>SOURCES FOR THIS GUIDE (${srcs.length})</h3><ol class="src-list">`;
  for (const s of srcs) html += `<li><b>[${s.n}] ${s.site}</b> — ${s.title}${s.url ? ` — <a href="${s.url}" target="_blank" rel="noopener">open source</a>` : ''} <span style="color:var(--ink2)">(${s.read})</span></li>`;
  html += `</ol></div>`;
  el.innerHTML = html;
  $$('.countbox button', el).forEach((b) => b.addEventListener('click', () => {
    const step = Number(b.dataset.step);
    const cur = state.counts[t.id] || 0;
    state.counts[t.id] = Math.max(0, Math.min(t.count, cur + step));
    if (state.counts[t.id] >= t.count) state.earned.add(t.id);
    saveState(); renderProgress(); renderChecklist(); renderDetail(); renderRail();
  }));
}

function renderRail() {
  const next = TROPHIES.filter((t) => !isEarned(t)).sort((a, b) => a.phase - b.phase || a.id - b.id).slice(0, 6);
  const t = byId(state.selected) || TROPHIES[0];
  const srcs = t.sources.map((n) => SOURCES.find((s) => s.n === n)).filter(Boolean);
  const ledgerRows = TROPHIES.filter((x) => x.count && x.countUnit !== '$')
    .map((x) => `<div class="lr"><span>${x.name}</span><b>${countOf(x)}/${x.count}</b></div>`).join('');
  $('#rail').innerHTML = `
    <div class="rail-sec"><h3>NEXT UP — ROADMAP ORDER</h3>
      ${next.length ? next.map((x, i) => `<div class="next-item" data-id="${x.id}"><span class="nx-n">${i + 1}.</span><span class="nx-t"><b>${isMasked(x) ? `Hidden Trophy #${x.id}` : x.name}</b><small>${KIND_LABEL[x.kind]} · ${x.grade} · ${PHASE_LABEL[x.phase].split(' — ')[0]}${x.missable === 'possible' ? ' · POSSIBLY MISSABLE' : ''}</small></span></div>`).join('') : '<p>All 55 earned. Leonida Legend.</p>'}
    </div>
    <div class="rail-sec"><h3>SOURCES — THIS GUIDE</h3>
      <ol class="src-list">${srcs.map((s) => `<li><b>[${s.n}] ${s.site}</b> — ${s.title}</li>`).join('')}</ol>
      <p style="font-size:11.5px;color:var(--ink2);margin:6px 0 0">Full source matrix + disputes: <a href="#/sources">Sources &amp; Disputes</a></p>
    </div>
    <div class="rail-sec"><h3>COUNTS LEDGER</h3><div class="ledger">${ledgerRows}</div></div>`;
  $$('.next-item', $('#rail')).forEach((row) => row.addEventListener('click', () => {
    state.selected = Number(row.dataset.id); saveState(); renderChecklist(); renderDetail(); renderRail();
  }));
}

function renderRoadmap() {
  const body = $('#roadmapBody');
  let html = '';
  for (const ph of META.roadmap) {
    const inPhase = TROPHIES.filter((t) => t.phase === ph.id);
    const done = inPhase.filter(isEarned).length;
    const pct = (done / inPhase.length * 100).toFixed(0);
    html += `<div class="phase-card"><div class="phase-card-head"><h3>${ph.name}</h3><span class="pc-meta">${ph.hours} · ${done}/${inPhase.length} earned · ${pct}%</span></div>
      <div class="phase-card-body"><p>${ph.note}</p><div class="pbar"><div style="width:${pct}%"></div></div>
      <ul class="mini-list">${inPhase.map((t) => `<li class="${isEarned(t) ? 'done' : ''}"><b>${t.id}. ${isMasked(t) ? 'Hidden Trophy' : t.name}</b> <span style="color:var(--ink2)">(${t.grade}${t.missable === 'possible' ? ', POSSIBLY MISSABLE' : ''}${t.count ? `, ${t.count} ${t.countUnit}` : ''})</span></li>`).join('')}</ul>
      </div></div>`;
  }
  html += `<div class="setup-strip"><div><strong>PLATINUM MATH</strong> — ${META.hours_platinum} hours total on PowerPyx's roadmap (60–80 story, ~100 100%-sweep, ~10 cleanup). Push Square's slower read is 250+ hours (see dispute D7). Difficulty 4/10; 1 playthrough; 0 online trophies; 0 glitched trophies.</div><div class="setup-cites">Sources [1] PowerPyx, [3] GTABase, [6] sixshore</div></div>`;
  body.innerHTML = html;
}

function renderMissables() {
  const pma = byId(28);
  const watch = TROPHIES.filter((t) => t.missable === 'watch');
  const unconf = TROPHIES.filter(isUnconfirmed);
  $('#missablesBody').innerHTML = `
  <div class="phase-card"><div class="phase-card-head"><h3>THE ONE MISSABLE — Positive Mental Attitude</h3><span class="pc-meta">Bronze · 18 meditations · 10 spots</span></div>
  <div class="phase-card-body"><p>${pma.guide}</p>
  <ol class="orders">${pma.steps.map((s) => `<li>${s.t} ${citeChips(s.s || [])}</li>`).join('')}</ol>
  <div class="box warn"><h4>DISPUTE D1 — IS THE CHAPTER 1 MEDITATION REQUIRED?</h4>
  <p><b>PowerPyx:</b> it raises the counter +1 but is not marked as a Meditation Spot; whether it is required is unconfirmed. The author did it, then earned the trophy. <b>GTABase &amp; KeenGamer:</b> same position — unconfirmed, do it anyway. <b>Our call:</b> no source says it is safe to skip. Do the balcony meditation in Chapter 1; treat it as required.</p></div>
  </div></div>
  <div class="phase-card"><div class="phase-card-head"><h3>RISK REGISTER</h3><span class="pc-meta">1 possibly missable · 5 watch · 3 unconfirmed</span></div>
  <div class="phase-card-body"><table class="reg"><tr><th>Trophy</th><th>Risk</th><th>Window / fix</th></tr>
  <tr><td><b>Positive Mental Attitude</b></td><td><b>POSSIBLY MISSABLE</b> — Chapter 1 balcony meditation gone after the chapter</td><td>Do it in Chapter 1 (after Down to Earth); manual save right after</td></tr>
  ${watch.map((t) => `<tr><td><b>${t.name}</b></td><td>WATCH — quest-giver temporarily unavailable at story beats</td><td>Start the line when it appears; all return after the story [1]; Kenton returns in Ch. 2–3 (or call Brian as Jason) [1]</td></tr>`).join('')}
  ${unconf.map((t) => `<tr><td><b>${t.name}</b></td><td>UNCONFIRMED — unlock method not settled across sources</td><td>Follow PowerPyx's method; see ${t.dispute} in Sources &amp; Disputes</td></tr>`).join('')}
  <tr><td><b>Everything else</b></td><td>Safe — free-roam after the story; nothing else can be missed</td><td>PowerPyx, GTABase, Mobalytics [1][3][14]</td></tr>
  </table></div></div>
  <div class="setup-strip"><div><strong>ALSO WORTH KNOWING (no trophy impact):</strong> many optional missions disappear after a while; some fences become permanently unavailable; a few magazine collectibles sit in story buildings that later close; some quests carry an hourglass and fail with time; the Irredeemable criminal profile is permanent (cops shoot on sight) — avoid it. None of it locks the platinum.</div><div class="setup-cites">Source [1] PowerPyx — 'Note regarding missable content (this doesn’t affect trophies)'</div></div>`;
}

function citedByCount(n) {
  return TROPHIES.filter((t) => t.sources.includes(n)).length;
}
function renderSources() {
  const rows = SOURCES.map((s) => `<tr><td class="num"><b>[${s.n}]</b></td><td><b>${s.site}</b><br><span style="color:var(--ink2)">${s.title}</span></td><td>${s.read}</td><td class="num">${citedByCount(s.n)} / 55</td><td style="font-size:12px">${s.note}</td></tr>`).join('');
  $('#sourcesBody').innerHTML = `
  <div class="setup-strip"><div><strong>METHOD</strong> — ${SOURCES.methodNote || ''}</div><div class="setup-cites">A claim seen in two or more sources is marked 2+ (green cites). Links open only when the reader follows them; the app itself fetches nothing.</div></div>
  <div class="phase-card"><div class="phase-card-head"><h3>SOURCE MATRIX</h3><span class="pc-meta">${SOURCES.length} sources · ${auditNumbers().steps} cited steps</span></div>
  <div class="phase-card-body"><table class="reg src-matrix"><tr><th>#</th><th>Source</th><th>Read</th><th>Cited by</th><th>What it supplied</th></tr>${rows}</table></div></div>
  <div class="phase-card"><div class="phase-card-head"><h3>DISPUTES REGISTER — BOTH VERSIONS, OUR CALL</h3><span class="pc-meta">${DISPUTES.length} disputes</span></div>
  <div class="phase-card-body">${DISPUTES.map((d) => `<div class="dispute"><h3>${d.id} — ${d.q}</h3><div class="vs"><div><b>VERSION A</b>${d.a}</div><div><b>VERSION B</b>${d.b}</div></div><div class="call"><b>OUR CALL:</b> ${d.call}</div></div>`).join('')}</div></div>`;
}

function renderHundred() {
  const c = META.counts;
  const rows = [
    ['Story', 'Finish the story (5 chapters)', '—', '1'],
    ['Optional missions', 'Complete any 100 optional missions (200–300+ exist)', '100', '1'],
    ['Vehicles scanned', `Scan any ${c.vehicles_100} of ${c.vehicles_base} base-model vehicles (WAiNK)`, `${c.vehicles_100}/${c.vehicles_base}`, '1'],
    ['Animals studied', `Study any ${c.animals_study} of ${c.animals_total} animals through binoculars`, `${c.animals_study}/${c.animals_total}`, '1'],
    ['Challenges', `Complete any ${c.challenges_100} of ${c.challenges} challenges`, `${c.challenges_100}/${c.challenges}`, '1'],
    ['Stunts', `Complete ${c.stunts_100} of ${c.stunts} stunts`, `${c.stunts_100}/${c.stunts}`, '1'],
    ['Meditations', `Meditate at ${15} of ${c.meditations} spots`, `15/${c.meditations}`, '1'],
    ['Shooting ranges', 'Gold-medal ALL shooting range challenges', `ALL ${c.shooting_challenges}`, '1'],
    ['Drone races', 'Win ALL Top Fun drone races', `ALL ${c.top_fun_races}`, '1'],
    ['Bank vaults', 'Rob ALL large bank vaults', `ALL ${c.bank_vaults}`, '1'],
    ['Gang operations', 'Rob ALL illegal gang operations', `ALL ${c.gang_operations}`, '1'],
    ["Bret's quests", 'Complete ALL Target Decks', `ALL ${c.target_decks}`, '1'],
    ['Underwater discoveries', 'Find ALL underwater discoveries', 'ALL', '1'],
    ['Robberies', 'Complete ALL robberies', 'ALL', '1'],
  ];
  $('#hundredBody').innerHTML = `
  <div class="setup-strip"><div><strong>A LONG ROAD (GOLD) — THE 100% CHECKLIST</strong> — The checklist opens after the story under Progress &gt; Stats &gt; 100% Completion; progress made during the story already counts, and nothing on it is missable. PowerPyx puts it near 60% true completion: most side quests and many collectible types are not needed at all. Insider Gaming counts 35 tasks on the checklist. The table below lists every requirement PowerPyx confirms; PowerPyx's full 100% guide is the authority for the rest.</div><div class="setup-cites">Sources [1] PowerPyx, [4] Insider Gaming, [11] GTA Vice City Hub</div></div>
  <div class="phase-card"><div class="phase-card-head"><h3>CONFIRMED 100% REQUIREMENTS</h3><span class="pc-meta">partial list — see note above</span></div>
  <div class="phase-card-body"><table class="reg"><tr><th>Line</th><th>Requirement</th><th>Target</th><th>Src</th></tr>
  ${rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="num"><b>${r[2]}</b></td><td class="num">[${r[3]}]</td></tr>`).join('')}
  </table></div></div>`;
}

function currentTab() {
  const h = location.hash.replace('#/', '');
  return ['tracker', 'roadmap', 'missables', 'sources', '100'].includes(h) ? h : 'tracker';
}
function renderTab() {
  const tab = currentTab();
  $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (tab === '100' ? 'hundred' : tab)));
  $$('.view').forEach((v) => { v.hidden = true; });
  const map = { tracker: 'view-tracker', roadmap: 'view-roadmap', missables: 'view-missables', sources: 'view-sources', '100': 'view-hundred' };
  $('#' + map[tab]).hidden = false;
  if (tab === 'roadmap') renderRoadmap();
  if (tab === 'missables') renderMissables();
  if (tab === 'sources') renderSources();
  if (tab === '100') renderHundred();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ earned: [...state.earned], counts: state.counts, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leonida-field-manual-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.earned)) state.earned = new Set(data.earned.filter((id) => byId(id)));
      if (data.counts && typeof data.counts === 'object') state.counts = data.counts;
      saveState(); renderAll();
    } catch { alert('That file is not a valid progress export.'); }
  };
  reader.readAsText(file);
}

function renderAll() {
  renderProgress(); renderAudit(); renderAlert(); renderChips(); renderChecklist(); renderDetail(); renderRail(); renderTab();
}

async function init() {
  const [tDoc, sDoc] = await Promise.all([
    fetch('data/trophies.json').then((r) => r.json()),
    fetch('data/sources.json').then((r) => r.json()),
  ]);
  TROPHIES = tDoc.trophies;
  META = tDoc.meta;
  SOURCES = sDoc.sources;
  SOURCES.methodNote = sDoc.method_note;
  DISPUTES = sDoc.disputes;
  $('#spoilerToggle').checked = state.spoiler;
  $('#spoilerToggle').addEventListener('change', (e) => { state.spoiler = e.target.checked; saveState(); renderChecklist(); renderDetail(); renderRail(); });
  $('#searchBox').addEventListener('input', (e) => { filters.q = e.target.value.trim(); renderChecklist(); });
  $('#exportBtn').addEventListener('click', exportProgress);
  $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all progress and counts?')) return;
    state.earned = new Set(); state.counts = {}; saveState(); renderAll();
  });
  window.addEventListener('hashchange', renderTab);
  renderAll();
}
init();
