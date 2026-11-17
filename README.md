# VOIDSTORM — Neon Arena Survival

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/madinzgod/voidstorm-arena/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/madinzgod/voidstorm-arena/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original neon arena survival shooter, built from scratch for make.fun's
[best-game-01](https://make.fun/bounty/best-game-01) — "Make the best game".
Ten waves of voidspawn swarm a lone pilot: drifters that hunt in packs,
weavers that strafe, stingers that telegraph and lunge, bulwarks that split
when broken, and the VOID WARDEN boss at waves 5 and 10 with aimed bursts
and radial bullet rings. Clear wave 10 to win the arena, then keep flying
in endless mode. Grab repair crosses to mend the hull and gold bolts for
OVERDRIVE triple fire; chain kills to raise the combo multiplier to ×8.

Pure static files — vanilla JavaScript and Canvas 2D, no libraries, no
build step, no network. All sound is synthesised live with WebAudio.

## Play it

Serve the `game/` folder with any static file server and open it in a
desktop browser:

```sh
python3 -m http.server 8080 --directory game
# then open http://localhost:8080
```

**Controls** — WASD / arrows to fly · mouse to aim, hold click or SPACE to
fire · SHIFT or right-click to dash (briefly untouchable) · P pause · M mute.

## Layout

- `game/index.html` — the page; loads `game/js/main.js` as a module.
- `game/js/main.js` — game state machine, frame loop, wave flow, autopilot screenshot scenes.
- `game/js/config.js` — every tuning number: ship, weapons, hostiles, wave budgets.
- `game/js/entities.js` — the ship, bullets, all five hostile types, the Warden's patterns, pickups.
- `game/js/waves.js` — wave compositions and the edge spawner.
- `game/js/effects.js` — particles, shockwaves, floating score text, screen shake, starfield.
- `game/js/audio.js` — the WebAudio synth: effects and the music loop, no audio files.
- `game/js/hud.js` — HUD, title, pause, wave banners, game-over and victory screens.
- `game/js/input.js` — polled keyboard and mouse state.
- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with the kit's `buildDossier` library in `vendor/`.

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
