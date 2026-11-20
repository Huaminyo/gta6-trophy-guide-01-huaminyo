// The Leonida Field Manual — offline GTA VI trophy guide & tracker (v2 rebuild).
// Static files only. Data loads from data/trophies.json, data/sources.json and
// data/routes.json with same-origin fetch, so the guide works with the network
// off. Progress lives in this browser's localStorage; nothing is uploaded.
'use strict';

var SAVE_KEY = 'leonida-field-manual-v2';
var GRADE_POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };
var KIND_NAMES = {
  story: 'Story', side: 'Side', collectible: 'Collectible', activity: 'Activity',
  crime: 'Crime', feat: 'Feat', completion: 'Completion', platinum: 'Platinum'
};
var UNCONFIRMED_DISPUTES = ['D3', 'D4', 'D5'];
var TABS = ['tracker', 'roadmap', 'missables', 'sources', 'checklist'];

var TROPHIES = [];
var META = {};
var SOURCES = [];
var DISPUTES = [];
var METHOD_NOTE = '';
var READ_DATE = '';
var ROUTES = [];

var save = loadSave();
var filter = { q: '', kind: '', grade: '', hideEarned: false };

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadSave() {
  var fresh = { earned: {}, counts: {}, spoiler: true, selected: null, tab: 'tracker' };
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    var s = JSON.parse(raw);
    fresh.earned = s.earned || {};
    fresh.counts = s.counts || {};
    fresh.spoiler = s.spoiler !== false;
    fresh.selected = s.selected || null;
    fresh.tab = s.tab || 'tracker';
    return fresh;
  } catch (e) { return fresh; }
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      earned: save.earned, counts: save.counts,
      spoiler: save.spoiler, selected: save.selected, tab: save.tab
    }));
  } catch (e) { /* storage full or blocked: the guide still works */ }
}

function roadmapOrder(a, b) { return (a.phase - b.phase) || (a.id - b.id); }
function trophyById(id) {
  for (var i = 0; i < TROPHIES.length; i++) if (TROPHIES[i].id === id) return TROPHIES[i];
  return null;
}
function isEarned(t) { return !!save.earned[t.id]; }
function countVal(t) {
  if (!t.count) return 0;
  var v = save.counts[t.id] || 0;
  return Math.max(0, Math.min(t.count, v));
}
function isMasked(t) { return save.spoiler && t.kind === 'story' && !isEarned(t); }
function isUnconfirmed(t) { return UNCONFIRMED_DISPUTES.indexOf(t.dispute || '') !== -1; }
function disputeById(id) {
  for (var i = 0; i < DISPUTES.length; i++) if (DISPUTES[i].id === id) return DISPUTES[i];
  return null;
}
function sourceByNum(n) {
  for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].n === n) return SOURCES[i];
  return null;
}
function routeFor(t) {
  for (var i = 0; i < ROUTES.length; i++) {
    if (ROUTES[i].count === t.count && ROUTES[i].unit === t.countUnit) return ROUTES[i];
  }
  return null;
}
function fmtNum(n) { return n.toLocaleString('en-US'); }
function fmtCount(t, v) { return t.countUnit === '$' ? '$' + fmtNum(v) : fmtNum(v); }
function fmtDate(iso) {
  var parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}
function phaseName(id) {
  for (var i = 0; i < (META.roadmap || []).length; i++) {
    if (META.roadmap[i].id === id) return META.roadmap[i].name;
  }
  return 'Phase ' + id;
}

function seedDemo() {
  // ?demo=1 seeds a believable mid-run state (18 earned, partial counts) so the
  // screenshots show a tracker in use. It only applies when no save exists yet,
  // and it never changes the guide itself. PMA stays unearned on purpose: the
  // cover shows the possibly-missable warning live.
  if (localStorage.getItem(SAVE_KEY)) return;
  var ordered = TROPHIES.slice().sort(roadmapOrder);
  var earned = 0;
  for (var i = 0; i < ordered.length && earned < 18; i++) {
    if (ordered[i].missable === 'possible') continue;
    save.earned[ordered[i].id] = true;
    earned++;
  }
  var partial = 0;
  for (var j = 0; j < ordered.length && partial < 6; j++) {
    var t = ordered[j];
    if (isEarned(t) || !t.count) continue;
    save.counts[t.id] = Math.max(1, Math.floor(t.count * 0.55));
    partial++;
  }
  var pma = null;
  for (var k = 0; k < TROPHIES.length; k++) {
    if (TROPHIES[k].missable === 'possible') pma = TROPHIES[k];
  }
  if (pma && pma.count) save.counts[pma.id] = Math.floor(pma.count / 3);
  save.selected = pma ? pma.id : ordered[0].id;
  persist();
}

