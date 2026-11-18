// Everything that flies in the arena: the pilot's ship, both sides' bullets,
// the six hostile types (including the VOID WARDEN boss and its bullet
// patterns) and the pickups they drop. Factories, per-frame updates, contact
// and bullet collisions, and the canvas drawing for each kind.

import {
  ARENA_WIDTH, ARENA_HEIGHT, PALETTE, PLAYER_TUNING, ENEMY_TUNING,
  OVERDRIVE_SECONDS, OVERDRIVE_FIRE_DIVISOR, REPAIR_AMOUNT, MATERIALIZE_SECONDS,
} from './config.js';

const TAU = Math.PI * 2;

export function createPlayer() {
  return {
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER_TUNING.radius,
    hull: PLAYER_TUNING.maxHull,
    maxHull: PLAYER_TUNING.maxHull,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerableTimer: 0,
    overdriveTimer: 0,
    thrusting: false,
    dead: false,
  };
}

export function resetPlayer(player) {
  const fresh = createPlayer();
  Object.assign(player, fresh);
}

export function spawnPlayerBullet(state, x, y, angle, overdrive, damage = PLAYER_TUNING.bulletDamage) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * PLAYER_TUNING.bulletSpeed,
    vy: Math.sin(angle) * PLAYER_TUNING.bulletSpeed,
    radius: 3.2,
    damage,
    life: 0.95,
    overdrive,
  });
}

export function spawnHostileBullet(state, x, y, angle, speed, damage) {
  state.hostileBullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 5,
    damage,
    life: 4.5,
  });
}

export function updatePlayer(state, dt) {
  const player = state.player;
  const input = state.input;
  const fx = state.effects;
  if (player.dead) return;

  const move = state.autopilot ? state.autopilotMove : input.movementVector();
  player.thrusting = move.x !== 0 || move.y !== 0;
  player.vx += move.x * PLAYER_TUNING.thrust * state.speedScale * dt;
  player.vy += move.y * PLAYER_TUNING.thrust * state.speedScale * dt;
  const dampingFactor = Math.max(0, 1 - PLAYER_TUNING.damping * dt);
  player.vx *= dampingFactor;
  player.vy *= dampingFactor;
  const speed = Math.hypot(player.vx, player.vy);
  const maxSpeed = PLAYER_TUNING.maxSpeed * state.speedScale;
  if (speed > maxSpeed) {
    player.vx = (player.vx / speed) * maxSpeed;
    player.vy = (player.vy / speed) * maxSpeed;
  }

  const aimX = state.autopilot ? state.autopilotAim.x : input.mouseX;
  const aimY = state.autopilot ? state.autopilotAim.y : input.mouseY;
  player.angle = Math.atan2(aimY - player.y, aimX - player.x);

  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnerableTimer = Math.max(0, player.invulnerableTimer - dt);
  player.overdriveTimer = Math.max(0, player.overdriveTimer - dt);
  player.fireTimer -= dt;

  const dashRequested = !state.autopilot &&
    ((input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) || input.rightMouseDown);
  if (dashRequested && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    const dashAngle = player.thrusting ? Math.atan2(player.vy, player.vx) : player.angle;
    player.vx = Math.cos(dashAngle) * PLAYER_TUNING.dashSpeed;
    player.vy = Math.sin(dashAngle) * PLAYER_TUNING.dashSpeed;
    player.dashTimer = PLAYER_TUNING.dashSeconds;
    player.dashCooldown = PLAYER_TUNING.dashCooldownSeconds * state.dashCooldownScale;
    player.invulnerableTimer = Math.max(player.invulnerableTimer, PLAYER_TUNING.dashSeconds + 0.08);
    state.sound.playDash();
  }
  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    fx.spawnDashTrail(player.x, player.y, PALETTE.playerHull);
  }

  player.x = clamp(player.x + player.vx * dt, player.radius, ARENA_WIDTH - player.radius);
  player.y = clamp(player.y + player.vy * dt, player.radius, ARENA_HEIGHT - player.radius);

  const wantsFire = state.autopilot ? state.autopilotFire : (input.mouseDown || input.isDown('Space'));
  if (wantsFire && player.fireTimer <= 0) {
    firePlayerWeapon(state);
    const baseInterval = PLAYER_TUNING.fireIntervalSeconds;
    const cadence = player.overdriveTimer > 0 ? baseInterval / OVERDRIVE_FIRE_DIVISOR : baseInterval;
    player.fireTimer = cadence * state.fireIntervalScale;
  }
}

