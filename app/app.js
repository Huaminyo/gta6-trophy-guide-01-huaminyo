// The Leonida Field Manual — entry point.
//
// Boots the Manual, paints the page, and routes every interaction through
// three delegated listeners on the document (click, change, input) plus the
// hash router. Nothing is wired per-element: painters rebuild their HTML
// freely and the listeners keep working, because they match on ids,
// data attributes, and ancestry instead of stored nodes.
import { $, $$, TABS } from './lib.js';
import { Manual } from './store.js';
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
} from './views.js';

let manual = null;

// --- painting --------------------------------------------------------------

function paintChrome() {
  paintAudit(manual);
  paintProgress(manual);
}

function paintTracker() {
  paintList(manual);
  paintDetail(manual);
  paintRail(manual);
}

function paintAll() {
  paintChrome();
  paintTracker();
  paintTab();
}

// --- hash routing ----------------------------------------------------------

function readHash() {
  const raw = (location.hash || '#/tracker').replace(/^#\/?/, '');
  const [tab, idPart] = raw.split('/');
  return {
    tab: TABS.includes(tab) ? tab : 'tracker',
    id: idPart ? Number(idPart) : null,
  };
}

function paintTab() {
  const { tab, id } = readHash();
  manual.save.tab = tab;
  if (id && manual.trophy(id)) manual.save.selected = id;
  for (const button of $$('.tabs button')) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
  for (const name of TABS) {
    $(`#tab-${name}`).hidden = name !== tab;
  }
  if (tab === 'roadmap') paintRoadmap(manual);
  if (tab === 'missables') paintMissables(manual);
  if (tab === 'sources') paintSources(manual);
  if (tab === 'checklist') paintChecklist(manual);
}

// --- progress export / import ----------------------------------------------

function exportProgress() {
  const payload = {
    earned: Object.keys(manual.save.earned).map(Number),
    counts: manual.save.counts,
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
        manual.save.earned = {};
        for (const id of data.earned) {
          if (manual.trophy(id)) manual.save.earned[id] = true;
        }
      }
      if (data.counts && typeof data.counts === 'object') manual.save.counts = data.counts;
      manual.persist();
      paintAll();
    } catch {
      alert('That file is not a valid progress export.');
    }
  };
  reader.readAsText(file);
}

// --- delegated interaction -------------------------------------------------
// One listener per event type, matched against the live DOM. The order
// inside each handler matters: the most specific match wins first.

function onClick(event) {
  const target = event.target;

  const tabButton = target.closest('.tabs button');
  if (tabButton) {
    location.hash = `#/${tabButton.dataset.tab}`;
    return;
  }

  if (target.closest('#btn-spoiler')) {
    manual.save.spoiler = !manual.save.spoiler;
    manual.persist();
    paintAll();
    return;
  }
  if (target.closest('#btn-export')) {
    exportProgress();
    return;
  }
  if (target.closest('#btn-reset')) {
    if (!confirm('Reset all progress and counts?')) return;
    manual.save.earned = {};
    manual.save.counts = {};
    manual.persist();
    paintAll();
    return;
  }

  if (target.closest('#reveal-btn')) {
    manual.save.spoiler = false;
    manual.persist();
    paintAll();
    return;
  }

  const stepButton = target.closest('.stepper button[data-step]');
  if (stepButton) {
    const trophy = manual.selected;
    if (trophy) {
      manual.addCount(trophy, Number(stepButton.dataset.step));
      manual.persist();
      paintAll();
    }
    return;
  }

  // A click on a row's checkbox is handled by the change listener below.
  if (target.tagName === 'INPUT') return;

  const row = target.closest('li[data-id]');
  if (row) {
    manual.save.selected = Number(row.dataset.id);
    manual.persist();
    paintTracker();
  }
}

function onChange(event) {
  const target = event.target;

  if (target.id === 'file-import') {
    if (target.files[0]) importProgress(target.files[0]);
    target.value = '';
    return;
  }
  if (target.id === 'f-kind') {
    manual.filters.kind = target.value;
    paintList(manual);
    return;
  }
  if (target.id === 'f-grade') {
    manual.filters.grade = target.value;
    paintList(manual);
    return;
  }
  if (target.id === 'f-hide-earned') {
    manual.filters.hideEarned = target.checked;
    paintList(manual);
    return;
  }

  const check = target.closest('input[data-check]');
  if (check) {
    manual.setEarned(Number(check.dataset.check), check.checked);
    manual.persist();
    paintAll();
    return;
  }

  const row = target.closest('#trophy-list li[data-id]');
  if (row && target.tagName === 'INPUT') {
    manual.setEarned(Number(row.dataset.id), target.checked);
    manual.persist();
    paintAll();
  }
}

function onInput(event) {
  if (event.target.id === 'q') {
    manual.filters.q = event.target.value.trim();
    paintList(manual);
  }
}

// --- boot ------------------------------------------------------------------

async function boot() {
  try {
    manual = await Manual.open();
    if (new URLSearchParams(location.search).has('demo')) manual.seedDemo();
    manual.ensureSelection();
    const { id } = readHash();
    if (id && manual.trophy(id)) manual.save.selected = id;

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    window.addEventListener('hashchange', paintTab);

    paintAll();
  } catch (error) {
    document.querySelector('main').innerHTML = '<div class="panel"><p class="empty">The guide data did not load. '
      + 'Serve app/ from a static server (for example: <span class="mono">python3 -m http.server</span> inside app/) and reload.</p></div>';
    if (window.console) console.error(error);
  }
}

boot();