function audit() {
  var steps = 0, cited = 0, twoPlus = 0;
  TROPHIES.forEach(function (t) {
    (t.steps || []).forEach(function (s) {
      steps++;
      if (s.s && s.s.length) cited++;
      if (s.s && s.s.length >= 2) twoPlus++;
    });
  });
  return {
    total: TROPHIES.length,
    guides: TROPHIES.filter(function (t) { return (t.guide || '').trim(); }).length,
    steps: steps, cited: cited, twoPlus: twoPlus,
    sources: SOURCES.length, disputes: DISPUTES.length,
    missable: TROPHIES.filter(function (t) { return t.missable === 'possible'; }).length,
    watch: TROPHIES.filter(function (t) { return t.missable === 'watch'; }).length,
    unconfirmed: TROPHIES.filter(isUnconfirmed).length,
    trackers: TROPHIES.filter(function (t) { return !!t.count; }).length,
    hidden: TROPHIES.filter(function (t) { return t.hidden; }).length,
    earned: TROPHIES.filter(isEarned).length
  };
}

function citeMarks(srcs) {
  srcs = srcs || [];
  var two = srcs.length >= 2;
  return srcs.map(function (n) {
    return '<span class="cite' + (two ? ' two' : '') + '">[' + n + ']</span>';
  }).join(' ');
}
function gradeTag(t) {
  return '<span class="tag ' + t.grade + '">' + t.grade.toUpperCase() + '</span>';
}
function trophyTags(t) {
  var tags = [gradeTag(t)];
  if (t.missable === 'possible') tags.push('<span class="tag miss">POSSIBLY MISSABLE</span>');
  if (t.missable === 'watch') tags.push('<span class="tag watch">WATCH</span>');
  if (t.hidden) tags.push('<span class="tag hid">PSN-HIDDEN</span>');
  if (t.dispute) tags.push('<span class="tag disp">DISPUTED</span>');
  if (isUnconfirmed(t)) tags.push('<span class="tag watch">UNCONFIRMED</span>');
  if (t.count) {
    tags.push('<span class="tag cnt">' + fmtCount(t, countVal(t)) + '/' + fmtCount(t, t.count) +
      ' ' + esc(String(t.countUnit).toUpperCase()) + '</span>');
  }
  return tags.join('');
}

function paintAudit() {
  var a = audit();
  var sep = '<span class="sep">|</span>';
  $('#audit').innerHTML =
    '<span><b>55/55</b> official name, description &amp; grade</span>' + sep +
    '<span><b>' + a.guides + '/55</b> guides in our own words</span>' + sep +
    '<span><b>' + a.cited + '/' + a.steps + '</b> steps cited</span>' + sep +
    '<span><b>' + a.twoPlus + '</b> backed by 2+ sources</span>' + sep +
    '<span><b>' + a.sources + '</b> sources read ' + esc(fmtDate(READ_DATE)) + '</span>' + sep +
    '<span><b>' + a.disputes + '</b> disputes shown both ways</span>' + sep +
    '<span><b>' + a.missable + '</b> possibly missable &middot; <b>' + a.watch + '</b> watch &middot; <b>' +
    a.unconfirmed + '</b> unconfirmed</span>' + sep +
    '<span><b>' + a.trackers + '</b> count trackers &middot; <b>' + a.hidden + '</b> PSN-hidden</span>' + sep +
    '<span>roadmap <b>' + esc(META.roadmap_hours || '') + ' h</b></span>';
}

function paintProgress() {
  var a = audit();
  var pts = TROPHIES.filter(isEarned).reduce(function (sum, t) { return sum + (GRADE_POINTS[t.grade] || 0); }, 0);
  $('#progress-pill').textContent = a.earned + '/55 earned · ' + fmtNum(pts) + '/1,350 PTS';
  $('#btn-spoiler').textContent = 'Spoiler shield: ' + (save.spoiler ? 'ON' : 'OFF');
}

