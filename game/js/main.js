// VOIDSTORM — entry point and conductor. Owns the game state and its modes
// (title, playing, paused, game over, victory), the fixed-feel frame loop,
// wave flow, the between-wave upgrade draft, combo scoring, the pilot's death
// and restart, plus a deterministic screenshot mode
// (?shot=title|boss|upgrade|over&seed=N) the maker uses to pose real scenes
// for the entry's screenshots, flown by a small autopilot.

import { ARENA_WIDTH, ARENA_HEIGHT, COMBO_WINDOW_SECONDS, COMBO_KILLS_PER_STEP, COMBO_MAX_MULTIPLIER, FINAL_WAVE, WAVE_BONUS_PER_WAVE, wardenHullForWave } from './config.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { Starfield, Effects } from './effects.js';
import {
  createPlayer, resetPlayer, updatePlayer, updateBullets, updateEnemies,
  collideBulletsWithEnemies, collideEnemiesWithPlayer, updatePickups,
  drawPlayer, drawBullets, drawEnemies, drawPickups, spawnEnemy, spawnPickup,
} from './entities.js';
import { buildWaveQueue, WaveSpawner, isBossWave } from './waves.js';
import { rollUpgradeChoices, applyUpgrade, upgradeCardRect } from './upgrades.js';
import { drawHUD, drawWaveBanner, drawTitleScreen, drawPauseOverlay, drawGameOverScreen, drawVictoryScreen, drawUpgradeScreen } from './hud.js';

const BEST_SCORE_KEY = 'voidstorm-best-score';

function createSeededRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadBestScore() {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(value)));
  } catch {
    // Private modes may refuse storage; the best score then lasts the session.
  }
}

function createGameState(canvas, rng) {
  return {
    mode: 'title',
    modeTimer: 0,
    time: 0,
    rng,
    input: new Input(canvas),
    sound: new SoundEngine(),
    effects: new Effects(),
    starfield: new Starfield(rng),
    player: createPlayer(),
    bullets: [],
    hostileBullets: [],
    enemies: [],
    pickups: [],
    score: 0,
    best: loadBestScore(),
    newBest: false,
    comboKills: 0,
    comboTimer: 0,
    comboWindow: COMBO_WINDOW_SECONDS,
    multiplier: 1,
    wave: 0,
    wavePhase: 'intro',
    phaseTimer: 0,
    spawner: null,
    fireIntervalScale: 1,
    cannonStreams: 1,
    bulletDamage: 1,
    speedScale: 1,
    dashCooldownScale: 1,
    magnetScale: 1,
    upgradesTaken: [],
    upgradeChoices: null,
    upgradeHover: -1,
    wardenHull: 0,
    bossDefeated: false,
    lastWaveBonus: 0,
    endless: false,
    hurtFlashTimer: 0,
    deathTimer: 0,
    stats: { kills: 0, shotsFired: 0, hits: 0 },
    autopilot: false,
    autopilotMove: { x: 0, y: 0 },
    autopilotAim: { x: ARENA_WIDTH / 2, y: 0 },
    autopilotFire: false,
    shotMode: null,
  };
}

function startRun(state) {
  state.score = 0;
  state.newBest = false;
  state.comboKills = 0;
  state.comboTimer = 0;
  state.multiplier = 1;
  state.bullets.length = 0;
  state.hostileBullets.length = 0;
  state.enemies.length = 0;
  state.pickups.length = 0;
  state.effects.clear();
  state.stats = { kills: 0, shotsFired: 0, hits: 0 };
  state.endless = false;
  state.deathTimer = 0;
  state.hurtFlashTimer = 0;
  state.fireIntervalScale = 1;
  state.cannonStreams = 1;
  state.bulletDamage = 1;
  state.speedScale = 1;
  state.dashCooldownScale = 1;
  state.magnetScale = 1;
  state.upgradesTaken = [];
  state.upgradeChoices = null;
  state.upgradeHover = -1;
  resetPlayer(state.player);
  state.mode = 'playing';
  state.modeTimer = 0;
  state.sound.unlock();
  state.sound.startMusic();
  startWave(state, 1);
}

function startWave(state, waveNumber) {
  state.wave = waveNumber;
  state.wardenHull = wardenHullForWave(waveNumber);
  state.spawner = new WaveSpawner(buildWaveQueue(state.rng, waveNumber));
  state.wavePhase = 'intro';
  state.phaseTimer = 1.7;
  state.bossDefeated = false;
  if (isBossWave(waveNumber)) state.sound.playBossAlarm();
  else state.sound.playWaveStart();
}

