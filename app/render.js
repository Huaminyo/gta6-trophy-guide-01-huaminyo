// Render layer — every pixel the guide shows. Each painter reads the database
// (data.js) and the reader's save (state.js) and writes one part of the page.
// Dynamic controls re-render through the hooks the entry point hands in:
// hooks.select(id), hooks.toggleEarned(id, on), hooks.reveal(),
// hooks.bump(trophy, delta), hooks.repaintAll(), hooks.repaintTracker().
import {
  KIND_LABELS,
  auditStats,
  disputeById,
  fmtCount,
  fmtDate,
  fmtNum,
  isUnconfirmed,
  phaseName,
  pointsEarned,
  possiblyMissable,
  roadmapOrder,
  routeFor,
  sourceByNum,
  totalPoints,
  trophyById,
} from './data.js';
import { countOf, earnedIds, isEarned, isMasked } from './state.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- small shared fragments ------------------------------------------------

function citeMarks(numbers) {
  const list = numbers ?? [];
  const twoPlus = list.length >= 2;
  return list.map((n) => `<span class="cite${twoPlus ? ' two' : ''}">[${n}]</span>`).join(' ');
}

function gradeTag(trophy) {
  return `<span class="tag ${trophy.grade}">${trophy.grade.toUpperCase()}</span>`;
}

function trophyTags(ctx, trophy) {
  const { save } = ctx;
  const tags = [gradeTag(trophy)];
  if (trophy.missable === 'possible') tags.push('<span class="tag miss">POSSIBLY MISSABLE</span>');
  if (trophy.missable === 'watch') tags.push('<span class="tag watch">WATCH</span>');
  if (trophy.hidden) tags.push('<span class="tag hid">PSN-HIDDEN</span>');
  if (trophy.dispute) tags.push('<span class="tag disp">DISPUTED</span>');
  if (isUnconfirmed(trophy)) tags.push('<span class="tag watch">UNCONFIRMED</span>');
  if (trophy.count) {
    tags.push(`<span class="tag cnt">${fmtCount(trophy, countOf(save, trophy))}/${fmtCount(trophy, trophy.count)} ${esc(String(trophy.countUnit).toUpperCase())}</span>`);
  }
  return tags.join('');
}

function sourceLine(ctx, source) {
  const link = source.url
    ? ` &mdash; <a href="${esc(source.url)}" target="_blank" rel="noopener">open source</a>`
    : '';
  return `<li><b>[${source.n}] ${esc(source.site)}</b> &mdash; ${esc(source.title)}${link} <span style="color:var(--ink-soft)">(${esc(source.read)})</span></li>`;
}

// --- audit strip + progress pill -------------------------------------------

export function paintAudit(ctx) {
  const { db, save } = ctx;
  const a = auditStats(db, earnedIds(save));
  const sep = '<span class="sep">|</span>';
  $('#audit').innerHTML = [
    `<span><b>55/55</b> official name, description &amp; grade</span>`,
    `<span><b>${a.guides}/55</b> guides in our own words</span>`,
    `<span><b>${a.cited}/${a.steps}</b> steps cited</span>`,
    `<span><b>${a.backedByTwo}</b> backed by 2+ sources</span>`,
    `<span><b>${a.sources}</b> sources read ${esc(fmtDate(db.readDate))}</span>`,
    `<span><b>${a.disputes}</b> disputes shown both ways</span>`,
    `<span><b>${a.missable}</b> possibly missable &middot; <b>${a.watch}</b> watch &middot; <b>${a.unconfirmed}</b> unconfirmed</span>`,
    `<span><b>${a.trackers}</b> count trackers &middot; <b>${a.hidden}</b> PSN-hidden</span>`,
    `<span>roadmap <b>${esc(db.meta.roadmap_hours ?? '')} h</b></span>`,
  ].join(sep);
}

