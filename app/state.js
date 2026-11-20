// State layer — the reader's progress (earned trophies, counters, spoiler
// shield, selection) plus the list filters. Progress lives in this browser's
// localStorage and is never uploaded anywhere.
import { possiblyMissable, roadmapOrder } from './data.js';

export const SAVE_KEY = 'leonida-field-manual-v2';

function freshSave() {
  return { earned: {}, counts: {}, spoiler: true, selected: null, tab: 'tracker' };
}

export function loadSave() {
  const save = freshSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return save;
    const stored = JSON.parse(raw);
    save.earned = stored.earned ?? {};
    save.counts = stored.counts ?? {};
    save.spoiler = stored.spoiler !== false;
    save.selected = stored.selected ?? null;
    save.tab = stored.tab ?? 'tracker';
  } catch {
    // Corrupt or unreadable storage: start clean, the guide still works.
  }
  return save;
}

export function persistSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      earned: save.earned,
      counts: save.counts,
      spoiler: save.spoiler,
      selected: save.selected,
      tab: save.tab,
    }));
  } catch {
    // Storage full or blocked: the guide still works for this session.
  }
}

export function createFilters() {
  return { q: '', kind: '', grade: '', hideEarned: false };
}

export const earnedIds = (save) => new Set(Object.keys(save.earned).map(Number));

export const isEarned = (save, trophy) => Boolean(save.earned[trophy.id]);

export function countOf(save, trophy) {
  if (!trophy.count) return 0;
  return Math.max(0, Math.min(trophy.count, save.counts[trophy.id] ?? 0));
}

// The spoiler shield masks story trophies the reader has not earned yet.
export const isMasked = (save, trophy) =>
  save.spoiler && trophy.kind === 'story' && !isEarned(save, trophy);

export function markEarned(save, id, earned) {
  if (earned) save.earned[id] = true;
  else delete save.earned[id];
}

export function bumpCount(save, trophy, delta) {
  const next = Math.max(0, Math.min(trophy.count, (save.counts[trophy.id] ?? 0) + delta));
  save.counts[trophy.id] = next;
  if (next >= trophy.count) save.earned[trophy.id] = true;
  return next;
}

// ?demo=1 seeds a believable mid-run state (18 earned, partial counters) so
// the screenshots show a tracker in use. It only applies when no save exists
// yet, and it never changes the guide itself. The possibly-missable trophy
// stays unearned on purpose: the cover shows its warning live.
export function seedDemo(db, save) {
  if (localStorage.getItem(SAVE_KEY)) return;
  const ordered = [...db.trophies].sort(roadmapOrder);
  let earned = 0;
  for (const trophy of ordered) {
    if (earned >= 18) break;
    if (trophy.missable === 'possible') continue;
    save.earned[trophy.id] = true;
    earned += 1;
  }
  let partial = 0;
  for (const trophy of ordered) {
    if (partial >= 6) break;
    if (isEarned(save, trophy) || !trophy.count) continue;
    save.counts[trophy.id] = Math.max(1, Math.floor(trophy.count * 0.55));
    partial += 1;
  }
  const pma = possiblyMissable(db);
  if (pma?.count) save.counts[pma.id] = Math.floor(pma.count / 3);
  save.selected = pma ? pma.id : ordered[0].id;
  persistSave(save);
}

export function defaultSelection(db, save) {
  const pma = possiblyMissable(db);
  save.selected = pma ? pma.id : (db.trophies[0]?.id ?? null);
}