function waveCleared(state) {
  const bonus = WAVE_BONUS_PER_WAVE * state.wave;
  state.score += bonus;
  state.lastWaveBonus = bonus;
  if (state.wave === FINAL_WAVE && !state.endless) {
    finishRun(state, 'victory');
    return;
  }
  if (state.shotMode) {
    // Posed scenes keep the old flow: no draft interrupts a screenshot.
    state.wavePhase = 'clear';
    state.phaseTimer = 2.2;
    return;
  }
  state.upgradeChoices = rollUpgradeChoices(state);
  state.upgradeHover = -1;
  state.wavePhase = 'upgrade';
}

function updateUpgradeChoice(state) {
  const input = state.input;
  state.upgradeHover = -1;
  (state.upgradeChoices || []).forEach((choice, index) => {
    const rect = upgradeCardRect(index);
    if (input.mouseX >= rect.x && input.mouseX <= rect.x + rect.width &&
        input.mouseY >= rect.y && input.mouseY <= rect.y + rect.height) {
      state.upgradeHover = index;
    }
  });
  let picked = -1;
  if (input.wasPressed('Digit1')) picked = 0;
  else if (input.wasPressed('Digit2')) picked = 1;
  else if (input.wasPressed('Digit3')) picked = 2;
  else if (input.clicked && state.upgradeHover >= 0) picked = state.upgradeHover;
  if (picked >= 0 && state.upgradeChoices && state.upgradeChoices[picked]) {
    applyUpgrade(state, state.upgradeChoices[picked]);
    state.upgradeChoices = null;
    state.wavePhase = 'clear';
    state.phaseTimer = 1.4;
    state.sound.playPickup();
  }
}

function finishRun(state, ending) {
  if (state.score > state.best) {
    state.best = state.score;
    state.newBest = true;
    saveBestScore(state.best);
  }
  state.mode = ending;
  state.modeTimer = 0;
  state.sound.stopMusic();
  if (ending === 'victory') state.sound.playVictory();
  if (ending === 'gameover') state.sound.playGameOver();
}

function computeAutopilot(state) {
  const player = state.player;
  let threat = null;
  let threatDistance = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.materializeTimer > 0) continue;
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < threatDistance) {
      threatDistance = d;
      threat = enemy;
    }
  }
  let moveX = (ARENA_WIDTH / 2 - player.x) * 0.0022;
  let moveY = (ARENA_HEIGHT / 2 - player.y) * 0.0022;
  if (threat) {
    const awayX = (player.x - threat.x) / Math.max(1, threatDistance);
    const awayY = (player.y - threat.y) / Math.max(1, threatDistance);
    const urgency = threatDistance < 240 ? 1 : 0.35;
    const strafe = Math.sin(state.time * 0.9) * 0.7;
    moveX += (awayX - awayY * strafe) * urgency;
    moveY += (awayY + awayX * strafe) * urgency;
    const lead = threatDistance / 780;
    state.autopilotAim.x = threat.x + threat.vx * lead;
    state.autopilotAim.y = threat.y + threat.vy * lead;
    state.autopilotFire = threatDistance < 580;
  } else {
    state.autopilotFire = false;
  }
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  state.autopilotMove.x = moveX;
  state.autopilotMove.y = moveY;
}

function updatePlaying(state, dt) {
  if (state.autopilot) computeAutopilot(state);
  updatePlayer(state, dt);
  updateBullets(state, dt);
  if (state.wavePhase === 'combat' && state.spawner) state.spawner.update(state, dt);
  updateEnemies(state, dt);
  collideBulletsWithEnemies(state);
  collideEnemiesWithPlayer(state, dt);
  updatePickups(state, dt);
  state.effects.update(dt);
  state.hurtFlashTimer = Math.max(0, state.hurtFlashTimer - dt);

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.comboKills = 0;
  }
  state.multiplier = 1 + Math.min(
    COMBO_MAX_MULTIPLIER - 1,
    Math.floor(state.comboKills / COMBO_KILLS_PER_STEP),
  );

  if (state.wavePhase === 'upgrade') updateUpgradeChoice(state);

  if (state.wavePhase === 'intro') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) state.wavePhase = 'combat';
  } else if (state.wavePhase === 'combat') {
    if (state.spawner && state.spawner.isDrained() && state.enemies.length === 0 && !state.player.dead) {
      waveCleared(state);
    }
  } else if (state.wavePhase === 'clear') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) startWave(state, state.wave + 1);
  }

  if (state.player.dead) {
    state.deathTimer += dt;
    if (state.deathTimer > 1.5) finishRun(state, 'gameover');
  }
}