function firePlayerWeapon(state) {
  const player = state.player;
  const noseX = player.x + Math.cos(player.angle) * (player.radius + 6);
  const noseY = player.y + Math.sin(player.angle) * (player.radius + 6);
  const overdrive = player.overdriveTimer > 0;
  const streams = Math.max(1, state.cannonStreams || 1);
  let fired = 0;
  for (let s = 0; s < streams; s++) {
    const streamAngle = player.angle + (s - (streams - 1) / 2) * 0.085;
    spawnPlayerBullet(state, noseX, noseY, streamAngle, overdrive, state.bulletDamage);
    fired += 1;
    if (overdrive) {
      spawnPlayerBullet(state, noseX, noseY, streamAngle - 0.11, overdrive, state.bulletDamage);
      spawnPlayerBullet(state, noseX, noseY, streamAngle + 0.11, overdrive, state.bulletDamage);
      fired += 2;
    }
  }
  state.effects.spawnMuzzleFlash(noseX, noseY, player.angle, overdrive ? PALETTE.overdriveBullet : PALETTE.bullet);
  state.stats.shotsFired += fired;
  state.sound.playShoot();
}

export function updateBullets(state, dt) {
  updateBulletList(state.bullets, dt);
  updateBulletList(state.hostileBullets, dt);
}

function updateBulletList(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -30 || b.x > ARENA_WIDTH + 30 || b.y < -30 || b.y > ARENA_HEIGHT + 30) {
      list.splice(i, 1);
    }
  }
}

export function spawnEnemy(state, type, x, y) {
  const tuning = ENEMY_TUNING[type];
  const enemy = {
    type,
    x, y,
    vx: 0, vy: 0,
    radius: tuning.radius,
    hp: tuning.hull,
    maxHp: tuning.hull,
    angle: 0,
    age: 0,
    phase: state.rng() * TAU,
    flashTimer: 0,
    materializeTimer: MATERIALIZE_SECONDS,
    mode: 'stalk',
    modeTimer: 0,
    lungeAngle: 0,
    fireTimer: 1.2 + state.rng() * 0.8,
    ringTimer: 2.4,
    minionTimer: 5,
    spiralTimer: 0,
    spiralAngle: state.rng() * TAU,
    ringOffset: state.rng() * TAU,
    contactCooldown: 0,
  };
  if (type === 'warden') {
    enemy.hp = enemy.maxHp = state.wardenHull;
    enemy.materializeTimer = MATERIALIZE_SECONDS * 1.6;
  }
  enemy.materializeDuration = enemy.materializeTimer;
  state.enemies.push(enemy);
  return enemy;
}

export function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    enemy.age += dt;
    enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    if (enemy.materializeTimer > 0) {
      enemy.materializeTimer -= dt;
      continue;
    }
    const toPlayerX = player.x - enemy.x;
    const toPlayerY = player.y - enemy.y;
    const distance = Math.max(1, Math.hypot(toPlayerX, toPlayerY));
    const towardX = toPlayerX / distance;
    const towardY = toPlayerY / distance;
    const tuning = ENEMY_TUNING[enemy.type];

    switch (enemy.type) {
      case 'drifter':
        enemy.vx = towardX * tuning.speed;
        enemy.vy = towardY * tuning.speed;
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
        break;
      case 'weaver': {
        const strafe = Math.sin(enemy.age * 3.1 + enemy.phase);
        enemy.vx = (towardX + -towardY * strafe * 0.85) * tuning.speed;
        enemy.vy = (towardY + towardX * strafe * 0.85) * tuning.speed;
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
        break;
      }
      case 'stinger':
        updateStingerMovement(enemy, tuning, towardX, towardY, distance, dt);
        break;
      case 'lancer':
        updateLancerBehaviour(state, enemy, tuning, towardX, towardY, distance, dt);
        break;
      case 'bulwark':
        enemy.vx = towardX * tuning.speed;
        enemy.vy = towardY * tuning.speed;
        enemy.angle += dt * 0.5;
        break;
      case 'warden':
        updateWardenBehaviour(state, enemy, dt, distance);
        break;
    }
    // The warden and the lancer steer themselves inside their behaviours;
    // every other hostile simply follows the velocity its behaviour set.
    if (enemy.type !== 'warden' && enemy.type !== 'lancer') {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
    enemy.x = clamp(enemy.x, enemy.radius, ARENA_WIDTH - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, ARENA_HEIGHT - enemy.radius);
  }
}