function kindMatches(t) {
  switch (filter.kind) {
    case '': return true;
    case 'story': return t.kind === 'story';
    case 'missable': return t.missable !== 'none';
    case 'collectible': return t.kind === 'collectible';
    case 'activity': return t.kind === 'activity';
    case 'crime': return t.kind === 'crime' || t.kind === 'feat';
    case 'side': return t.kind === 'side';
    case 'completion': return t.kind === 'completion' || t.kind === 'platinum';
    default: return true;
  }
}
function visibleTrophies() {
  var q = filter.q.toLowerCase();
  return TROPHIES.filter(function (t) {
    if (!kindMatches(t)) return false;
    if (filter.grade && t.grade !== filter.grade) return false;
    if (filter.hideEarned && isEarned(t)) return false;
    if (q) {
      var hay = [t.name, t.description, t.guide]
        .concat((t.steps || []).map(function (s) { return s.t; }))
        .join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(roadmapOrder);
}

function paintList() {
  var list = visibleTrophies();
  var a = audit();
  $('#list-meta').textContent = 'Showing ' + list.length + ' of 55 · ' + a.earned + ' earned';
  var el = $('#trophy-list');
  if (!list.length) {
    el.innerHTML = '<li class="empty">No trophies match these filters.</li>';
    return;
  }
  var html = '';
  var lastPhase = null;
  list.forEach(function (t) {
    if (t.phase !== lastPhase) {
      lastPhase = t.phase;
      html += '<li class="phase-row"><b>' + esc(phaseName(t.phase)) + '</b></li>';
    }
    var masked = isMasked(t);
    html += '<li data-id="' + t.id + '"' +
      (isEarned(t) ? ' class="earned' : ' class="') +
      (save.selected === t.id ? ' selected' : '') + '">' +
      '<input type="checkbox"' + (isEarned(t) ? ' checked' : '') +
      ' aria-label="Earned: ' + esc(t.name) + '">' +
      '<div class="t-main">' +
      '<div class="t-name">' + (masked ? '<span class="spoiled">&#9619;&#9619; STORY TROPHY &#9619;&#9619;</span>' : esc(t.id + '. ' + t.name)) + '</div>' +
      '<div class="t-desc">' + (masked ? 'Hidden by the spoiler shield until earned.' : esc(t.description)) + '</div>' +
      '<div class="t-tags">' + trophyTags(t) + '</div>' +
      '</div></li>';
  });
  el.innerHTML = html;
  $all('li[data-id]', el).forEach(function (row) {
    var id = Number(row.getAttribute('data-id'));
    row.addEventListener('click', function (e) {
      if (e.target.tagName === 'INPUT') return;
      save.selected = id;
      persist();
      paintList(); paintDetail(); paintRail();
    });
    $('input', row).addEventListener('change', function (e) {
      if (e.target.checked) save.earned[id] = true; else delete save.earned[id];
      persist();
      paintAll();
    });
  });
  var sel = $('li.selected', el);
  if (sel && el.clientHeight > 0) {
    var top = sel.offsetTop, bottom = top + sel.offsetHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }
}

function paintDetail() {
  var t = trophyById(save.selected) || TROPHIES[0];
  var el = $('#detail');
  if (!t) { el.innerHTML = '<p class="empty">No trophy selected.</p>'; return; }
  if (isMasked(t)) {
    el.innerHTML = '<h2>Story Trophy</h2>' +
      '<div class="d-meta">Trophy #' + t.id + ' of 55 &middot; ' + esc(KIND_NAMES[t.kind] || t.kind) +
      ' &middot; ' + esc(phaseName(t.phase)) + '</div>' +
      '<div class="box watch"><h4>Spoiler shield is on</h4>' +
      '<p>This is a story trophy: its name, description and guide name story moments. ' +
      'Turn the shield off (top right) or earn it to read the guide &mdash; or reveal it here.</p>' +
      '<p><button type="button" class="ctl" id="reveal-btn">Reveal this trophy&rsquo;s guide</button></p></div>';
    $('#reveal-btn').addEventListener('click', function () {
      save.spoiler = false;
      persist();
      paintAll();
    });
    return;
  }
  var d = t.dispute ? disputeById(t.dispute) : null;
  var route = routeFor(t);
  var citedSteps = (t.steps || []).filter(function (s) { return s.s && s.s.length; }).length;
  var html = '<h2>' + esc(t.name) + '</h2>' +
    '<div class="d-meta">Trophy #' + t.id + ' of 55 &middot; ' + esc(KIND_NAMES[t.kind] || t.kind) +
    ' &middot; ' + esc(t.grade) + ' &middot; ' + esc(phaseName(t.phase)) +
    (t.hidden ? ' &middot; hidden on PlayStation until earned' : '') + '</div>' +
    '<div class="t-tags">' + trophyTags(t) + '</div>' +
    '<p class="d-official"><b>Official description:</b> &ldquo;' + esc(t.description) + '&rdquo;</p>';
  if (t.count) {
    var v = countVal(t);
    var pct = Math.min(100, Math.round(v / t.count * 100));
    var step = t.countUnit === '$' ? 1000 : 1;
    html += '<div class="stepper"><div class="st-label">YOUR COUNT<small>' + esc(t.countLabel || '') +
      '</small><div class="st-bar"><div style="width:' + pct + '%"></div></div></div>' +
      '<button type="button" data-step="-' + step + '" aria-label="Decrease count">&minus;</button>' +
      '<div class="st-val">' + fmtCount(t, v) + '<span style="font-size:12px;color:var(--ink-soft)"> / ' +
      fmtCount(t, t.count) + '</span></div>' +
      '<button type="button" data-step="' + step + '" aria-label="Increase count">+</button></div>';
  }
  html += '<div class="d-sec"><h3>Guide</h3><p>' + esc(t.guide) + '</p></div>';
  html += '<div class="d-sec"><h3>Steps &mdash; ' + (t.steps || []).length + ' steps, ' + citedSteps +
    ' cited</h3><ol class="steps">';
  (t.steps || []).forEach(function (s) {
    html += '<li>' + esc(s.t) + ' ' + citeMarks(s.s) + '</li>';
  });
  html += '</ol></div>';
  if (route) {
    html += '<div class="d-sec"><h3>Route &mdash; ' + esc(route.title) + '</h3>';
    route.stages.forEach(function (st, i) {
      var spct = Math.min(100, Math.round(st.n / t.count * 100));
      html += '<div class="route-stage"><b>Stage ' + (i + 1) + ' &mdash; ' + esc(st.label) + '</b> ' +
        '<span class="rs-n">' + fmtNum(st.n) + ' / ' + fmtNum(t.count) + ' (' + spct + '%)</span><br>' +
        esc(st.tip) + '</div>';
    });
    html += '<p class="hint">Stages run in order; counts add up to the trophy target. Sources are the trophy&rsquo;s own cited sources, listed below.</p></div>';
  }
  if (t.missable === 'possible') {
    html += '<div class="box warn"><h4>Possibly missable &mdash; read before Chapter 1 ends</h4>' +
      '<p>The first meditation, Lucia&rsquo;s on the balcony at Jason&rsquo;s house, disappears after Chapter 1, ' +
      'and no source has confirmed whether the trophy needs it. Do it, then make a manual save.</p></div>';
  } else if (t.missable === 'watch') {
    html += '<div class="box watch"><h4>Watch &mdash; temporary window</h4>' +
      '<p>This quest-giver can go temporarily unavailable at story beats. Start the line when it ' +
      'appears; every trophy quest-giver returns and stays available after the story.</p></div>';
  }
  if (d) {
    html += '<div class="box intel"><h4>Sources differ (' + esc(d.id) + ')</h4>' +
      '<p><b>Q:</b> ' + esc(d.q) + '</p>' +
      '<p><b>Version A:</b> ' + esc(d.a) + '</p>' +
      '<p><b>Version B:</b> ' + esc(d.b) + '</p>' +
      '<p><b>Our call:</b> ' + esc(d.call) + '</p></div>';
  }
  var srcs = (t.sources || []).map(sourceByNum).filter(function (s) { return !!s; });
  html += '<div class="d-sec"><h3>Sources for this guide (' + srcs.length + ')</h3><ol class="src-list">';
  srcs.forEach(function (s) {
    html += '<li><b>[' + s.n + '] ' + esc(s.site) + '</b> &mdash; ' + esc(s.title) +
      (s.url ? ' &mdash; <a href="' + esc(s.url) + '" target="_blank" rel="noopener">open source</a>' : '') +
      ' <span style="color:var(--ink-soft)">(' + esc(s.read) + ')</span></li>';
  });
  html += '</ol></div>';
  el.innerHTML = html;
  $all('.stepper button', el).forEach(function (b) {
    b.addEventListener('click', function () {
      var cur = save.counts[t.id] || 0;
      var next = Math.max(0, Math.min(t.count, cur + Number(b.getAttribute('data-step'))));
      save.counts[t.id] = next;
      if (next >= t.count) save.earned[t.id] = true;
      persist();
      paintAll();
    });
  });
}

function paintRail() {
  var next = TROPHIES.filter(function (t) { return !isEarned(t); }).sort(roadmapOrder).slice(0, 6);
  var nx = $('#nextup');
  if (!next.length) {
    nx.innerHTML = '<li>All 55 earned. Leonida Legend.</li>';
  } else {
    nx.innerHTML = next.map(function (t) {
      return '<li data-id="' + t.id + '"><b>' + (isMasked(t) ? 'Story Trophy #' + t.id : esc(t.name)) + '</b>' +
        '<small>' + esc(KIND_NAMES[t.kind] || t.kind) + ' &middot; ' + esc(t.grade) + ' &middot; ' +
        esc(phaseName(t.phase)) + (t.missable === 'possible' ? ' &middot; POSSIBLY MISSABLE' : '') + '</small></li>';
    }).join('');
    $all('li[data-id]', nx).forEach(function (li) {
      li.addEventListener('click', function () {
        save.selected = Number(li.getAttribute('data-id'));
        persist();
        paintList(); paintDetail(); paintRail();
      });
    });
  }
  var t = trophyById(save.selected) || TROPHIES[0];
  var srcs = t ? (t.sources || []).map(sourceByNum).filter(function (s) { return !!s; }) : [];
  $('#rail-sources').innerHTML = srcs.map(function (s) {
    return '<li><b>[' + s.n + '] ' + esc(s.site) + '</b> &mdash; ' + esc(s.title) + '</li>';
  }).join('') || '<li>No sources listed.</li>';
  var logged = TROPHIES.filter(function (x) { return x.count && x.countUnit !== '$' && countVal(x) > 0; })
    .sort(function (a, b) { return (countVal(b) / b.count) - (countVal(a) / a.count); })
    .slice(0, 8);
  var totalLogged = TROPHIES.filter(function (x) { return x.count && x.countUnit !== '$'; })
    .reduce(function (sum, x) { return sum + countVal(x); }, 0);
  $('#collectibles-mini').innerHTML =
    (logged.length ? logged.map(function (x) {
      return '<div class="mc-row"><span>' + esc(x.name) + '</span><b>' +
        fmtNum(countVal(x)) + '/' + fmtNum(x.count) + '</b></div>';
    }).join('') : '<div class="mc-row"><span>No counts logged yet</span><b>0</b></div>') +
    '<div class="mc-row"><span><b>Total counts logged</b></span><b>' + fmtNum(totalLogged) + '</b></div>';
}

function paintRoadmap() {
  var html = '';
  (META.roadmap || []).forEach(function (ph) {
    var inPhase = TROPHIES.filter(function (t) { return t.phase === ph.id; }).sort(roadmapOrder);
    var done = inPhase.filter(isEarned).length;
    var pct = inPhase.length ? Math.round(done / inPhase.length * 100) : 0;
    html += '<div class="phase-card"><div class="phase-head"><h3>' + esc(ph.name) + '</h3>' +
      '<span class="ph-meta">' + esc(ph.hours) + ' &middot; ' + done + '/' + inPhase.length +
      ' earned &middot; ' + pct + '%</span></div>' +
      '<div class="phase-body"><p>' + esc(ph.note) + '</p>' +
      '<div class="pbar"><div style="width:' + pct + '%"></div></div>' +
      '<ul class="mini-list">' + inPhase.map(function (t) {
        return '<li class="' + (isEarned(t) ? 'done' : '') + '"><b>' + t.id + '. ' +
          (isMasked(t) ? 'Story Trophy' : esc(t.name)) + '</b> <span style="color:var(--ink-soft)">(' +
          esc(t.grade) + (t.missable === 'possible' ? ', POSSIBLY MISSABLE' : '') +
          (t.count ? ', ' + fmtNum(t.count) + ' ' + esc(t.countUnit) : '') + ')</span></li>';
      }).join('') + '</ul></div></div>';
  });
  html += '<div class="setup-strip"><div><strong>Platinum math</strong> &mdash; ' +
    esc(String(META.hours_platinum || '')) + ' hours total on the fastest published roadmap ' +
    '(60&ndash;80 story, ~100 100%-sweep, ~10 cleanup). Slower reads run 250+ hours (see dispute D7). ' +
    'Difficulty 4/10; 1 playthrough; 0 online trophies.</div>' +
    '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">' +
    'Sources [1] PowerPyx, [3] GTABase, [6] sixshore</div></div>';
  $('#roadmap').innerHTML = html;
}

function paintMissables() {
  var pma = null;
  TROPHIES.forEach(function (t) { if (t.missable === 'possible') pma = t; });
  var watch = TROPHIES.filter(function (t) { return t.missable === 'watch'; }).sort(roadmapOrder);
  var unconf = TROPHIES.filter(isUnconfirmed).sort(roadmapOrder);
  var html = '';
  if (pma) {
    var d = pma.dispute ? disputeById(pma.dispute) : null;
    html += '<div class="phase-card"><div class="phase-head"><h3>The one missable &mdash; ' +
      esc(pma.name) + '</h3><span class="ph-meta">' + esc(pma.grade) + ' &middot; ' +
      (pma.count ? fmtNum(pma.count) + ' ' + esc(pma.countUnit) : '') + '</span></div>' +
      '<div class="phase-body"><p>' + esc(pma.guide) + '</p>' +
      '<ol class="steps">' + (pma.steps || []).map(function (s) {
        return '<li>' + esc(s.t) + ' ' + citeMarks(s.s) + '</li>';
      }).join('') + '</ol>';
    if (d) {
      html += '<div class="box warn"><h4>Dispute ' + esc(d.id) + ' &mdash; ' + esc(d.q) + '</h4>' +
        '<p><b>Version A:</b> ' + esc(d.a) + '</p>' +
        '<p><b>Version B:</b> ' + esc(d.b) + '</p>' +
        '<p><b>Our call:</b> ' + esc(d.call) + '</p></div>';
    }
    html += '</div></div>';
  }
  html += '<div class="phase-card"><div class="phase-head"><h3>Risk register</h3>' +
    '<span class="ph-meta">1 possibly missable &middot; 5 watch &middot; 3 unconfirmed</span></div>' +
    '<div class="phase-body"><table class="reg"><tr><th>Trophy</th><th>Risk</th><th>Window / fix</th></tr>';
  if (pma) {
    html += '<tr><td><b>' + esc(pma.name) + '</b></td>' +
      '<td><b>POSSIBLY MISSABLE</b> &mdash; Chapter 1 balcony meditation gone after the chapter</td>' +
      '<td>Do it in Chapter 1; manual save right after</td></tr>';
  }
  watch.forEach(function (t) {
    html += '<tr><td><b>' + esc(t.name) + '</b></td>' +
      '<td>WATCH &mdash; quest-giver temporarily unavailable at story beats</td>' +
      '<td>Start the line when it appears; all return after the story [1]</td></tr>';
  });
  unconf.forEach(function (t) {
    html += '<tr><td><b>' + esc(t.name) + '</b></td>' +
      '<td>UNCONFIRMED &mdash; unlock method not settled across sources</td>' +
      '<td>Follow the cited method; see ' + esc(t.dispute || '') + ' in Sources &amp; Disputes</td></tr>';
  });
  html += '<tr><td><b>Everything else</b></td>' +
    '<td>Safe &mdash; free-roam after the story; nothing else can be missed</td>' +
    '<td>PowerPyx, GTABase, Mobalytics [1][3][14]</td></tr>' +
    '</table></div></div>';
  html += '<div class="setup-strip"><div><strong>Also worth knowing (no trophy impact):</strong> ' +
    'optional missions can expire, some vendors go away, and a few story buildings close later &mdash; ' +
    'none of it locks the platinum. The only trophy with a real deadline is Positive Mental Attitude.</div>' +
    '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">' +
    'Source [1] PowerPyx</div></div>';
  $('#missables').innerHTML = html;
}

function citedBy(n) {
  var count = 0;
  TROPHIES.forEach(function (t) {
    if ((t.sources || []).indexOf(n) !== -1) count++;
  });
  return count;
}
function paintSources() {
  var rows = SOURCES.map(function (s) {
    return '<tr><td class="num"><b>[' + s.n + ']</b></td>' +
      '<td><b>' + esc(s.site) + '</b><br><span style="color:var(--ink-soft)">' + esc(s.title) + '</span></td>' +
      '<td>' + esc(s.read) + '</td>' +
      '<td class="num">' + citedBy(s.n) + ' / 55</td>' +
      '<td style="font-size:12px">' + esc(s.note || '') + '</td></tr>';
  }).join('');
  var disputes = DISPUTES.map(function (d) {
    return '<div class="dispute"><h3>' + esc(d.id) + ' &mdash; ' + esc(d.q) + '</h3>' +
      '<div class="vs"><div><b>Version A</b>' + esc(d.a) + '</div>' +
      '<div><b>Version B</b>' + esc(d.b) + '</div></div>' +
      '<div class="call"><b>Our call:</b> ' + esc(d.call) + '</div></div>';
  }).join('');
  $('#sources').innerHTML =
    '<div class="setup-strip"><div><strong>Method</strong> &mdash; ' + esc(METHOD_NOTE) + '</div>' +
    '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">' +
    'A claim seen in two or more sources is marked 2+ (green cites). Links open only when the reader follows them; the app itself fetches nothing.</div></div>' +
    '<div class="phase-card"><div class="phase-head"><h3>Source matrix</h3>' +
    '<span class="ph-meta">' + SOURCES.length + ' sources &middot; ' + audit().steps + ' cited steps</span></div>' +
    '<div class="phase-body"><table class="reg"><tr><th>#</th><th>Source</th><th>Read</th><th>Cited by</th><th>What it supplied</th></tr>' +
    rows + '</table></div></div>' +
    '<div class="phase-card"><div class="phase-head"><h3>Disputes register &mdash; both versions, our call</h3>' +
    '<span class="ph-meta">' + DISPUTES.length + ' disputes</span></div>' +
    '<div class="phase-body">' + disputes + '</div></div>';
}

var COUNT_LABELS = {
  activities: 'Activity types', animals_study: 'Animals to study', animals_total: 'Animals in total',
  bank_vaults: 'Large bank vaults', challenges: 'Challenges in total', challenges_100: 'Challenges for 100%',
  collectible_card_sets: 'Collectible card sets', gang_operations: 'Gang operations',
  gangs: 'Gangs', garages_buy: 'Garages to buy', garages_total: 'Garages in total',
  meditations: 'Meditations', meditation_spots: 'Meditation spots',
  races_unique: 'Unique races', shooting_challenges: 'Shooting challenges',
  shooting_ranges: 'Shooting ranges', stunts: 'Stunts in total', stunts_100: 'Stunts for 100%',
  target_decks: 'Target Decks', top_fun_locations: 'Top Fun locations', top_fun_races: 'Top Fun races',
  vehicles_total: 'Vehicles in total', vehicles_100: 'Vehicles to scan for 100%',
  vehicles_base: 'Base-model vehicles', waink_landmarks: 'WAiNK landmarks',
  waink_curiosities: 'WAiNK curiosities', waink_sculptures: 'WAiNK sculptures'
};
function paintChecklist() {
  var c = META.counts || {};
  var keys = Object.keys(c).sort();
  var rows = keys.map(function (k) {
    return '<tr><td><b>' + esc(COUNT_LABELS[k] || k) + '</b></td>' +
      '<td class="num"><b>' + fmtNum(c[k]) + '</b></td></tr>';
  }).join('');
  var groups = {};
  TROPHIES.slice().sort(roadmapOrder).forEach(function (t) {
    var g = KIND_NAMES[t.kind] || t.kind;
    if (!groups[g]) groups[g] = [];
    groups[g].push(t);
  });
  var lists = Object.keys(groups).map(function (g) {
    return '<h3 style="margin-top:10px">' + esc(g) + ' (' + groups[g].length + ')</h3>' +
      '<ul class="mini-list">' + groups[g].map(function (t) {
        return '<li class="' + (isEarned(t) ? 'done' : '') + '"><label style="cursor:pointer">' +
          '<input type="checkbox" data-check="' + t.id + '"' + (isEarned(t) ? ' checked' : '') + '> ' +
          '<b>' + t.id + '. ' + (isMasked(t) ? 'Story Trophy' : esc(t.name)) + '</b></label></li>';
      }).join('') + '</ul>';
  }).join('');
  $('#checklist').innerHTML =
    '<div class="setup-strip"><div><strong>A Long Road (gold) &mdash; the 100% checklist</strong> &mdash; ' +
    esc(META.note_100 || '') + ' The checklist opens after the story under Progress &gt; Stats &gt; ' +
    '100% Completion; progress made during the story already counts, and nothing on it is missable.</div>' +
    '<div style="font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink-soft);margin-top:4px">' +
    'Sources [1] PowerPyx, [4] Insider Gaming, [11] GTA Vice City Hub</div></div>' +
    '<div class="phase-card"><div class="phase-head"><h3>Completion totals the game tracks</h3>' +
    '<span class="ph-meta">' + keys.length + ' lines</span></div>' +
    '<div class="phase-body"><table class="reg"><tr><th>Line</th><th>Target</th></tr>' + rows + '</table></div></div>' +
    '<div class="phase-card"><div class="phase-head"><h3>Every trophy, one checklist</h3>' +
    '<span class="ph-meta">' + audit().earned + '/55 earned</span></div>' +
    '<div class="phase-body">' + lists + '</div></div>';
  $all('input[data-check]', $('#checklist')).forEach(function (box) {
    box.addEventListener('change', function () {
      var id = Number(box.getAttribute('data-check'));
      if (box.checked) save.earned[id] = true; else delete save.earned[id];
      persist();
      paintAll();
    });
  });
}

function parseHash() {
  var raw = (location.hash || '#/tracker').replace(/^#\/?/, '');
  var parts = raw.split('/');
  var tab = TABS.indexOf(parts[0]) !== -1 ? parts[0] : 'tracker';
  var id = parts[1] ? Number(parts[1]) : null;
  return { tab: tab, id: id };
}
function paintTab() {
  var h = parseHash();
  save.tab = h.tab;
  if (h.id && trophyById(h.id)) save.selected = h.id;
  $all('.tabs button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === h.tab);
  });
  TABS.forEach(function (t) {
    $('#tab-' + t).hidden = (t !== h.tab);
  });
  if (h.tab === 'roadmap') paintRoadmap();
  if (h.tab === 'missables') paintMissables();
  if (h.tab === 'sources') paintSources();
  if (h.tab === 'checklist') paintChecklist();
}

function exportSave() {
  var blob = new Blob([JSON.stringify({
    earned: Object.keys(save.earned).map(Number), counts: save.counts,
    exported: new Date().toISOString()
  }, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leonida-field-manual-progress.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
function importSave(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (Array.isArray(data.earned)) {
        save.earned = {};
        data.earned.forEach(function (id) { if (trophyById(id)) save.earned[id] = true; });
      }
      if (data.counts && typeof data.counts === 'object') save.counts = data.counts;
      persist();
      paintAll();
    } catch (e) {
      alert('That file is not a valid progress export.');
    }
  };
  reader.readAsText(file);
}

function paintAll() {
  paintAudit(); paintProgress(); paintList(); paintDetail(); paintRail(); paintTab();
}

function wireControls() {
  $('#btn-spoiler').addEventListener('click', function () {
    save.spoiler = !save.spoiler;
    persist();
    paintAll();
  });
  $('#btn-export').addEventListener('click', exportSave);
  $('#file-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importSave(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Reset all progress and counts?')) return;
    save.earned = {}; save.counts = {};
    persist();
    paintAll();
  });
  $('#q').addEventListener('input', function (e) {
    filter.q = e.target.value.trim();
    paintList();
  });
  $('#f-kind').addEventListener('change', function (e) { filter.kind = e.target.value; paintList(); });
  $('#f-grade').addEventListener('change', function (e) { filter.grade = e.target.value; paintList(); });
  $('#f-hide-earned').addEventListener('change', function (e) { filter.hideEarned = e.target.checked; paintList(); });
  $all('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      location.hash = '#/' + b.getAttribute('data-tab');
    });
  });
  window.addEventListener('hashchange', paintTab);
}