function updateTitleDrift(state, dt) {
  for (const enemy of state.enemies) {
    const orbitRadius = enemy.orbitRadius;
    enemy.orbitAngle += dt * enemy.orbitSpeed;
    enemy.x = ARENA_WIDTH / 2 + Math.cos(enemy.orbitAngle) * orbitRadius;
    enemy.y = ARENA_HEIGHT / 2 + Math.sin(enemy.orbitAngle) * orbitRadius * 0.72;
    enemy.angle += dt * 0.8;
    enemy.age += dt;
  }
  state.effects.update(dt);
}

function update(state, dt) {
  state.time += dt;
  state.modeTimer += dt;
  const input = state.input;
  switch (state.mode) {
    case 'title':
      updateTitleDrift(state, dt);
      if (!state.shotMode && (input.clicked || input.wasPressed('Enter') || input.wasPressed('Space'))) {
        startRun(state);
      }
      break;
    case 'playing':
      updatePlaying(state, dt);
      if (!state.shotMode && (input.wasPressed('KeyP') || input.wasPressed('Escape'))) {
        state.mode = 'paused';
        state.modeTimer = 0;
        state.sound.stopMusic();
      }
      break;
    case 'paused':
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.clicked) {
        state.mode = 'playing';
        state.modeTimer = 0;
        state.sound.startMusic();
      }
      break;
    case 'gameover':
      state.effects.update(dt);
      if (state.modeTimer > 0.8 && (input.wasPressed('Enter') || input.wasPressed('KeyR') || input.clicked)) {
        startRun(state);
      }
      break;
    case 'victory':
      state.effects.update(dt);
      if (input.wasPressed('Enter')) {
        state.endless = true;
        state.mode = 'playing';
        state.modeTimer = 0;
        state.sound.startMusic();
        startWave(state, FINAL_WAVE + 1);
      } else if (input.wasPressed('KeyR')) {
        startRun(state);
      }
      break;
  }
  input.endFrame();
}

function render(state) {
  const canvas = state.canvas;
  const ctx = canvas.getContext('2d');
  state.starfield.draw(ctx, state.time);
  ctx.save();
  ctx.translate(state.effects.shakeX, state.effects.shakeY);
  drawPickups(ctx, state);
  drawEnemies(ctx, state);
  drawBullets(ctx, state);
  if (state.mode !== 'title') drawPlayer(ctx, state);
  state.effects.drawWorld(ctx);
  state.effects.drawText(ctx);
  ctx.restore();

  if (state.mode === 'title') {
    drawTitleScreen(ctx, state);
  } else {
    drawHUD(ctx, state);
    if (state.mode === 'playing') drawWaveBanner(ctx, state);
    if (state.mode === 'playing' && state.wavePhase === 'upgrade') drawUpgradeScreen(ctx, state);
    if (state.mode === 'paused') drawPauseOverlay(ctx, state);
    if (state.mode === 'gameover') drawGameOverScreen(ctx, state);
    if (state.mode === 'victory') drawVictoryScreen(ctx, state);
  }
}

function spawnDecorativeFleet(state) {
  const kinds = ['drifter', 'weaver', 'stinger', 'lancer', 'bulwark', 'drifter'];
  kinds.forEach((type, i) => {
    const enemy = spawnEnemy(state, type, 0, 0);
    enemy.materializeTimer = 0;
    enemy.orbitRadius = 190 + (i % 3) * 105;
    enemy.orbitAngle = (i / kinds.length) * Math.PI * 2;
    enemy.orbitSpeed = 0.14 + (i % 3) * 0.05;
  });
}