function updateStingerMovement(enemy, tuning, towardX, towardY, distance, dt) {
  enemy.modeTimer -= dt;
  if (enemy.mode === 'stalk') {
    enemy.vx = towardX * tuning.speed;
    enemy.vy = towardY * tuning.speed;
    enemy.angle = Math.atan2(towardY, towardX);
    if (distance < 300 && enemy.modeTimer <= 0) {
      enemy.mode = 'windup';
      enemy.modeTimer = 0.45;
    }
  } else if (enemy.mode === 'windup') {
    enemy.vx *= 0.86;
    enemy.vy *= 0.86;
    enemy.angle = Math.atan2(towardY, towardX);
    if (enemy.modeTimer <= 0) {
      enemy.mode = 'lunge';
      enemy.modeTimer = 0.42;
      enemy.lungeAngle = Math.atan2(towardY, towardX);
    }
  } else {
    enemy.vx = Math.cos(enemy.lungeAngle) * 430;
    enemy.vy = Math.sin(enemy.lungeAngle) * 430;
    enemy.angle = enemy.lungeAngle;
    if (enemy.modeTimer <= 0) {
      enemy.mode = 'stalk';
      enemy.modeTimer = 0.9 + Math.random() * 0.7;
    }
  }
}

function updateLancerBehaviour(state, enemy, tuning, towardX, towardY, distance, dt) {
  // The lancer is the roster's only gunner besides the Warden: it holds a
  // sniping stand-off distance, strafes sideways while it lines up, and
  // fires single aimed bolts the pilot has to dodge or dash through.
  const standOff = 400;
  const radial = clamp((distance - standOff) / 160, -1, 1);
  const strafeDirection = enemy.phase > Math.PI ? 1 : -1;
  const weave = Math.sin(enemy.age * 1.7 + enemy.phase) * 0.45;
  enemy.vx = (towardX * radial + -towardY * strafeDirection * (0.55 + weave)) * tuning.speed;
  enemy.vy = (towardY * radial + towardX * strafeDirection * (0.55 + weave)) * tuning.speed;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.angle = Math.atan2(towardY, towardX);
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && distance < 640) {
    enemy.fireTimer = 2.3 + state.rng() * 0.5;
    spawnHostileBullet(state, enemy.x, enemy.y, Math.atan2(towardY, towardX), 305, 10);
    state.sound.playHostileShot();
  }
}

function updateWardenBehaviour(state, enemy, dt, distanceToPlayer) {
  const player = state.player;
  const hpFraction = enemy.hp / enemy.maxHp;
  const phase = hpFraction > 0.66 ? 1 : hpFraction > 0.33 ? 2 : 3;
  const orbitDirection = enemy.phase > Math.PI ? 1 : -1;
  const desiredDistance = 285;
  const toPlayerAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const radial = clamp((distanceToPlayer - desiredDistance) / 120, -1, 1);
  const speed = ENEMY_TUNING.warden.speed * (phase === 3 ? 1.7 : 1);
  enemy.vx = (Math.cos(toPlayerAngle) * radial + Math.cos(toPlayerAngle + Math.PI / 2) * orbitDirection * 0.8) * speed * 2.2;
  enemy.vy = (Math.sin(toPlayerAngle) * radial + Math.sin(toPlayerAngle + Math.PI / 2) * orbitDirection * 0.8) * speed * 2.2;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.angle += dt * (phase === 3 ? 0.9 : 0.55);

  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0) {
    enemy.fireTimer = phase === 1 ? 1.5 : phase === 2 ? 1.25 : 1.0;
    for (let i = -1; i <= 1; i++) {
      spawnHostileBullet(state, enemy.x, enemy.y, toPlayerAngle + i * 0.13, 235, 12);
    }
    state.sound.playEnemyHit();
  }
  if (phase >= 2) {
    enemy.ringTimer -= dt;
    if (enemy.ringTimer <= 0) {
      enemy.ringTimer = phase === 2 ? 2.9 : 2.3;
      enemy.ringOffset += 0.35;
      const count = 14;
      for (let i = 0; i < count; i++) {
        spawnHostileBullet(state, enemy.x, enemy.y, enemy.ringOffset + (i / count) * TAU, 168, 12);
      }
    }
  }
  if (phase === 3) {
    enemy.minionTimer -= dt;
    if (enemy.minionTimer <= 0) {
      enemy.minionTimer = 6;
      spawnEnemy(state, 'drifter', enemy.x - 60, enemy.y);
      spawnEnemy(state, 'drifter', enemy.x + 60, enemy.y);
    }
    // Final-phase signature: a twin-arm spiral barrage that sweeps the
    // arena and forces the pilot to keep moving through its gaps.
    enemy.spiralTimer -= dt;
    if (enemy.spiralTimer <= 0) {
      enemy.spiralTimer = 0.11;
      enemy.spiralAngle += 0.42;
      for (const arm of [0, Math.PI]) {
        spawnHostileBullet(state, enemy.x, enemy.y, enemy.spiralAngle + arm, 152, 10);
      }
    }
  }
}