function boot() {
  Promise.all([
    fetch('data/trophies.json').then(function (r) { return r.json(); }),
    fetch('data/sources.json').then(function (r) { return r.json(); }),
    fetch('data/routes.json').then(function (r) { return r.json(); }).catch(function () { return { routes: [] }; })
  ]).then(function (docs) {
    TROPHIES = docs[0].trophies || [];
    META = docs[0].meta || {};
    SOURCES = docs[1].sources || [];
    DISPUTES = docs[1].disputes || [];
    METHOD_NOTE = docs[1].method_note || '';
    READ_DATE = docs[1].read_date || '';
    ROUTES = docs[2].routes || [];
    if (new URLSearchParams(location.search).has('demo')) seedDemo();
    if (!save.selected || !trophyById(save.selected)) {
      var pma = null;
      TROPHIES.forEach(function (t) { if (t.missable === 'possible') pma = t; });
      save.selected = pma ? pma.id : (TROPHIES[0] && TROPHIES[0].id);
    }
    var h = parseHash();
    if (h.id && trophyById(h.id)) save.selected = h.id;
    wireControls();
    paintAll();
  }).catch(function (err) {
    document.querySelector('main').innerHTML =
      '<div class="panel"><p class="empty">The guide data did not load. Serve app/ from a static ' +
      'server (for example: <span class="mono">python3 -m http.server</span> inside app/) and reload.</p></div>';
    if (window.console) console.error(err);
  });
}
boot();