function setupShotScene(state, shot, seed) {
  state.shotMode = shot;
  if (shot === 'title') {
    spawnDecorativeFleet(state);
    return;
  }
  if (shot === 'over') {
    startRun(state);
    state.score = 18420;
    state.wave = 7;
    state.stats = { kills: 86, shotsFired: 640, hits: 402 };
    state.upgradesTaken = ['Rapid Cycler', 'Twin Cannons', 'Void Plating'];
    state.best = Math.max(state.best, 21300);
    state.newBest = false;
    state.player.dead = true;
    state.player.hull = 0;
    state.effects.spawnExplosion(state.player.x, state.player.y, '#29f4ff', 2.4);
    finishRun(state, 'gameover');
    state.modeTimer = 5;
    return;
  }
  if (shot === 'upgrade') {
    startRun(state);
    state.wave = 4;
    state.score = 6850;
    state.stats = { kills: 41, shotsFired: 388, hits: 246 };
    state.upgradesTaken = ['Rapid Cycler'];
    state.fireIntervalScale = 0.75;
    state.enemies.length = 0;
    state.hostileBullets.length = 0;
    if (state.spawner) state.spawner.queue.length = 0;
    state.player.x = ARENA_WIDTH / 2;
    state.player.y = 648;
    state.player.hull = 82;
    spawnPickup(state, 268, 268, 'repair');
    spawnPickup(state, 1012, 238, 'overdrive');
    state.upgradeChoices = rollUpgradeChoices(state);
    state.wavePhase = 'upgrade';
    state.sound.stopMusic();
    return;
  }
  state.autopilot = true;
  startRun(state);
  if (shot === 'boss') {
    startWave(state, 5);
    state.wavePhase = 'combat';
    state.spawner.queue = state.spawner.queue.filter((type) => type !== 'warden');
    const warden = spawnEnemy(state, 'warden', ARENA_WIDTH / 2, 205);
    warden.materializeTimer = 0;
    warden.hp = Math.floor(warden.maxHp * 0.55);
    const escortA = spawnEnemy(state, 'drifter', 300, 240);
    escortA.materializeTimer = 0;
    const escortB = spawnEnemy(state, 'weaver', 980, 300);
    escortB.materializeTimer = 0;
    state.player.x = ARENA_WIDTH / 2;
    state.player.y = 580;
    preRollSimulation(state, 3.6);
    state.player.hull = 64;
  } else {
    startWave(state, 3);
    state.wavePhase = 'combat';
    const placements = [
      ['drifter', 880, 210], ['drifter', 990, 330], ['weaver', 350, 190],
      ['weaver', 240, 420], ['stinger', 1040, 560], ['bulwark', 830, 620],
      ['drifter', 480, 120], ['weaver', 640, 300], ['drifter', 740, 470],
      ['stinger', 560, 660],
    ];
    for (const [type, x, y] of placements) {
      const enemy = spawnEnemy(state, type, x, y);
      enemy.materializeTimer = 0;
    }
    state.player.x = 430;
    state.player.y = 520;
    state.score = 2750;
    preRollSimulation(state, 3.4);
    state.player.hull = 76;
    state.player.invulnerableTimer = 0;
  }
  state.sound.stopMusic();
}

function preRollSimulation(state, seconds) {
  // The posed scene must never end in a wreck: the pilot is untouchable while
  // the simulation settles, then plays by the normal rules on camera.
  state.player.invulnerableTimer = seconds + 1;
  const step = 1 / 60;
  const steps = Math.floor(seconds / step);
  for (let i = 0; i < steps; i++) updatePlaying(state, step);
  state.player.invulnerableTimer = 0;
  state.effects.update(0.016);
}

function boot() {
  const canvas = document.getElementById('game-canvas');
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') ?? (shot ? 7 : (Date.now() % 2147483647)));
  const rng = createSeededRandom(seed);
  const state = createGameState(canvas, rng);
  state.canvas = canvas;
  if (shot) setupShotScene(state, shot, seed);
  else spawnDecorativeFleet(state);

  const unlockAudio = () => state.sound.unlock();
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', (event) => {
    unlockAudio();
    if (event.code === 'KeyM') state.sound.toggleMute();
  });

  window.__voidstorm = state;
  if (shot) window.__shotReady = true;

  let lastTimestamp = performance.now();
  function frame(timestamp) {
    // Schedule first: one bad frame must never stop the game. And clamp dt at
    // zero — a frame timestamp can predate the boot timestamp on the first
    // frame, which would otherwise run the simulation backwards for a tick.
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, Math.max(0, (timestamp - lastTimestamp) / 1000));
    lastTimestamp = timestamp;
    update(state, dt);
    render(state);
  }
  requestAnimationFrame(frame);
}

boot();