export function paintProgress(ctx) {
  const { db, save } = ctx;
  const ids = earnedIds(save);
  $('#progress-pill').textContent =
    `${ids.size}/55 earned · ${fmtNum(pointsEarned(db, ids))}/${fmtNum(totalPoints(db))} PTS`;
  $('#btn-spoiler').textContent = `Spoiler shield: ${save.spoiler ? 'ON' : 'OFF'}`;
}

// --- tracker: checklist ----------------------------------------------------

function kindMatches(trophy, kind) {
  switch (kind) {
    case '': return true;
    case 'story': return trophy.kind === 'story';
    case 'missable': return trophy.missable !== 'none';
    case 'collectible': return trophy.kind === 'collectible';
    case 'activity': return trophy.kind === 'activity';
    case 'crime': return trophy.kind === 'crime' || trophy.kind === 'feat';
    case 'side': return trophy.kind === 'side';
    case 'completion': return trophy.kind === 'completion' || trophy.kind === 'platinum';
    default: return true;
  }
}

function visibleTrophies(ctx) {
  const { db, save, filters } = ctx;
  const q = filters.q.toLowerCase();
  return db.trophies
    .filter((t) => {
      if (!kindMatches(t, filters.kind)) return false;
      if (filters.grade && t.grade !== filters.grade) return false;
      if (filters.hideEarned && isEarned(save, t)) return false;
      if (!q) return true;
      const haystack = [
        t.name, t.description, t.guide,
        ...(t.steps ?? []).map((s) => s.t),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    })
    .sort(roadmapOrder);
}

export function paintList(ctx) {
  const { db, save, hooks } = ctx;
  const list = visibleTrophies(ctx);
  const earned = earnedIds(save).size;
  $('#list-meta').textContent = `Showing ${list.length} of 55 · ${earned} earned`;
  const el = $('#trophy-list');
  if (!list.length) {
    el.innerHTML = '<li class="empty">No trophies match these filters.</li>';
    return;
  }
  let html = '';
  let lastPhase = null;
  for (const trophy of list) {
    if (trophy.phase !== lastPhase) {
      lastPhase = trophy.phase;
      html += `<li class="phase-row"><b>${esc(phaseName(db, trophy.phase))}</b></li>`;
    }
    const masked = isMasked(save, trophy);
    const classes = [isEarned(save, trophy) ? 'earned' : '', save.selected === trophy.id ? 'selected' : '']
      .filter(Boolean).join(' ');
    html += `<li data-id="${trophy.id}"${classes ? ` class="${classes}"` : ''}>`
      + `<input type="checkbox"${isEarned(save, trophy) ? ' checked' : ''} aria-label="Earned: ${esc(trophy.name)}">`
      + '<div class="t-main">'
      + `<div class="t-name">${masked ? '<span class="spoiled">&#9619;&#9619; STORY TROPHY &#9619;&#9619;</span>' : esc(`${trophy.id}. ${trophy.name}`)}</div>`
      + `<div class="t-desc">${masked ? 'Hidden by the spoiler shield until earned.' : esc(trophy.description)}</div>`
      + `<div class="t-tags">${trophyTags(ctx, trophy)}</div>`
      + '</div></li>';
  }
  el.innerHTML = html;
  for (const row of $$('li[data-id]', el)) {
    const id = Number(row.dataset.id);
    row.addEventListener('click', (event) => {
      if (event.target.tagName === 'INPUT') return;
      hooks.select(id);
    });
    $('input', row).addEventListener('change', (event) => {
      hooks.toggleEarned(id, event.target.checked);
    });
  }
  const selected = $('li.selected', el);
  if (selected && el.clientHeight > 0) {
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }
}

// --- tracker: selected trophy guide ----------------------------------------

function maskedDetail(ctx, trophy) {
  const { db, save } = ctx;
  return `<h2>Story Trophy</h2>`
    + `<div class="d-meta">Trophy #${trophy.id} of 55 &middot; ${esc(KIND_LABELS[trophy.kind] ?? trophy.kind)}`
    + ` &middot; ${esc(phaseName(db, trophy.phase))}</div>`
    + '<div class="box watch"><h4>Spoiler shield is on</h4>'
    + '<p>This is a story trophy: its name, description and guide name story moments. '
    + 'Turn the shield off (top right) or earn it to read the guide &mdash; or reveal it here.</p>'
    + '<p><button type="button" class="ctl" id="reveal-btn">Reveal this trophy&rsquo;s guide</button></p></div>';
}

function stepperHtml(ctx, trophy) {
  const { save } = ctx;
  const value = countOf(save, trophy);
  const pct = Math.min(100, Math.round((value / trophy.count) * 100));
  const step = trophy.countUnit === '$' ? 1000 : 1;
  return `<div class="stepper"><div class="st-label">YOUR COUNT<small>${esc(trophy.countLabel ?? '')}</small>`
    + `<div class="st-bar"><div style="width:${pct}%"></div></div></div>`
    + `<button type="button" data-step="-${step}" aria-label="Decrease count">&minus;</button>`
    + `<div class="st-val">${fmtCount(trophy, value)}<span style="font-size:12px;color:var(--ink-soft)"> / ${fmtCount(trophy, trophy.count)}</span></div>`
    + `<button type="button" data-step="${step}" aria-label="Increase count">+</button></div>`;
}

function routeHtml(ctx, trophy) {
  const route = routeFor(ctx.db, trophy);
  if (!route) return '';
  const stages = route.stages.map((stage, i) => {
    const pct = Math.min(100, Math.round((stage.n / trophy.count) * 100));
    return `<div class="route-stage"><b>Stage ${i + 1} &mdash; ${esc(stage.label)}</b> `
      + `<span class="rs-n">${fmtNum(stage.n)} / ${fmtNum(trophy.count)} (${pct}%)</span><br>${esc(stage.tip)}</div>`;
  }).join('');
  return `<div class="d-sec"><h3>Route &mdash; ${esc(route.title)}</h3>${stages}`
    + '<p class="hint">Stages run in order; counts add up to the trophy target. Sources are the trophy&rsquo;s own cited sources, listed below.</p></div>';
}

export function paintDetail(ctx) {
  const { db, save, hooks } = ctx;
  const trophy = trophyById(db, save.selected) ?? db.trophies[0];
  const el = $('#detail');
  if (!trophy) {
    el.innerHTML = '<p class="empty">No trophy selected.</p>';
    return;
  }
  if (isMasked(save, trophy)) {
    el.innerHTML = maskedDetail(ctx, trophy);
    $('#reveal-btn').addEventListener('click', () => hooks.reveal());
    return;
  }
  const dispute = trophy.dispute ? disputeById(db, trophy.dispute) : null;
  const citedSteps = (trophy.steps ?? []).filter((s) => s.s?.length).length;
  const sources = (trophy.sources ?? [])
    .map((n) => sourceByNum(db, n))
    .filter(Boolean);

  let html = `<h2>${esc(trophy.name)}</h2>`
    + `<div class="d-meta">Trophy #${trophy.id} of 55 &middot; ${esc(KIND_LABELS[trophy.kind] ?? trophy.kind)}`
    + ` &middot; ${esc(trophy.grade)} &middot; ${esc(phaseName(db, trophy.phase))}`
    + `${trophy.hidden ? ' &middot; hidden on PlayStation until earned' : ''}</div>`
    + `<div class="t-tags">${trophyTags(ctx, trophy)}</div>`
    + `<p class="d-official"><b>Official description:</b> &ldquo;${esc(trophy.description)}&rdquo;</p>`;
  if (trophy.count) html += stepperHtml(ctx, trophy);
  html += `<div class="d-sec"><h3>Guide</h3><p>${esc(trophy.guide)}</p></div>`;
  html += `<div class="d-sec"><h3>Steps &mdash; ${(trophy.steps ?? []).length} steps, ${citedSteps} cited</h3><ol class="steps">`
    + (trophy.steps ?? []).map((s) => `<li>${esc(s.t)} ${citeMarks(s.s)}</li>`).join('')
    + '</ol></div>';
  html += routeHtml(ctx, trophy);
  if (trophy.missable === 'possible') {
    html += '<div class="box warn"><h4>Possibly missable &mdash; read before Chapter 1 ends</h4>'
      + '<p>The first meditation, Lucia&rsquo;s on the balcony at Jason&rsquo;s house, disappears after Chapter 1, '
      + 'and no source has confirmed whether the trophy needs it. Do it, then make a manual save.</p></div>';
  } else if (trophy.missable === 'watch') {
    html += '<div class="box watch"><h4>Watch &mdash; temporary window</h4>'
      + '<p>This quest-giver can go temporarily unavailable at story beats. Start the line when it '
      + 'appears; every trophy quest-giver returns and stays available after the story.</p></div>';
  }
  if (dispute) {
    html += `<div class="box intel"><h4>Sources differ (${esc(dispute.id)})</h4>`
      + `<p><b>Q:</b> ${esc(dispute.q)}</p>`
      + `<p><b>Version A:</b> ${esc(dispute.a)}</p>`
      + `<p><b>Version B:</b> ${esc(dispute.b)}</p>`
      + `<p><b>Our call:</b> ${esc(dispute.call)}</p></div>`;
  }
  html += `<div class="d-sec"><h3>Sources for this guide (${sources.length})</h3><ol class="src-list">`
    + sources.map((s) => sourceLine(ctx, s)).join('')
    + '</ol></div>';
  el.innerHTML = html;
  for (const button of $$('.stepper button', el)) {
    button.addEventListener('click', () => hooks.bump(trophy, Number(button.dataset.step)));
  }
}

// --- tracker: right rail ---------------------------------------------------

export function paintRail(ctx) {
  const { db, save, hooks } = ctx;
  const upcoming = db.trophies
    .filter((t) => !isEarned(save, t))
    .sort(roadmapOrder)
    .slice(0, 6);
  const nextEl = $('#nextup');
  if (!upcoming.length) {
    nextEl.innerHTML = '<li>All 55 earned. Leonida Legend.</li>';
  } else {
    nextEl.innerHTML = upcoming.map((t) => `<li data-id="${t.id}"><b>${isMasked(save, t) ? `Story Trophy #${t.id}` : esc(t.name)}</b>`
      + `<small>${esc(KIND_LABELS[t.kind] ?? t.kind)} &middot; ${esc(t.grade)} &middot; ${esc(phaseName(db, t.phase))}`
      + `${t.missable === 'possible' ? ' &middot; POSSIBLY MISSABLE' : ''}</small></li>`).join('');
    for (const item of $$('li[data-id]', nextEl)) {
      item.addEventListener('click', () => hooks.select(Number(item.dataset.id)));
    }
  }

  const selected = trophyById(db, save.selected) ?? db.trophies[0];
  const railSources = selected
    ? (selected.sources ?? []).map((n) => sourceByNum(db, n)).filter(Boolean)
    : [];
  $('#rail-sources').innerHTML = railSources.length
    ? railSources.map((s) => `<li><b>[${s.n}] ${esc(s.site)}</b> &mdash; ${esc(s.title)}</li>`).join('')
    : '<li>No sources listed.</li>';

  const logged = db.trophies
    .filter((t) => t.count && t.countUnit !== '$' && countOf(save, t) > 0)
    .sort((a, b) => (countOf(save, b) / b.count) - (countOf(save, a) / a.count))
    .slice(0, 8);
  const totalLogged = db.trophies
    .filter((t) => t.count && t.countUnit !== '$')
    .reduce((sum, t) => sum + countOf(save, t), 0);
  $('#collectibles-mini').innerHTML = (logged.length
    ? logged.map((t) => `<div class="mc-row"><span>${esc(t.name)}</span><b>${fmtNum(countOf(save, t))}/${fmtNum(t.count)}</b></div>`).join('')
    : '<div class="mc-row"><span>No counts logged yet</span><b>0</b></div>')
    + `<div class="mc-row"><span><b>Total counts logged</b></span><b>${fmtNum(totalLogged)}</b></div>`;
}

// --- roadmap tab -----------------------------------------------------------

export function paintRoadmap(ctx) {
  const { db, save } = ctx;
  const cards = (db.meta.roadmap ?? []).map((phase) => {
    const inPhase = db.trophies.filter((t) => t.phase === phase.id).sort(roadmapOrder);
    const done = inPhase.filter((t) => isEarned(save, t)).length;
    const pct = inPhase.length ? Math.round((done / inPhase.length) * 100) : 0;
    const items = inPhase.map((t) => `<li class="${isEarned(save, t) ? 'done' : ''}"><b>${t.id}. `
      + `${isMasked(save, t) ? 'Story Trophy' : esc(t.name)}</b> <span style="color:var(--ink-soft)">(${esc(t.grade)}`
      + `${t.missable === 'possible' ? ', POSSIBLY MISSABLE' : ''}`
      + `${t.count ? `, ${fmtNum(t.count)} ${esc(t.countUnit)}` : ''})</span></li>`).join('');
    return `<div class="phase-card"><div class="phase-head"><h3>${esc(phase.name)}</h3>`
      + `<span class="ph-meta">${esc(phase.hours)} &middot; ${done}/${inPhase.length} earned &middot; ${pct}%</span></div>`
      + `<div class="phase-body"><p>${esc(phase.note)}</p>`
      + `<div class="pbar"><div style="width:${pct}%"></div></div>`
      + `<ul class="mini-list">${items}</ul></div></div>`;
  }).join('');
  $('#roadmap').innerHTML = cards
    + '<div class="setup-strip"><div><strong>Platinum math</strong> &mdash; '
    + `${esc(String(db.meta.hours_platinum ?? ''))} hours total on the fastest published roadmap `
    + '(60&ndash;80 story, ~100 100%-sweep, ~10 cleanup). Slower reads run 250+ hours (see dispute D7). '
    + 'Difficulty 4/10; 1 playthrough; 0 online trophies.</div>'
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'Sources [1] PowerPyx, [3] GTABase, [6] sixshore</div></div>';
}

// --- missables tab ---------------------------------------------------------

export function paintMissables(ctx) {
  const { db, save } = ctx;
  const pma = possiblyMissable(db);
  const watch = db.trophies.filter((t) => t.missable === 'watch').sort(roadmapOrder);
  const unconfirmed = db.trophies.filter(isUnconfirmed).sort(roadmapOrder);

  let html = '';
  if (pma) {
    const dispute = pma.dispute ? disputeById(db, pma.dispute) : null;
    html += `<div class="phase-card"><div class="phase-head"><h3>The one missable &mdash; ${esc(pma.name)}</h3>`
      + `<span class="ph-meta">${esc(pma.grade)} &middot; ${pma.count ? `${fmtNum(pma.count)} ${esc(pma.countUnit)}` : ''}</span></div>`
      + `<div class="phase-body"><p>${esc(pma.guide)}</p>`
      + `<ol class="steps">${(pma.steps ?? []).map((s) => `<li>${esc(s.t)} ${citeMarks(s.s)}</li>`).join('')}</ol>`;
    if (dispute) {
      html += `<div class="box warn"><h4>Dispute ${esc(dispute.id)} &mdash; ${esc(dispute.q)}</h4>`
        + `<p><b>Version A:</b> ${esc(dispute.a)}</p>`
        + `<p><b>Version B:</b> ${esc(dispute.b)}</p>`
        + `<p><b>Our call:</b> ${esc(dispute.call)}</p></div>`;
    }
    html += '</div></div>';
  }

  const rows = [];
  if (pma) {
    rows.push(`<tr><td><b>${esc(pma.name)}</b></td>`
      + '<td><b>POSSIBLY MISSABLE</b> &mdash; Chapter 1 balcony meditation gone after the chapter</td>'
      + '<td>Do it in Chapter 1; manual save right after</td></tr>');
  }
  for (const trophy of watch) {
    rows.push(`<tr><td><b>${esc(trophy.name)}</b></td>`
      + '<td>WATCH &mdash; quest-giver temporarily unavailable at story beats</td>'
      + '<td>Start the line when it appears; all return after the story [1]</td></tr>');
  }
  for (const trophy of unconfirmed) {
    rows.push(`<tr><td><b>${esc(trophy.name)}</b></td>`
      + '<td>UNCONFIRMED &mdash; unlock method not settled across sources</td>'
      + `<td>Follow the cited method; see ${esc(trophy.dispute ?? '')} in Sources &amp; Disputes</td></tr>`);
  }
  html += '<div class="phase-card"><div class="phase-head"><h3>Risk register</h3>'
    + '<span class="ph-meta">1 possibly missable &middot; 5 watch &middot; 3 unconfirmed</span></div>'
    + '<div class="phase-body"><table class="reg"><tr><th>Trophy</th><th>Risk</th><th>Window / fix</th></tr>'
    + rows.join('')
    + '<tr><td><b>Everything else</b></td>'
    + '<td>Safe &mdash; free-roam after the story; nothing else can be missed</td>'
    + '<td>PowerPyx, GTABase, Mobalytics [1][3][14]</td></tr>'
    + '</table></div></div>';
  html += '<div class="setup-strip"><div><strong>Also worth knowing (no trophy impact):</strong> '
    + 'optional missions can expire, some vendors go away, and a few story buildings close later &mdash; '
    + 'none of it locks the platinum. The only trophy with a real deadline is Positive Mental Attitude.</div>'
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'Source [1] PowerPyx</div></div>';
  $('#missables').innerHTML = html;
}

// --- sources tab -----------------------------------------------------------

function citedBy(db, n) {
  return db.trophies.filter((t) => (t.sources ?? []).includes(n)).length;
}

export function paintSources(ctx) {
  const { db, save } = ctx;
  const matrix = db.sources.map((s) => `<tr><td class="num"><b>[${s.n}]</b></td>`
    + `<td><b>${esc(s.site)}</b><br><span style="color:var(--ink-soft)">${esc(s.title)}</span></td>`
    + `<td>${esc(s.read)}</td>`
    + `<td class="num">${citedBy(db, s.n)} / 55</td>`
    + `<td style="font-size:12px">${esc(s.note ?? '')}</td></tr>`).join('');
  const disputes = db.disputes.map((d) => `<div class="dispute"><h3>${esc(d.id)} &mdash; ${esc(d.q)}</h3>`
    + `<div class="vs"><div><b>Version A</b>${esc(d.a)}</div><div><b>Version B</b>${esc(d.b)}</div></div>`
    + `<div class="call"><b>Our call:</b> ${esc(d.call)}</div></div>`).join('');
  const stats = auditStats(db, earnedIds(save));
  $('#sources').innerHTML = '<div class="setup-strip"><div><strong>Method</strong> &mdash; '
    + `${esc(db.methodNote)}</div>`
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'A claim seen in two or more sources is marked 2+ (green cites). Links open only when the reader follows them; the app itself fetches nothing.</div></div>'
    + `<div class="phase-card"><div class="phase-head"><h3>Source matrix</h3>`
    + `<span class="ph-meta">${db.sources.length} sources &middot; ${stats.steps} cited steps</span></div>`
    + '<div class="phase-body"><table class="reg"><tr><th>#</th><th>Source</th><th>Read</th><th>Cited by</th><th>What it supplied</th></tr>'
    + `${matrix}</table></div></div>`
    + `<div class="phase-card"><div class="phase-head"><h3>Disputes register &mdash; both versions, our call</h3>`
    + `<span class="ph-meta">${db.disputes.length} disputes</span></div>`
    + `<div class="phase-body">${disputes}</div></div>`;
}

// --- checklist tab ---------------------------------------------------------

const COUNT_LABELS = {
  activities: 'Activity types',
  animals_study: 'Animals to study',
  animals_total: 'Animals in total',
  bank_vaults: 'Large bank vaults',
  challenges: 'Challenges in total',
  challenges_100: 'Challenges for 100%',
  collectible_card_sets: 'Collectible card sets',
  gang_operations: 'Gang operations',
  gangs: 'Gangs',
  garages_buy: 'Garages to buy',
  garages_total: 'Garages in total',
  meditations: 'Meditations',
  meditation_spots: 'Meditation spots',
  races_unique: 'Unique races',
  shooting_challenges: 'Shooting challenges',
  shooting_ranges: 'Shooting ranges',
  stunts: 'Stunts in total',
  stunts_100: 'Stunts for 100%',
  target_decks: 'Target Decks',
  top_fun_locations: 'Top Fun locations',
  top_fun_races: 'Top Fun races',
  vehicles_total: 'Vehicles in total',
  vehicles_100: 'Vehicles to scan for 100%',
  vehicles_base: 'Base-model vehicles',
  waink_landmarks: 'WAiNK landmarks',
  waink_curiosities: 'WAiNK curiosities',
  waink_sculptures: 'WAiNK sculptures',
};

export function paintChecklist(ctx) {
  const { db, save, hooks } = ctx;
  const counts = db.meta.counts ?? {};
  const keys = Object.keys(counts).sort();
  const totalRows = keys.map((k) => `<tr><td><b>${esc(COUNT_LABELS[k] ?? k)}</b></td>`
    + `<td class="num"><b>${fmtNum(counts[k])}</b></td></tr>`).join('');

  const groups = new Map();
  for (const trophy of [...db.trophies].sort(roadmapOrder)) {
    const group = KIND_LABELS[trophy.kind] ?? trophy.kind;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(trophy);
  }
  const lists = [...groups.entries()].map(([group, trophies]) => `<h3 style="margin-top:10px">${esc(group)} (${trophies.length})</h3>`
    + '<ul class="mini-list">'
    + trophies.map((t) => `<li class="${isEarned(save, t) ? 'done' : ''}"><label style="cursor:pointer">`
      + `<input type="checkbox" data-check="${t.id}"${isEarned(save, t) ? ' checked' : ''}> `
      + `<b>${t.id}. ${isMasked(save, t) ? 'Story Trophy' : esc(t.name)}</b></label></li>`).join('')
    + '</ul>').join('');

  const earned = earnedIds(save).size;
  $('#checklist').innerHTML = '<div class="setup-strip"><div><strong>A Long Road (gold) &mdash; the 100% checklist</strong> &mdash; '
    + `${esc(db.meta.note_100 ?? '')} The checklist opens after the story under Progress &gt; Stats &gt; `
    + '100% Completion; progress made during the story already counts, and nothing on it is missable.</div>'
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'Sources [1] PowerPyx, [4] Insider Gaming, [11] GTA Vice City Hub</div></div>'
    + `<div class="phase-card"><div class="phase-head"><h3>Completion totals the game tracks</h3>`
    + `<span class="ph-meta">${keys.length} lines</span></div>`
    + `<div class="phase-body"><table class="reg"><tr><th>Line</th><th>Target</th></tr>${totalRows}</table></div></div>`
    + `<div class="phase-card"><div class="phase-head"><h3>Every trophy, one checklist</h3>`
    + `<span class="ph-meta">${earned}/55 earned</span></div>`
    + `<div class="phase-body">${lists}</div></div>`;
  for (const box of $$('input[data-check]', $('#checklist'))) {
    box.addEventListener('change', () => {
      hooks.toggleEarned(Number(box.dataset.check), box.checked);
    });
  }
}
