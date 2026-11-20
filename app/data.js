// Data layer — loads the three JSON documents and answers every question the
// views ask about them. No DOM access in this file: it only knows the data.
//
//   data/trophies.json  { trophies: [...], meta: {...} }
//   data/sources.json  { sources: [...], disputes: [...], method_note, read_date }
//   data/routes.json   { routes: [...] }
//
// A trophy carries: id, name, description, grade (platinum/gold/silver/
// bronze), hidden (PSN-hidden until earned), kind, phase (roadmap 1-4),
// count/countUnit/countLabel (null when the trophy has no counter),
// missable ("none" | "watch" | "possible"), guide (our own words),
// sources (source numbers), dispute (dispute id or null), and steps
// ([{ t: text, s: [source numbers] }]).

export const GRADE_POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };

export const KIND_LABELS = {
  story: 'Story',
  side: 'Side',
  collectible: 'Collectible',
  activity: 'Activity',
  crime: 'Crime',
  feat: 'Feat',
  completion: 'Completion',
  platinum: 'Platinum',
};

// Disputes whose unlock method is not settled across sources; trophies that
// carry one of these are flagged UNCONFIRMED.
export const UNCONFIRMED_DISPUTES = new Set(['D3', 'D4', 'D5']);

export const TABS = ['tracker', 'roadmap', 'missables', 'sources', 'checklist'];

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

export async function loadDatabase() {
  const [trophiesDoc, sourcesDoc, routesDoc] = await Promise.all([
    fetchJson('data/trophies.json', { trophies: [], meta: {} }),
    fetchJson('data/sources.json', { sources: [], disputes: [] }),
    fetchJson('data/routes.json', { routes: [] }),
  ]);
  return {
    trophies: trophiesDoc.trophies ?? [],
    meta: trophiesDoc.meta ?? {},
    sources: sourcesDoc.sources ?? [],
    disputes: sourcesDoc.disputes ?? [],
    methodNote: sourcesDoc.method_note ?? '',
    readDate: sourcesDoc.read_date ?? '',
    routes: routesDoc.routes ?? [],
  };
}

// --- lookups ---------------------------------------------------------------

export const roadmapOrder = (a, b) => (a.phase - b.phase) || (a.id - b.id);

export const trophyById = (db, id) => db.trophies.find((t) => t.id === id) ?? null;

export const disputeById = (db, id) => db.disputes.find((d) => d.id === id) ?? null;

export const sourceByNum = (db, n) => db.sources.find((s) => s.n === n) ?? null;

export const routeFor = (db, trophy) =>
  db.routes.find((r) => r.count === trophy.count && r.unit === trophy.countUnit) ?? null;

export const phaseName = (db, id) =>
  (db.meta.roadmap ?? []).find((p) => p.id === id)?.name ?? `Phase ${id}`;

export const isUnconfirmed = (trophy) => UNCONFIRMED_DISPUTES.has(trophy.dispute ?? '');

export const possiblyMissable = (db) =>
  db.trophies.find((t) => t.missable === 'possible') ?? null;

// --- audit math ------------------------------------------------------------
// Every number the audit strip shows is computed here from the data, so the
// numbers on screen can never drift from the numbers in the files.

export function auditStats(db, earnedIds) {
  let steps = 0;
  let cited = 0;
  let backedByTwo = 0;
  for (const trophy of db.trophies) {
    for (const step of trophy.steps ?? []) {
      steps += 1;
      if (step.s?.length) cited += 1;
      if ((step.s?.length ?? 0) >= 2) backedByTwo += 1;
    }
  }
  const has = (predicate) => db.trophies.filter(predicate).length;
  return {
    total: db.trophies.length,
    guides: has((t) => (t.guide ?? '').trim() !== ''),
    steps,
    cited,
    backedByTwo,
    sources: db.sources.length,
    disputes: db.disputes.length,
    missable: has((t) => t.missable === 'possible'),
    watch: has((t) => t.missable === 'watch'),
    unconfirmed: has(isUnconfirmed),
    trackers: has((t) => Boolean(t.count)),
    hidden: has((t) => t.hidden),
    earned: earnedIds.size,
  };
}

export function pointsEarned(db, earnedIds) {
  return db.trophies.reduce(
    (sum, t) => sum + (earnedIds.has(t.id) ? (GRADE_POINTS[t.grade] ?? 0) : 0),
    0,
  );
}

export function totalPoints(db) {
  return db.trophies.reduce((sum, t) => sum + (GRADE_POINTS[t.grade] ?? 0), 0);
}

// --- formatting ------------------------------------------------------------

export const fmtNum = (n) => n.toLocaleString('en-US');

export function fmtCount(trophy, value) {
  return trophy.countUnit === '$' ? `$${fmtNum(value)}` : fmtNum(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso) {
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]} ${MONTHS[Number(parts[1]) - 1]} ${parts[0]}`;
}
