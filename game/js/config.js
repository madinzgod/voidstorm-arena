// VOIDSTORM tuning: every number that shapes how a run feels lives here — arena
// size, the pilot's ship, weapon cadence, each hostile's temperament and the
// wave budget curve — so the other modules read as behaviour, not constants.

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 800;

export const PALETTE = {
  voidFill: '#05050f',
  gridLine: 'rgba(64, 120, 255, 0.07)',
  playerHull: '#29f4ff',
  playerCore: '#eaffff',
  bullet: '#aefcff',
  overdriveBullet: '#ffe95e',
  drifter: '#ff3d7e',
  weaver: '#ff9f2e',
  stinger: '#3dffc8',
  lancer: '#4da3ff',
  bulwark: '#b46bff',
  warden: '#ff3860',
  wardenCore: '#ffd166',
  repair: '#4dff88',
  overdrive: '#ffe95e',
  hostileBullet: '#ff5e7a',
  textBright: '#eafcff',
  textDim: 'rgba(174, 226, 255, 0.62)',
};

export const PLAYER_TUNING = {
  radius: 13,
  maxHull: 100,
  thrust: 1750,
  damping: 4.2,
  maxSpeed: 335,
  fireIntervalSeconds: 0.135,
  bulletSpeed: 780,
  bulletDamage: 1,
  dashSpeed: 980,
  dashSeconds: 0.18,
  dashCooldownSeconds: 2.0,
  hurtInvulnerabilitySeconds: 0.6,
};

export const OVERDRIVE_SECONDS = 8;
export const OVERDRIVE_FIRE_DIVISOR = 2.1;
export const REPAIR_AMOUNT = 26;

export const COMBO_WINDOW_SECONDS = 3.5;
export const COMBO_KILLS_PER_STEP = 7;
export const COMBO_MAX_MULTIPLIER = 8;

export const ENEMY_TUNING = {
  drifter: { radius: 15, hull: 3, speed: 64, contactDamage: 10, score: 50, budgetCost: 1 },
  weaver: { radius: 13, hull: 4, speed: 92, contactDamage: 12, score: 80, budgetCost: 2 },
  stinger: { radius: 11, hull: 3, speed: 74, contactDamage: 14, score: 100, budgetCost: 2 },
  lancer: { radius: 12, hull: 5, speed: 118, contactDamage: 10, score: 120, budgetCost: 2 },
  bulwark: { radius: 30, hull: 16, speed: 31, contactDamage: 20, score: 200, budgetCost: 4 },
  warden: { radius: 47, hull: 240, speed: 26, contactDamage: 26, score: 5000, budgetCost: 0 },
};

export const FINAL_WAVE = 10;
export const BOSS_WAVES = [5, 10];
export const WAVE_BONUS_PER_WAVE = 150;
export const SPAWN_INTERVAL_SECONDS = 0.75;
export const MATERIALIZE_SECONDS = 0.55;

export function waveSpawnBudget(waveNumber) {
  return 5 + waveNumber * 2;
}

export function wardenHullForWave(waveNumber) {
  return ENEMY_TUNING.warden.hull + (waveNumber - BOSS_WAVES[0]) * 55;
}