export function collideBulletsWithEnemies(state) {
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const bullet = state.bullets[bi];
    let consumed = false;
    for (const enemy of state.enemies) {
      if (enemy.materializeTimer > 0 || enemy.hp <= 0) continue;
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const rr = enemy.radius + bullet.radius;
      if (dx * dx + dy * dy <= rr * rr) {
        consumed = true;
        state.stats.hits += 1;
        damageEnemy(state, enemy, bullet.damage, Math.atan2(bullet.vy, bullet.vx));
        break;
      }
    }
    if (consumed) state.bullets.splice(bi, 1);
  }
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (state.enemies[i].hp <= 0) state.enemies.splice(i, 1);
  }
}

export function damageEnemy(state, enemy, damage, hitAngle) {
  enemy.hp -= damage;
  enemy.flashTimer = 0.09;
  state.effects.spawnHitSparks(enemy.x, enemy.y, PALETTE[enemy.type], hitAngle);
  if (enemy.hp > 0) {
    state.sound.playEnemyHit();
    return;
  }
  killEnemy(state, enemy);
}

function killEnemy(state, enemy) {
  const tuning = ENEMY_TUNING[enemy.type];
  const isBoss = enemy.type === 'warden';
  const isBig = isBoss || enemy.type === 'bulwark';
  state.effects.spawnExplosion(enemy.x, enemy.y, PALETTE[enemy.type], isBoss ? 3 : isBig ? 1.7 : 1);
  state.effects.addShake(isBoss ? 15 : isBig ? 8 : 3.5);
  state.sound.playExplosion(isBig);
  state.stats.kills += 1;

  state.comboKills += 1;
  state.comboTimer = state.comboWindow;
  const earned = tuning.score * state.multiplier;
  state.score += earned;
  state.effects.addFloatingText(
    enemy.x, enemy.y - enemy.radius - 6,
    state.multiplier > 1 ? `+${earned} x${state.multiplier}` : `+${earned}`,
    PALETTE[enemy.type], isBoss ? 26 : 15,
  );

  if (enemy.type === 'bulwark') {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * TAU + state.rng() * 0.6;
      const child = spawnEnemy(state, 'drifter', enemy.x + Math.cos(angle) * 26, enemy.y + Math.sin(angle) * 26);
      child.materializeTimer = 0.25;
    }
  }
  if (isBoss) state.bossDefeated = true;

  const roll = state.rng();
  if (!isBoss && roll < 0.10) spawnPickup(state, enemy.x, enemy.y, 'repair');
  else if (!isBoss && roll < 0.18) spawnPickup(state, enemy.x, enemy.y, 'overdrive');
}

