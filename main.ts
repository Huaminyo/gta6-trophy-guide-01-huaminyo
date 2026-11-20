// The Leonida Field Manual — hand-in program (Node 22, stdlib only, sync fs).
//
// It assembles the entry's output directory:
//   app/          the guide itself, plain static files. Any static server can
//                 serve it with app/ as its root; the page fetches nothing
//                 but its own data files.
//   screenshots/  four real browser renders of the guide (the first, by name,
//                 is the cover).
//   dossier.json  the kit's buildDossier summary, written from the copied
//                 files by vendor/makefun-frontend.ts (vendored, untouched).
//
// Local run:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The scorer's limits ride along into buildDossier, so an oversized entry
// fails here, loudly, instead of at the gate: at most four screenshots of
// at most 256 KiB each, at most 993 files and 48 MiB under app/, dossier
// text capped at 160 KiB. Two runs must produce identical bytes.
import {
  cpSync, existsSync, mkdirSync, readdirSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const REPO = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countVisible(dir) {
  return readdirSync(dir).filter((name) => !name.startsWith('.')).length;
}

mkdirSync(OUT, { recursive: true });
cpSync(join(REPO, 'app'), join(OUT, 'app'), { recursive: true });

let shotCount = 0;
const shotsDir = join(REPO, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(OUT, 'screenshots'), { recursive: true });
  shotCount = countVisible(join(OUT, 'screenshots'));
}

const dossier = buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
const dossierPath = join(OUT, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log(`dossier.json written (${shotCount} screenshots) -> ${dossierPath}`);
