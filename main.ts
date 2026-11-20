// The Leonida Field Manual — entry program (Node 22, standard library only).
//
// What it hands in:
//   app/         the guide itself — static files (index.html, style.css,
//                app.js, data/*.json). Any static server can serve it with
//                app/ at its root; it fetches nothing over the network.
//   screenshots/ 3 or 4 real browser renders of the guide; the first by name
//                is the cover.
//   dossier.json written by the kit's buildDossier library from the copied
//                files (vendor/makefun-frontend.ts, unchanged).
//
// Run it locally:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The scorer's caps are passed to buildDossier so a bad entry fails here,
// loudly, instead of at the gate: at most 4 screenshots of at most 256 KiB
// each, at most 993 files and 48 MiB under app/, dossier text capped at
// 160 KiB. Both grader runs must write identical bytes.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(repoRoot, 'app'), join(outDir, 'app'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
console.log(`dossier written to ${join(outDir, 'dossier.json')} (${shots.length} screenshots)`);
