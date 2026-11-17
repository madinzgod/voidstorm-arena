// Wave design: which hostiles arrive, in what mix, and where they materialise.
// Early waves teach one enemy at a time; later waves blend the whole roster.
// Every fifth wave is a VOID WARDEN boss with a small escort trickle.

import { ARENA_WIDTH, ARENA_HEIGHT, ENEMY_TUNING, SPAWN_INTERVAL_SECONDS, waveSpawnBudget } from './config.js';
import { spawnEnemy } from './entities.js';

const UNLOCK_ORDER = [
  { type: 'drifter', fromWave: 1, weight: 10 },
  { type: 'weaver', fromWave: 2, weight: 6 },
  { type: 'stinger', fromWave: 3, weight: 5 },
  { type: 'bulwark', fromWave: 4, weight: 3 },
];

export function isBossWave(waveNumber) {
  return waveNumber % 5 === 0;
}

export function buildWaveQueue(rng, waveNumber) {
  if (isBossWave(waveNumber)) {
    const queue = ['warden'];
    const escorts = Math.min(6, 2 + Math.floor(waveNumber / 5));
    for (let i = 0; i < escorts; i++) queue.push(i % 2 === 0 ? 'drifter' : 'weaver');
    return queue;
  }
  let budget = waveSpawnBudget(waveNumber);
  const queue = [];
  const unlocked = UNLOCK_ORDER.filter((entry) => waveNumber >= entry.fromWave);
  while (budget > 0) {
    const affordable = unlocked.filter((entry) => ENEMY_TUNING[entry.type].budgetCost <= budget);
    if (affordable.length === 0) break;
    const totalWeight = affordable.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * totalWeight;
    let picked = affordable[affordable.length - 1];
    for (const entry of affordable) {
      roll -= entry.weight;
      if (roll <= 0) {
        picked = entry;
        break;
      }
    }
    queue.push(picked.type);
    budget -= ENEMY_TUNING[picked.type].budgetCost;
  }
  return shuffleQueue(rng, queue);
}

function shuffleQueue(rng, queue) {
  const result = [...queue];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickSpawnPoint(rng, player) {
  const inset = 46;
  for (let attempt = 0; attempt < 8; attempt++) {
    const edge = Math.floor(rng() * 4);
    let x;
    let y;
    if (edge === 0) { x = inset + rng() * (ARENA_WIDTH - inset * 2); y = inset; }
    else if (edge === 1) { x = inset + rng() * (ARENA_WIDTH - inset * 2); y = ARENA_HEIGHT - inset; }
    else if (edge === 2) { x = inset; y = inset + rng() * (ARENA_HEIGHT - inset * 2); }
    else { x = ARENA_WIDTH - inset; y = inset + rng() * (ARENA_HEIGHT - inset * 2); }
    if (Math.hypot(player.x - x, player.y - y) > 270) return { x, y };
  }
  return { x: ARENA_WIDTH - player.x > ARENA_WIDTH / 2 ? ARENA_WIDTH - inset : inset, y: inset };
}

export class WaveSpawner {
  constructor(queue) {
    this.queue = [...queue];
    this.spawnTimer = 0.4;
  }

  get remainingToSpawn() {
    return this.queue.length;
  }

  isDrained() {
    return this.queue.length === 0;
  }

  update(state, dt) {
    if (this.queue.length === 0) return;
    if (state.enemies.length >= 15) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = SPAWN_INTERVAL_SECONDS * (0.7 + state.rng() * 0.6);
    const type = this.queue.shift();
    if (type === 'warden') {
      spawnEnemy(state, 'warden', ARENA_WIDTH / 2, 130);
      return;
    }
    const point = pickSpawnPoint(state.rng, state.player);
    spawnEnemy(state, type, point.x, point.y);
  }
}
