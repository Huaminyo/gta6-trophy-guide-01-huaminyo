// The Leonida Field Manual — every pixel the guide shows.
//
// Each painter reads the Manual (store.js) and writes one part of the page.
// Dynamic controls re-render through the actions object the entry point
// hands in: actions.pick(id), actions.check(id, on), actions.reveal(),
// actions.step(trophy, delta), actions.refresh(), actions.refreshTracker().
import {
  $, $$, byRoadmap, esc, fmtCounter, fmtDate, fmtInt, KIND_LABELS,
} from './lib.js';

// --- small shared fragments ------------------------------------------------

// [1] [3] — a step's source numbers; two or more sources get the green tint.
function cites(numbers) {
  const list = numbers ?? [];
  const twoPlus = list.length >= 2;
  return list.map(
    (n) => `<span class="cite${twoPlus ? ' two' : ''}">[${n}]</span>`,
  ).join(' ');
}

function gradeChip(trophy) {
  return `<span class="tag ${trophy.grade}">${trophy.grade.toUpperCase()}</span>`;
}

function tagRow(manual, trophy) {
  const tags = [gradeChip(trophy)];
  if (trophy.missable === 'possible') tags.push('<span class="tag miss">POSSIBLY MISSABLE</span>');
  if (trophy.missable === 'watch') tags.push('<span class="tag watch">WATCH</span>');
  if (trophy.hidden) tags.push('<span class="tag hid">PSN-HIDDEN</span>');
  if (trophy.dispute) tags.push('<span class="tag disp">DISPUTED</span>');
  if (manual.isUnconfirmed(trophy)) tags.push('<span class="tag watch">UNCONFIRMED</span>');
  if (trophy.count) {
    tags.push(`<span class="tag cnt">${fmtCounter(trophy, manual.countOf(trophy))}/${fmtCounter(trophy, trophy.count)} ${esc(String(trophy.countUnit).toUpperCase())}</span>`);
  }
  return tags.join('');
}

function sourceItem(manual, source) {
  const link = source.url
    ? ` &mdash; <a href="${esc(source.url)}" target="_blank" rel="noopener">open source</a>`
    : '';
  return `<li><b>[${source.n}] ${esc(source.site)}</b> &mdash; ${esc(source.title)}${link} <span style="color:var(--ink-soft)">(${esc(source.read)})</span></li>`;
}

// --- audit strip + progress pill -------------------------------------------

export function paintAudit(manual) {
  const a = manual.audit();
  const sep = '<span class="sep">|</span>';
  $('#audit').innerHTML = [
    `<span><b>${a.total}/${a.total}</b> official name, description &amp; grade</span>`,
    `<span><b>${a.guides}/${a.total}</b> guides in our own words</span>`,
    `<span><b>${a.cited}/${a.steps}</b> steps cited</span>`,
    `<span><b>${a.backed}</b> backed by 2+ sources</span>`,
    `<span><b>${a.sources}</b> sources read ${esc(fmtDate(manual.readDate))}</span>`,
    `<span><b>${a.disputes}</b> disputes shown both ways</span>`,
    `<span><b>${a.missable}</b> possibly missable &middot; <b>${a.watch}</b> watch &middot; <b>${a.unconfirmed}</b> unconfirmed</span>`,
    `<span><b>${a.trackers}</b> count trackers &middot; <b>${a.hidden}</b> PSN-hidden</span>`,
    `<span>roadmap <b>${esc(manual.meta.roadmap_hours ?? '')} h</b></span>`,
  ].join(sep);
}

export function paintProgress(manual) {
  const { earned, total } = manual.points();
  $('#progress-pill').textContent =
    `${manual.earnedCount()}/${manual.audit().total} earned · ${fmtInt(earned)}/${fmtInt(total)} PTS`;
  $('#btn-spoiler').textContent = `Spoiler shield: ${manual.save.spoiler ? 'ON' : 'OFF'}`;
}

// --- tracker: checklist ----------------------------------------------------

