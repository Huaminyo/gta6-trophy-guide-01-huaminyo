// The Leonida Field Manual — shared constants and pure helpers.
//
// This module knows nothing about the page or the reader's save: only
// lookup tables, formatting, and tiny DOM queries. Every other module
// builds on it, so the theme's numbers live in exactly one place.

// Where progress lives in this browser's localStorage.
export const SAVE_KEY = 'leonida-field-manual-v2';

// The five sections, in tab-bar order. Hash routes are #/<name>[/<trophy id>].
export const TABS = ['tracker', 'roadmap', 'missables', 'sources', 'checklist'];

// PlayStation trophy points, as PSN counts them.
export const GRADE_POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };

// Short labels for the kind filter and the detail meta line.
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

// Disputes whose unlock method is not settled across sources. A trophy that
// carries one of these is flagged UNCONFIRMED in the guide.
export const UNCONFIRMED_DISPUTES = new Set(['D3', 'D4', 'D5']);

// Roadmap order: phase first, then the official trophy number.
export const byRoadmap = (a, b) => (a.phase - b.phase) || (a.id - b.id);

// --- tiny DOM helpers ------------------------------------------------------

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Escape user-facing strings before they enter innerHTML. All guide text
// comes from our own files, but the habit keeps the page safe by default.
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- formatting ------------------------------------------------------------

export const fmtInt = (n) => Number(n).toLocaleString('en-US');

// A counter value: dollars get a $ prefix, everything else is a plain number.
export function fmtCounter(trophy, value) {
  return trophy.countUnit === '$' ? `$${fmtInt(value)}` : fmtInt(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 2026-11-20 -> 20 Nov 2026. Anything malformed passes through untouched.
export function fmtDate(iso) {
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]} ${MONTHS[Number(parts[1]) - 1]} ${parts[0]}`;
}
