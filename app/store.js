// The Leonida Field Manual — the manual itself.
//
// One object owns the whole model: the three JSON documents it fetches from
// its own folder, plus the reader's save (earned trophies, counters, spoiler
// shield, selection). Views read from it; the entry point mutates it through
// the small methods below and re-paints. Nothing here touches the DOM.
//
//   data/trophies.json  { rebuild, trophies: [...], meta: {...} }
//   data/sources.json  { rebuild, sources: [...], disputes: [...],
//                        method_note, read_date }
//   data/routes.json   { rebuild, routes: [...] }
//
// A trophy carries: id, name, description, grade (platinum/gold/silver/
// bronze), hidden (PSN-hidden until earned), kind, phase (roadmap 1-4),
// count/countUnit/countLabel (null when the trophy has no counter),
// missable ("none" | "watch" | "possible"), guide (our own words),
// sources (source numbers), dispute (dispute id or null), and steps
// ([{ t: text, s: [source numbers] }]).
import { GRADE_POINTS, SAVE_KEY, UNCONFIRMED_DISPUTES, byRoadmap } from './lib.js';

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function freshSave() {
  return { earned: {}, counts: {}, spoiler: true, selected: null, tab: 'tracker' };
}

export class Manual {
  constructor() {
    this.trophies = [];
    this.meta = {};
    this.sources = [];
    this.disputes = [];
    this.methodNote = '';
    this.readDate = '';
    this.routes = [];
    this.save = freshSave();
    this.filters = { q: '', kind: '', grade: '', hideEarned: false };
  }

  // Load the three documents in parallel, then restore the reader's save.
  static async open() {
    const manual = new Manual();
    const [trophiesDoc, sourcesDoc, routesDoc] = await Promise.all([
      fetchJson('data/trophies.json', { trophies: [], meta: {} }),
      fetchJson('data/sources.json', { sources: [], disputes: [] }),
      fetchJson('data/routes.json', { routes: [] }),
    ]);
    manual.trophies = trophiesDoc.trophies ?? [];
    manual.meta = trophiesDoc.meta ?? {};
    manual.sources = sourcesDoc.sources ?? [];
    manual.disputes = sourcesDoc.disputes ?? [];
    manual.methodNote = sourcesDoc.method_note ?? '';
    manual.readDate = sourcesDoc.read_date ?? '';
    manual.routes = routesDoc.routes ?? [];
    manual.restore();
    return manual;
  }

  // --- lookups -------------------------------------------------------------

  trophy(id) {
    return this.trophies.find((t) => t.id === id) ?? null;
  }

  dispute(id) {
    return this.disputes.find((d) => d.id === id) ?? null;
  }

  source(n) {
    return this.sources.find((s) => s.n === n) ?? null;
  }

  // The ordered stage plan for a count trophy, matched on target + unit.
  routeFor(trophy) {
    return this.routes.find(
      (r) => r.count === trophy.count && r.unit === trophy.countUnit,
    ) ?? null;
  }

  phaseName(id) {
    return (this.meta.roadmap ?? []).find((p) => p.id === id)?.name ?? `Phase ${id}`;
  }

  // The one possibly-missable trophy, if the data names one.
  get missableOne() {
    return this.trophies.find((t) => t.missable === 'possible') ?? null;
  }

  get selected() {
    return this.trophy(this.save.selected) ?? this.trophies[0] ?? null;
  }

  // --- audit math ----------------------------------------------------------
  // Every number the audit strip shows is computed here from the data, so
  // the numbers on screen can never drift from the numbers in the files.