function kindMatches(trophy, kind) {
  if (!kind) return true;
  if (kind === 'missable') return trophy.missable !== 'none';
  if (kind === 'crime') return trophy.kind === 'crime' || trophy.kind === 'feat';
  if (kind === 'completion') return trophy.kind === 'completion' || trophy.kind === 'platinum';
  return trophy.kind === kind;
}

function visibleTrophies(manual) {
  const { q, kind, grade, hideEarned } = manual.filters;
  const needle = q.toLowerCase();
  return manual.trophies
    .filter((t) => {
      if (!kindMatches(t, kind)) return false;
      if (grade && t.grade !== grade) return false;
      if (hideEarned && manual.isEarned(t)) return false;
      if (!needle) return true;
      const haystack = [
        t.name, t.description, t.guide,
        ...(t.steps ?? []).map((s) => s.t),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    })
    .sort(byRoadmap);
}

export function paintList(manual) {
  const list = visibleTrophies(manual);
  const total = manual.audit().total;
  $('#list-meta').textContent = `Showing ${list.length} of ${total} · ${manual.earnedCount()} earned`;
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
      html += `<li class="phase-row"><b>${esc(manual.phaseName(trophy.phase))}</b></li>`;
    }
    const masked = manual.isMasked(trophy);
    const classes = [
      manual.isEarned(trophy) ? 'earned' : '',
      manual.save.selected === trophy.id ? 'selected' : '',
    ].filter(Boolean).join(' ');
    html += `<li data-id="${trophy.id}"${classes ? ` class="${classes}"` : ''}>`
      + `<input type="checkbox"${manual.isEarned(trophy) ? ' checked' : ''} aria-label="Earned: ${esc(trophy.name)}">`
      + '<div class="t-main">'
      + `<div class="t-name">${masked ? '<span class="spoiled">&#9619;&#9619; STORY TROPHY &#9619;&#9619;</span>' : esc(`${trophy.id}. ${trophy.name}`)}</div>`
      + `<div class="t-desc">${masked ? 'Hidden by the spoiler shield until earned.' : esc(trophy.description)}</div>`
      + `<div class="t-tags">${tagRow(manual, trophy)}</div>`
      + '</div></li>';
  }
  el.innerHTML = html;
  const selected = $('li.selected', el);
  if (selected && el.clientHeight > 0) {
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }
}

// --- tracker: selected trophy guide ----------------------------------------

function maskedDetail(manual, trophy) {
  return `<h2>Story Trophy</h2>`
    + `<div class="d-meta">Trophy #${trophy.id} of ${manual.audit().total} &middot; ${esc(KIND_LABELS[trophy.kind] ?? trophy.kind)}`
    + ` &middot; ${esc(manual.phaseName(trophy.phase))}</div>`
    + '<div class="box watch"><h4>Spoiler shield is on</h4>'
    + '<p>This is a story trophy: its name, description and guide name story moments. '
    + 'Turn the shield off (top right) or earn it to read the guide &mdash; or reveal it here.</p>'
    + '<p><button type="button" class="ctl" id="reveal-btn">Reveal this trophy&rsquo;s guide</button></p></div>';
}

function stepperHtml(manual, trophy) {
  const value = manual.countOf(trophy);
  const pct = Math.min(100, Math.round((value / trophy.count) * 100));
  const step = trophy.countUnit === '$' ? 1000 : 1;
  return `<div class="stepper"><div class="st-label">YOUR COUNT<small>${esc(trophy.countLabel ?? '')}</small>`
    + `<div class="st-bar"><div style="width:${pct}%"></div></div></div>`
    + `<button type="button" data-step="-${step}" aria-label="Decrease count">&minus;</button>`
    + `<div class="st-val">${fmtCounter(trophy, value)}<span style="font-size:12px;color:var(--ink-soft)"> / ${fmtCounter(trophy, trophy.count)}</span></div>`
    + `<button type="button" data-step="${step}" aria-label="Increase count">+</button></div>`;
}

