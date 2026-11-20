// The Leonida Field Manual — entry program (Node 22, standard library only).
//
// The guide itself is app/: plain static files (index.html, style.css, app.js,
// data/trophies.json, data/sources.json) that any static server can serve with
// app/ at its root; it fetches nothing over the network. screenshots/ holds 3
// or 4 real browser renders of the guide (the first by name is the cover).
//
// This program hands the entry in: it copies app/ and screenshots/ from beside
// this file into the output directory and writes /output/dossier.json with the
// kit's buildDossier library (vendor/makefun-frontend.ts, unchanged). Outside
// the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the guide locally while building it:
//
//   node --experimental-strip-types serve.ts   (or any static server on app/)
//
// The scorer's caps are passed to buildDossier so a bad entry fails here,
// loudly, instead of at the gate: at most 4 screenshots of at most 256 KiB,
// at most 993 files and 48 MiB under app/, dossier text capped at 160 KiB.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
console.log(`dossier written to ${join(out, 'dossier.json')}`);