export function collideEnemiesWithPlayer(state, dt) {
  const player = state.player;
  if (player.dead) return;
  for (const enemy of state.enemies) {
    if (enemy.materializeTimer > 0 || enemy.hp <= 0 || enemy.contactCooldown > 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const rr = player.radius + enemy.radius - 2;
    if (dx * dx + dy * dy <= rr * rr) {
      enemy.contactCooldown = 0.8;
      const pushAngle = Math.atan2(dy, dx);
      enemy.x -= Math.cos(pushAngle) * 14;
      enemy.y -= Math.sin(pushAngle) * 14;
      damagePlayer(state, ENEMY_TUNING[enemy.type].contactDamage, pushAngle);
    }
  }
  for (let i = state.hostileBullets.length - 1; i >= 0; i--) {
    const bullet = state.hostileBullets[i];
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    const rr = player.radius + bullet.radius;
    if (dx * dx + dy * dy <= rr * rr) {
      state.hostileBullets.splice(i, 1);
      damagePlayer(state, bullet.damage, Math.atan2(bullet.vy, bullet.vx));
    }
  }
}

export function damagePlayer(state, amount, fromAngle) {
  const player = state.player;
  if (player.dead || player.invulnerableTimer > 0) return;
  player.hull -= amount;
  player.invulnerableTimer = PLAYER_TUNING.hurtInvulnerabilitySeconds;
  state.hurtFlashTimer = 0.25;
  state.comboKills = 0;
  state.effects.addShake(7);
  state.effects.spawnHitSparks(player.x, player.y, PALETTE.playerHull, fromAngle + Math.PI);
  state.sound.playPlayerHurt();
  if (player.hull <= 0) {
    player.hull = 0;
    player.dead = true;
    state.effects.spawnExplosion(player.x, player.y, PALETTE.playerHull, 2.6);
    state.effects.addShake(16);
    state.sound.playExplosion(true);
  }
}

export function spawnPickup(state, x, y, kind) {
  state.pickups.push({
    kind, x, y,
    vx: (state.rng() - 0.5) * 60,
    vy: (state.rng() - 0.5) * 60,
    age: 0,
    life: 9,
  });
}

export function updatePickups(state, dt) {
  const player = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    pickup.age += dt;
    pickup.life -= dt;
    if (pickup.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const distance = Math.hypot(dx, dy);
    if (!player.dead && distance < 110 * (state.magnetScale || 1)) {
      pickup.vx += (dx / Math.max(1, distance)) * 620 * dt;
      pickup.vy += (dy / Math.max(1, distance)) * 620 * dt;
    }
    pickup.vx *= Math.max(0, 1 - 2.4 * dt);
    pickup.vy *= Math.max(0, 1 - 2.4 * dt);
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (!player.dead && distance < player.radius + 17) {
      collectPickup(state, pickup);
      state.pickups.splice(i, 1);
    }
  }
}

function collectPickup(state, pickup) {
  const player = state.player;
  if (pickup.kind === 'repair') {
    player.hull = Math.min(player.maxHull, player.hull + REPAIR_AMOUNT);
    state.effects.addFloatingText(player.x, player.y - 30, `+${REPAIR_AMOUNT} HULL`, PALETTE.repair, 16);
  } else {
    player.overdriveTimer = OVERDRIVE_SECONDS;
    state.effects.addFloatingText(player.x, player.y - 30, 'OVERDRIVE!', PALETTE.overdrive, 18);
  }
  state.effects.spawnPickupGlow(pickup.x, pickup.y, PALETTE[pickup.kind]);
  state.sound.playPickup();
}

export function drawBullets(ctx, state) {
  for (const bullet of state.bullets) {
    ctx.save();
    ctx.shadowColor = bullet.overdrive ? PALETTE.overdriveBullet : PALETTE.bullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = bullet.overdrive ? PALETTE.overdriveBullet : PALETTE.bullet;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (const bullet of state.hostileBullets) {
    ctx.save();
    ctx.shadowColor = PALETTE.hostileBullet;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.hostileBullet;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe3ea';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPickups(ctx, state) {
  for (const pickup of state.pickups) {
    const pulse = 1 + Math.sin(pickup.age * 6) * 0.12;
    const blink = pickup.life < 2.5 ? (Math.sin(pickup.age * 18) > 0 ? 1 : 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(pickup.x, pickup.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = PALETTE[pickup.kind];
    ctx.shadowBlur = 14;
    ctx.strokeStyle = PALETTE[pickup.kind];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = PALETTE[pickup.kind];
    if (pickup.kind === 'repair') {
      ctx.fillRect(-2.5, -8, 5, 16);
      ctx.fillRect(-8, -2.5, 16, 5);
    } else {
      ctx.beginPath();
      ctx.moveTo(2, -9);
      ctx.lineTo(-5, 1);
      ctx.lineTo(0, 1);
      ctx.lineTo(-2, 9);
      ctx.lineTo(6, -2);
      ctx.lineTo(1, -2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawPlayer(ctx, state) {
  const player = state.player;
  if (player.dead) return;
  const blink = player.invulnerableTimer > 0 && player.dashTimer <= 0 && Math.sin(state.time * 34) > 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.globalAlpha = blink ? 0.35 : 1;
  if (player.thrusting) {
    const flame = 10 + Math.random() * 8;
    ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-11, -4.5);
    ctx.lineTo(-11 - flame, 0);
    ctx.lineTo(-11, 4.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowColor = PALETTE.playerHull;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#0b2b3a';
  ctx.strokeStyle = PALETTE.playerHull;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-13, -13);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-13, 13);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(3, 0, 3.6, 0, TAU);
  ctx.fill();
  if (player.overdriveTimer > 0) {
    ctx.strokeStyle = PALETTE.overdrive;
    ctx.globalAlpha = 0.7 + Math.sin(state.time * 10) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 6, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEnemies(ctx, state) {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.materializeTimer > 0) {
      const duration = enemy.materializeDuration || MATERIALIZE_SECONDS;
      const progress = Math.min(1, Math.max(0, 1 - enemy.materializeTimer / duration));
      ctx.globalAlpha = 0.25 + progress * 0.5;
      ctx.strokeStyle = PALETTE[enemy.type];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + (1 - progress) * 22, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.5, enemy.radius * progress), 0, TAU);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.rotate(enemy.angle);
    ctx.shadowColor = PALETTE[enemy.type];
    ctx.shadowBlur = 13;
    ctx.fillStyle = enemy.flashTimer > 0 ? '#ffffff' : 'rgba(10, 8, 24, 0.92)';
    ctx.strokeStyle = PALETTE[enemy.type];
    ctx.lineWidth = 2;
    drawEnemyShape(ctx, enemy);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawEnemyCore(ctx, enemy);
    ctx.restore();
    if (enemy.maxHp > 4 && enemy.hp < enemy.maxHp && enemy.type !== 'warden') {
      drawMiniHealthBar(ctx, enemy);
    }
  }
}

function drawEnemyShape(ctx, enemy) {
  const r = enemy.radius;
  ctx.beginPath();
  switch (enemy.type) {
    case 'drifter':
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r * 0.72);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.72);
      break;
    case 'weaver':
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.4, r * 0.85);
      ctx.lineTo(-r * 0.85, 0);
      ctx.lineTo(-r * 0.4, -r * 0.85);
      break;
    case 'stinger':
      ctx.moveTo(r * 1.25, 0);
      ctx.lineTo(-r, r * 0.55);
      ctx.lineTo(-r * 0.55, 0);
      ctx.lineTo(-r, -r * 0.55);
      break;
    case 'lancer':
      ctx.moveTo(r * 1.35, 0);
      ctx.lineTo(-r * 0.7, r * 0.62);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, -r * 0.62);
      break;
    case 'bulwark':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    case 'warden':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const rad = i % 2 === 0 ? r : r * 0.78;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      break;
  }
  ctx.closePath();
}

function drawEnemyCore(ctx, enemy) {
  const pulse = 0.75 + Math.sin(enemy.age * 5 + enemy.phase) * 0.25;
  ctx.fillStyle = PALETTE[enemy.type];
  ctx.globalAlpha = pulse;
  const coreRadius = enemy.type === 'warden' ? 13 : enemy.type === 'bulwark' ? 8 : enemy.type === 'lancer' ? 5 : 4.2;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (enemy.type === 'warden') {
    ctx.strokeStyle = PALETTE.wardenCore;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(enemy.age * 3) * 2.5, 0, TAU);
    ctx.stroke();
  }
  if (enemy.type === 'stinger' && enemy.mode === 'windup') {
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.5 + Math.sin(enemy.age * 40) * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 6, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawMiniHealthBar(ctx, enemy) {
  const width = enemy.radius * 1.7;
  const fraction = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 11, width, 3.5);
  ctx.fillStyle = PALETTE[enemy.type];
  ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 11, width * fraction, 3.5);
}

// A still portrait of one hostile, drawn with the very shape and core the
// arena uses, so the title screen's roster shows the real cast.
export function drawEnemyPortrait(ctx, type, x, y, radius) {
  const portrait = {
    type, radius, angle: -0.5, age: 2.2, phase: 1.1, flashTimer: 0, mode: 'stalk',
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(portrait.angle);
  ctx.shadowColor = PALETTE[type];
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(10, 8, 24, 0.92)';
  ctx.strokeStyle = PALETTE[type];
  ctx.lineWidth = 2;
  drawEnemyShape(ctx, portrait);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  drawEnemyCore(ctx, portrait);
  ctx.restore();
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