function routeHtml(manual, trophy) {
  const route = manual.routeFor(trophy);
  if (!route) return '';
  const stages = route.stages.map((stage, i) => {
    const pct = Math.min(100, Math.round((stage.n / trophy.count) * 100));
    return `<div class="route-stage"><b>Stage ${i + 1} &mdash; ${esc(stage.label)}</b> `
      + `<span class="rs-n">${fmtInt(stage.n)} / ${fmtInt(trophy.count)} (${pct}%)</span><br>${esc(stage.tip)}</div>`;
  }).join('');
  return `<div class="d-sec"><h3>Route &mdash; ${esc(route.title)}</h3>${stages}`
    + '<p class="hint">Stages run in order; counts add up to the trophy target. Sources are the trophy&rsquo;s own cited sources, listed below.</p></div>';
}

export function paintDetail(manual) {
  const trophy = manual.selected;
  const el = $('#detail');
  if (!trophy) {
    el.innerHTML = '<p class="empty">No trophy selected.</p>';
    return;
  }
  if (manual.isMasked(trophy)) {
    el.innerHTML = maskedDetail(manual, trophy);
    return;
  }
  const dispute = trophy.dispute ? manual.dispute(trophy.dispute) : null;
  const citedSteps = (trophy.steps ?? []).filter((s) => s.s?.length).length;
  const sources = (trophy.sources ?? [])
    .map((n) => manual.source(n))
    .filter(Boolean);

  let html = `<h2>${esc(trophy.name)}</h2>`
    + `<div class="d-meta">Trophy #${trophy.id} of ${manual.audit().total} &middot; ${esc(KIND_LABELS[trophy.kind] ?? trophy.kind)}`
    + ` &middot; ${esc(trophy.grade)} &middot; ${esc(manual.phaseName(trophy.phase))}`
    + `${trophy.hidden ? ' &middot; hidden on PlayStation until earned' : ''}</div>`
    + `<div class="t-tags">${tagRow(manual, trophy)}</div>`
    + `<p class="d-official"><b>Official description:</b> &ldquo;${esc(trophy.description)}&rdquo;</p>`;
  if (trophy.count) html += stepperHtml(manual, trophy);
  html += `<div class="d-sec"><h3>Guide</h3><p>${esc(trophy.guide)}</p></div>`;
  html += `<div class="d-sec"><h3>Steps &mdash; ${(trophy.steps ?? []).length} steps, ${citedSteps} cited</h3><ol class="steps">`
    + (trophy.steps ?? []).map((s) => `<li>${esc(s.t)} ${cites(s.s)}</li>`).join('')
    + '</ol></div>';
  html += routeHtml(manual, trophy);
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
    + sources.map((s) => sourceItem(manual, s)).join('')
    + '</ol></div>';
  el.innerHTML = html;
}

// --- tracker: right rail ---------------------------------------------------

export function paintRail(manual) {
  const upcoming = manual.trophies
    .filter((t) => !manual.isEarned(t))
    .sort(byRoadmap)
    .slice(0, 6);
  const nextEl = $('#nextup');
  if (!upcoming.length) {
    nextEl.innerHTML = '<li>All 55 earned. Leonida Legend.</li>';
  } else {
    nextEl.innerHTML = upcoming.map((t) => `<li data-id="${t.id}"><b>${manual.isMasked(t) ? `Story Trophy #${t.id}` : esc(t.name)}</b>`
      + `<small>${esc(KIND_LABELS[t.kind] ?? t.kind)} &middot; ${esc(t.grade)} &middot; ${esc(manual.phaseName(t.phase))}`
      + `${t.missable === 'possible' ? ' &middot; POSSIBLY MISSABLE' : ''}</small></li>`).join('');
  }

  const selected = manual.selected;
  const railSources = selected
    ? (selected.sources ?? []).map((n) => manual.source(n)).filter(Boolean)
    : [];
  $('#rail-sources').innerHTML = railSources.length
    ? railSources.map((s) => `<li><b>[${s.n}] ${esc(s.site)}</b> &mdash; ${esc(s.title)}</li>`).join('')
    : '<li>No sources listed.</li>';

  const logged = manual.trophies
    .filter((t) => t.count && t.countUnit !== '$' && manual.countOf(t) > 0)
    .sort((a, b) => (manual.countOf(b) / b.count) - (manual.countOf(a) / a.count))
    .slice(0, 8);
  const totalLogged = manual.trophies
    .filter((t) => t.count && t.countUnit !== '$')
    .reduce((sum, t) => sum + manual.countOf(t), 0);
  $('#collectibles-mini').innerHTML = (logged.length
    ? logged.map((t) => `<div class="mc-row"><span>${esc(t.name)}</span><b>${fmtInt(manual.countOf(t))}/${fmtInt(t.count)}</b></div>`).join('')
    : '<div class="mc-row"><span>No counts logged yet</span><b>0</b></div>')
    + `<div class="mc-row"><span><b>Total counts logged</b></span><b>${fmtInt(totalLogged)}</b></div>`;
}

