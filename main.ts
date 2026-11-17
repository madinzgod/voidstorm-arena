// VOIDSTORM — hand-in program for make.fun's best-game-01 (Node 22, standard library only).
//
// The game itself is the static site in game/ (game/index.html plus its ES modules and
// stylesheet — no build step, no network). This program delivers it: it copies game/ and
// screenshots/ into the output directory and writes dossier.json there with the kit's
// buildDossier library, which the gate re-runs to check the dossier matches byte for byte.
//
// Inside the grader the output directory is /output; anywhere else, MAKEFUN_OUTPUT_DIR
// names it instead:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, mirrored so a bad hand-in fails here instead of at the scorer:
// at most 4 screenshots of 256 KiB each, at most 993 files and 48 MiB under game/,
// no path under game/ longer than 1000 bytes, dossier text capped at 160 KiB.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

function deliverGame(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(outputDir, DOSSIER_LIMITS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

deliverGame(outputDir);
