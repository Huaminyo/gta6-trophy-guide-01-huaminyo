// The Leonida Field Manual — entry point.
// Loads the data, builds the view context, wires the static controls, and
// paints. The guide itself is static files only: it fetches its own three
// JSON documents and nothing else, so it works with the network off.
import { TABS, loadDatabase, trophyById } from './data.js';
import {
  bumpCount,
  createFilters,
  defaultSelection,
  loadSave,
  markEarned,
  persistSave,
  seedDemo,
} from './state.js';
import {
  paintAudit,
  paintChecklist,
  paintDetail,
  paintList,
  paintMissables,
  paintProgress,
  paintRail,
  paintRoadmap,
  paintSources,
} from './render.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let ctx = null;

function paintAll() {
  paintAudit(ctx);
  paintProgress(ctx);
  paintList(ctx);
  paintDetail(ctx);
  paintRail(ctx);
  paintTab();
}

function paintTracker() {
  paintList(ctx);
  paintDetail(ctx);
  paintRail(ctx);
}

function parseHash() {
  const raw = (location.hash || '#/tracker').replace(/^#\/?/, '');
  const [tab, idPart] = raw.split('/');
  return {
    tab: TABS.includes(tab) ? tab : 'tracker',
    id: idPart ? Number(idPart) : null,
  };
}

function paintTab() {
  const { tab, id } = parseHash();
  ctx.save.tab = tab;
  if (id && trophyById(ctx.db, id)) ctx.save.selected = id;
  for (const button of $$('.tabs button')) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
  for (const name of TABS) {
    $(`#tab-${name}`).hidden = name !== tab;
  }
  if (tab === 'roadmap') paintRoadmap(ctx);
  if (tab === 'missables') paintMissables(ctx);
  if (tab === 'sources') paintSources(ctx);
  if (tab === 'checklist') paintChecklist(ctx);
}

function exportProgress() {
  const payload = {
    earned: Object.keys(ctx.save.earned).map(Number),
    counts: ctx.save.counts,
    exported: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'leonida-field-manual-progress.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.earned)) {
        ctx.save.earned = {};
        for (const id of data.earned) {
          if (trophyById(ctx.db, id)) ctx.save.earned[id] = true;
        }
      }
      if (data.counts && typeof data.counts === 'object') ctx.save.counts = data.counts;
      persistSave(ctx.save);
      paintAll();
    } catch {
      alert('That file is not a valid progress export.');
    }
  };
  reader.readAsText(file);
}

function wireControls() {
  $('#btn-spoiler').addEventListener('click', () => {
    ctx.save.spoiler = !ctx.save.spoiler;
    persistSave(ctx.save);
    paintAll();
  });
  $('#btn-export').addEventListener('click', exportProgress);
  $('#file-import').addEventListener('change', (event) => {
    if (event.target.files[0]) importProgress(event.target.files[0]);
    event.target.value = '';
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Reset all progress and counts?')) return;
    ctx.save.earned = {};
    ctx.save.counts = {};
    persistSave(ctx.save);
    paintAll();
  });
  $('#q').addEventListener('input', (event) => {
    ctx.filters.q = event.target.value.trim();
    paintList(ctx);
  });
  $('#f-kind').addEventListener('change', (event) => {
    ctx.filters.kind = event.target.value;
    paintList(ctx);
  });
  $('#f-grade').addEventListener('change', (event) => {
    ctx.filters.grade = event.target.value;
    paintList(ctx);
  });
  $('#f-hide-earned').addEventListener('change', (event) => {
    ctx.filters.hideEarned = event.target.checked;
    paintList(ctx);
  });
  for (const button of $$('.tabs button')) {
    button.addEventListener('click', () => {
      location.hash = `#/${button.dataset.tab}`;
    });
  }
  window.addEventListener('hashchange', paintTab);
}

async function boot() {
  try {
    const db = await loadDatabase();
    const save = loadSave();
    const filters = createFilters();
    const hooks = {
      select(id) {
        save.selected = id;
        persistSave(save);
        paintTracker();
      },
      toggleEarned(id, earned) {
        markEarned(save, id, earned);
        persistSave(save);
        paintAll();
      },
      reveal() {
        save.spoiler = false;
        persistSave(save);
        paintAll();
      },
      bump(trophy, delta) {
        bumpCount(save, trophy, delta);
        persistSave(save);
        paintAll();
      },
      repaintAll: paintAll,
      repaintTracker: paintTracker,
    };
    ctx = { db, save, filters, hooks };

    if (new URLSearchParams(location.search).has('demo')) seedDemo(db, save);
    if (!save.selected || !trophyById(db, save.selected)) defaultSelection(db, save);
    const { id } = parseHash();
    if (id && trophyById(db, id)) save.selected = id;
    wireControls();
    paintAll();
  } catch (error) {
    document.querySelector('main').innerHTML = '<div class="panel"><p class="empty">The guide data did not load. '
      + 'Serve app/ from a static server (for example: <span class="mono">python3 -m http.server</span> inside app/) and reload.</p></div>';
    if (window.console) console.error(error);
  }
}

boot();