// --- roadmap tab -----------------------------------------------------------

export function paintRoadmap(manual) {
  const cards = (manual.meta.roadmap ?? []).map((phase) => {
    const inPhase = manual.trophies.filter((t) => t.phase === phase.id).sort(byRoadmap);
    const done = inPhase.filter((t) => manual.isEarned(t)).length;
    const pct = inPhase.length ? Math.round((done / inPhase.length) * 100) : 0;
    const items = inPhase.map((t) => `<li class="${manual.isEarned(t) ? 'done' : ''}"><b>${t.id}. `
      + `${manual.isMasked(t) ? 'Story Trophy' : esc(t.name)}</b> <span style="color:var(--ink-soft)">(${esc(t.grade)}`
      + `${t.missable === 'possible' ? ', POSSIBLY MISSABLE' : ''}`
      + `${t.count ? `, ${fmtInt(t.count)} ${esc(t.countUnit)}` : ''})</span></li>`).join('');
    return `<div class="phase-card"><div class="phase-head"><h3>${esc(phase.name)}</h3>`
      + `<span class="ph-meta">${esc(phase.hours)} &middot; ${done}/${inPhase.length} earned &middot; ${pct}%</span></div>`
      + `<div class="phase-body"><p>${esc(phase.note)}</p>`
      + `<div class="pbar"><div style="width:${pct}%"></div></div>`
      + `<ul class="mini-list">${items}</ul></div></div>`;
  }).join('');
  $('#roadmap').innerHTML = cards
    + '<div class="setup-strip"><div><strong>Platinum math</strong> &mdash; '
    + `${esc(String(manual.meta.hours_platinum ?? ''))} hours total on the fastest published roadmap `
    + '(60&ndash;80 story, ~100 100%-sweep, ~10 cleanup). Slower reads run 250+ hours (see dispute D7). '
    + 'Difficulty 4/10; 1 playthrough; 0 online trophies.</div>'
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'Sources [1] PowerPyx, [3] GTABase, [6] sixshore</div></div>';
}

// --- missables tab ---------------------------------------------------------