  audit() {
    let steps = 0;
    let cited = 0;
    let backed = 0;
    for (const trophy of this.trophies) {
      for (const step of trophy.steps ?? []) {
        steps += 1;
        if (step.s?.length) cited += 1;
        if ((step.s?.length ?? 0) >= 2) backed += 1;
      }
    }
    const count = (test) => this.trophies.filter(test).length;
    return {
      total: this.trophies.length,
      guides: count((t) => (t.guide ?? '').trim() !== ''),
      steps,
      cited,
      backed,
      sources: this.sources.length,
      disputes: this.disputes.length,
      missable: count((t) => t.missable === 'possible'),
      watch: count((t) => t.missable === 'watch'),
      unconfirmed: count((t) => UNCONFIRMED_DISPUTES.has(t.dispute ?? '')),
      trackers: count((t) => Boolean(t.count)),
      hidden: count((t) => t.hidden),
    };
  }

  points() {
    let earned = 0;
    let total = 0;
    for (const trophy of this.trophies) {
      const value = GRADE_POINTS[trophy.grade] ?? 0;
      total += value;
      if (this.save.earned[trophy.id]) earned += value;
    }
    return { earned, total };
  }

  // --- save state ----------------------------------------------------------

  restore() {
    const save = freshSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        this.save = save;
        return;
      }
      const stored = JSON.parse(raw);
      save.earned = stored.earned ?? {};
      save.counts = stored.counts ?? {};
      save.spoiler = stored.spoiler !== false;
      save.selected = stored.selected ?? null;
      save.tab = stored.tab ?? 'tracker';
    } catch {
      // Corrupt or unreadable storage: start clean, the guide still works.
    }
    this.save = save;
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        earned: this.save.earned,
        counts: this.save.counts,
        spoiler: this.save.spoiler,
        selected: this.save.selected,
        tab: this.save.tab,
      }));
    } catch {
      // Storage full or blocked: the guide still works for this session.
    }
  }

  earnedCount() {
    return Object.keys(this.save.earned).length;
  }

  isEarned(trophy) {
    return Boolean(this.save.earned[trophy.id]);
  }

  setEarned(id, earned) {
    if (earned) this.save.earned[id] = true;
    else delete this.save.earned[id];
  }

  countOf(trophy) {
    if (!trophy.count) return 0;
    return Math.max(0, Math.min(trophy.count, this.save.counts[trophy.id] ?? 0));
  }

  addCount(trophy, delta) {
    const next = Math.max(0, Math.min(
      trophy.count,
      (this.save.counts[trophy.id] ?? 0) + delta,
    ));
    this.save.counts[trophy.id] = next;
    if (next >= trophy.count) this.save.earned[trophy.id] = true;
    return next;
  }

  // The spoiler shield masks story trophies the reader has not earned yet.
  isMasked(trophy) {
    return this.save.spoiler && trophy.kind === 'story' && !this.isEarned(trophy);
  }

  isUnconfirmed(trophy) {
    return UNCONFIRMED_DISPUTES.has(trophy.dispute ?? '');
  }

  // ?demo=1 seeds a believable mid-run state (18 earned, partial counters)
  // so the screenshots show a tracker in use. It only applies when no save
  // exists yet, and it never changes the guide itself. The possibly-missable
  // trophy stays unearned on purpose: the cover shows its warning live.
  seedDemo() {
    if (localStorage.getItem(SAVE_KEY)) return;
    const ordered = [...this.trophies].sort(byRoadmap);
    let earned = 0;
    for (const trophy of ordered) {
      if (earned >= 18) break;
      if (trophy.missable === 'possible') continue;
      this.save.earned[trophy.id] = true;
      earned += 1;
    }
    let partial = 0;
    for (const trophy of ordered) {
      if (partial >= 6) break;
      if (this.isEarned(trophy) || !trophy.count) continue;
      this.save.counts[trophy.id] = Math.max(1, Math.floor(trophy.count * 0.55));
      partial += 1;
    }
    const pma = this.missableOne;
    if (pma?.count) this.save.counts[pma.id] = Math.floor(pma.count / 3);
    this.save.selected = pma ? pma.id : ordered[0].id;
    this.persist();
  }

  ensureSelection() {
    if (!this.save.selected || !this.trophy(this.save.selected)) {
      const pma = this.missableOne;
      this.save.selected = pma ? pma.id : (this.trophies[0]?.id ?? null);
    }
  }
}