export function paintMissables(manual) {
  const pma = manual.missableOne;
  const watch = manual.trophies.filter((t) => t.missable === 'watch').sort(byRoadmap);
  const unconfirmed = manual.trophies.filter((t) => manual.isUnconfirmed(t)).sort(byRoadmap);

  let html = '';
  if (pma) {
    const dispute = pma.dispute ? manual.dispute(pma.dispute) : null;
    html += `<div class="phase-card"><div class="phase-head"><h3>The one missable &mdash; ${esc(pma.name)}</h3>`
      + `<span class="ph-meta">${esc(pma.grade)} &middot; ${pma.count ? `${fmtInt(pma.count)} ${esc(pma.countUnit)}` : ''}</span></div>`
      + `<div class="phase-body"><p>${esc(pma.guide)}</p>`
      + `<ol class="steps">${(pma.steps ?? []).map((s) => `<li>${esc(s.t)} ${cites(s.s)}</li>`).join('')}</ol>`;
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

function citedBy(manual, n) {
  return manual.trophies.filter((t) => (t.sources ?? []).includes(n)).length;
}

export function paintSources(manual) {
  const matrix = manual.sources.map((s) => `<tr><td class="num"><b>[${s.n}]</b></td>`
    + `<td><b>${esc(s.site)}</b><br><span style="color:var(--ink-soft)">${esc(s.title)}</span></td>`
    + `<td>${esc(s.read)}</td>`
    + `<td class="num">${citedBy(manual, s.n)} / ${manual.audit().total}</td>`
    + `<td style="font-size:12px">${esc(s.note ?? '')}</td></tr>`).join('');
  const disputes = manual.disputes.map((d) => `<div class="dispute"><h3>${esc(d.id)} &mdash; ${esc(d.q)}</h3>`
    + `<div class="vs"><div><b>Version A</b>${esc(d.a)}</div><div><b>Version B</b>${esc(d.b)}</div></div>`
    + `<div class="call"><b>Our call:</b> ${esc(d.call)}</div></div>`).join('');
  const stats = manual.audit();
  $('#sources').innerHTML = '<div class="setup-strip"><div><strong>Method</strong> &mdash; '
    + `${esc(manual.methodNote)}</div>`
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'A claim seen in two or more sources is marked 2+ (green cites). Links open only when the reader follows them; the app itself fetches nothing.</div></div>'
    + `<div class="phase-card"><div class="phase-head"><h3>Source matrix</h3>`
    + `<span class="ph-meta">${manual.sources.length} sources &middot; ${stats.steps} cited steps</span></div>`
    + '<div class="phase-body"><table class="reg"><tr><th>#</th><th>Source</th><th>Read</th><th>Cited by</th><th>What it supplied</th></tr>'
    + `${matrix}</table></div></div>`
    + `<div class="phase-card"><div class="phase-head"><h3>Disputes register &mdash; both versions, our call</h3>`
    + `<span class="ph-meta">${manual.disputes.length} disputes</span></div>`
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

export function paintChecklist(manual) {
  const counts = manual.meta.counts ?? {};
  const keys = Object.keys(counts).sort();
  const totalRows = keys.map((k) => `<tr><td><b>${esc(COUNT_LABELS[k] ?? k)}</b></td>`
    + `<td class="num"><b>${fmtInt(counts[k])}</b></td></tr>`).join('');

  const groups = new Map();
  for (const trophy of [...manual.trophies].sort(byRoadmap)) {
    const group = KIND_LABELS[trophy.kind] ?? trophy.kind;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(trophy);
  }
  const lists = [...groups.entries()].map(([group, trophies]) => `<h3 style="margin-top:10px">${esc(group)} (${trophies.length})</h3>`
    + '<ul class="mini-list">'
    + trophies.map((t) => `<li class="${manual.isEarned(t) ? 'done' : ''}"><label style="cursor:pointer">`
      + `<input type="checkbox" data-check="${t.id}"${manual.isEarned(t) ? ' checked' : ''}> `
      + `<b>${t.id}. ${manual.isMasked(t) ? 'Story Trophy' : esc(t.name)}</b></label></li>`).join('')
    + '</ul>').join('');

  $('#checklist').innerHTML = '<div class="setup-strip"><div><strong>A Long Road (gold) &mdash; the 100% checklist</strong> &mdash; '
    + `${esc(manual.meta.note_100 ?? '')} The checklist opens after the story under Progress &gt; Stats &gt; `
    + '100% Completion; progress made during the story already counts, and nothing on it is missable.</div>'
    + '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">'
    + 'Sources [1] PowerPyx, [4] Insider Gaming, [11] GTA Vice City Hub</div></div>'
    + `<div class="phase-card"><div class="phase-head"><h3>Completion totals the game tracks</h3>`
    + `<span class="ph-meta">${keys.length} lines</span></div>`
    + `<div class="phase-body"><table class="reg"><tr><th>Line</th><th>Target</th></tr>${totalRows}</table></div></div>`
    + `<div class="phase-card"><div class="phase-head"><h3>Every trophy, one checklist</h3>`
    + `<span class="ph-meta">${manual.earnedCount()}/${manual.audit().total} earned</span></div>`
    + `<div class="phase-body">${lists}</div></div>`;
}
