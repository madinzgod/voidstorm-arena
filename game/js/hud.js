// Every word the game shows: the in-flight HUD (hull, score, combo, wave,
// dash and boss bars) and the full screens — title, pause, wave banners,
// game over and victory. Drawn on the same canvas as the arena so a
// screenshot always shows the whole loop at a glance.

import { ARENA_WIDTH, ARENA_HEIGHT, PALETTE, PLAYER_TUNING, OVERDRIVE_SECONDS } from './config.js';

const FONT_STACK = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';

export function drawHUD(ctx, state) {
  const player = state.player;
  drawHullBar(ctx, player);
  drawScoreBlock(ctx, state);
  drawWaveBlock(ctx, state);
  drawDashIndicator(ctx, player);
  if (player.overdriveTimer > 0) drawOverdriveBar(ctx, player);
  const warden = state.enemies.find((enemy) => enemy.type === 'warden');
  if (warden) drawBossBar(ctx, warden);
  if (state.hurtFlashTimer > 0) {
    ctx.fillStyle = `rgba(255, 40, 70, ${0.22 * (state.hurtFlashTimer / 0.25)})`;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }
  if (player.hull <= 30 && !player.dead) {
    const pulse = 0.1 + 0.08 * Math.sin(state.time * 6);
    const gradient = ctx.createRadialGradient(
      ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_HEIGHT * 0.36,
      ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_HEIGHT * 0.78,
    );
    gradient.addColorStop(0, 'rgba(255, 30, 60, 0)');
    gradient.addColorStop(1, `rgba(255, 30, 60, ${pulse})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }
}

function drawHullBar(ctx, player) {
  const x = 22;
  const y = 20;
  const width = 264;
  const fraction = Math.max(0, player.hull / player.maxHull);
  ctx.textAlign = 'left';
  ctx.font = `700 12px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('HULL INTEGRITY', x, y - 6 + 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, x, y + 16, width, 13, 6);
  ctx.fill();
  const hullColor = fraction > 0.5 ? '#4dff88' : fraction > 0.28 ? '#ffd166' : '#ff3860';
  ctx.fillStyle = hullColor;
  if (fraction > 0) {
    roundRect(ctx, x, y + 16, Math.max(10, width * fraction), 13, 6);
    ctx.fill();
  }
  ctx.font = `700 12px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText(`${Math.ceil(player.hull)} / ${player.maxHull}`, x + width + 10, y + 27);
}

function drawScoreBlock(ctx, state) {
  ctx.textAlign = 'right';
  ctx.font = `700 12px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('SCORE', ARENA_WIDTH - 22, 26);
  ctx.font = `800 30px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText(formatScore(state.score), ARENA_WIDTH - 22, 58);
  ctx.font = `600 13px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`BEST ${formatScore(state.best)}`, ARENA_WIDTH - 22, 80);
  if (state.multiplier > 1) {
    const comboFraction = Math.max(0, state.comboTimer / state.comboWindow);
    ctx.font = `800 19px ${FONT_STACK}`;
    ctx.fillStyle = PALETTE.overdrive;
    ctx.fillText(`COMBO x${state.multiplier}`, ARENA_WIDTH - 22, 108);
    ctx.fillStyle = 'rgba(255, 233, 94, 0.3)';
    ctx.fillRect(ARENA_WIDTH - 22 - 92 * comboFraction, 114, 92 * comboFraction, 3);
  }
}

function drawWaveBlock(ctx, state) {
  ctx.textAlign = 'center';
  ctx.font = `700 12px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(state.endless && state.wave > 10 ? 'ENDLESS — WAVE' : 'WAVE', ARENA_WIDTH / 2, 26);
  ctx.font = `800 26px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText(String(state.wave), ARENA_WIDTH / 2, 56);
  const remaining = state.enemies.filter((enemy) => enemy.hp > 0).length +
    (state.spawner ? state.spawner.remainingToSpawn : 0);
  ctx.font = `600 12px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(remaining > 0 ? `${remaining} HOSTILES LEFT` : 'SECTOR CLEAR', ARENA_WIDTH / 2, 76);
}

function drawDashIndicator(ctx, player) {
  const x = 22;
  const y = ARENA_HEIGHT - 30;
  ctx.textAlign = 'left';
  ctx.font = `700 11px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('DASH [SHIFT]', x, y - 8);
  const ready = player.dashCooldown <= 0;
  const fraction = ready ? 1 : 1 - player.dashCooldown / PLAYER_TUNING.dashCooldownSeconds;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, x, y, 92, 8, 4);
  ctx.fill();
  ctx.fillStyle = ready ? PALETTE.playerHull : 'rgba(41, 244, 255, 0.45)';
  roundRect(ctx, x, y, 92 * fraction, 8, 4);
  ctx.fill();
  ctx.font = `600 11px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('[M] SOUND  ·  [P] PAUSE', x + 108, y + 8);
}

function drawOverdriveBar(ctx, player) {
  const width = 180;
  const x = ARENA_WIDTH / 2 - width / 2;
  const y = ARENA_HEIGHT - 30;
  ctx.textAlign = 'center';
  ctx.font = `800 12px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.overdrive;
  ctx.fillText('OVERDRIVE', ARENA_WIDTH / 2, y - 6);
  ctx.fillStyle = 'rgba(255, 233, 94, 0.25)';
  roundRect(ctx, x, y, width, 7, 3.5);
  ctx.fill();
  ctx.fillStyle = PALETTE.overdrive;
  roundRect(ctx, x, y, width * (player.overdriveTimer / OVERDRIVE_SECONDS), 7, 3.5);
  ctx.fill();
}

function drawBossBar(ctx, warden) {
  const width = 520;
  const x = ARENA_WIDTH / 2 - width / 2;
  const y = ARENA_HEIGHT - 58;
  const fraction = Math.max(0, warden.hp / warden.maxHp);
  ctx.textAlign = 'center';
  ctx.font = `800 13px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.warden;
  ctx.fillText('— VOID WARDEN —', ARENA_WIDTH / 2, y - 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, x, y, width, 10, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.warden;
  roundRect(ctx, x, y, Math.max(8, width * fraction), 10, 5);
  ctx.fill();
}

export function drawWaveBanner(ctx, state) {
  if (state.wavePhase === 'intro') {
    const isBoss = state.wave % 5 === 0;
    drawCentredBanner(
      ctx,
      isBoss ? 'THE VOID WARDEN AWAKENS' : `WAVE ${state.wave}`,
      isBoss ? 'Break its guard. Watch the rings.' : waveSubtitle(state.wave),
      isBoss ? PALETTE.warden : PALETTE.playerHull,
      Math.min(1, state.phaseTimer / 0.3),
    );
  } else if (state.wavePhase === 'clear') {
    drawCentredBanner(ctx, 'WAVE CLEARED', `Bonus +${state.lastWaveBonus}`, '#4dff88', 1);
  }
}

function waveSubtitle(wave) {
  if (wave === 1) return 'Drifters inbound. Hold the sector.';
  if (wave === 2) return 'Weavers on the wind.';
  if (wave === 3) return 'Stingers are hunting.';
  if (wave === 4) return 'Bulwarks ahead — they split when broken.';
  if (wave === 10) return 'The last gate. End this.';
  return 'Hold the sector.';
}

function drawCentredBanner(ctx, title, subtitle, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.font = `800 44px ${FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.fillText(title, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 90);
  ctx.shadowBlur = 0;
  ctx.font = `600 17px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText(subtitle, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 58);
  ctx.restore();
}

export function drawTitleScreen(ctx, state) {
  drawDim(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = PALETTE.playerHull;
  ctx.shadowBlur = 34;
  ctx.font = `900 92px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText('VOIDSTORM', ARENA_WIDTH / 2, 218);
  ctx.restore();
  ctx.font = `700 19px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.playerHull;
  ctx.fillText('N E O N   A R E N A   S U R V I V A L', ARENA_WIDTH / 2, 256);

  ctx.font = `600 17px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  const lines = [
    'Ten waves of voidspawn are coming for this sector. You are its only pilot.',
    'Survive every wave, break the VOID WARDEN at waves 5 and 10, and clear the arena.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, ARENA_WIDTH / 2, 316 + i * 25));

  const controls = [
    ['WASD / ARROWS', 'fly the ship'],
    ['MOUSE', 'aim — hold click or SPACE to fire'],
    ['SHIFT / RIGHT CLICK', 'dash (briefly untouchable)'],
    ['P', 'pause'],
    ['M', 'mute'],
  ];
  ctx.font = `600 15px ${FONT_STACK}`;
  controls.forEach(([keys, what], i) => {
    const y = 402 + i * 27;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.overdrive;
    ctx.fillText(keys, ARENA_WIDTH / 2 - 14, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(what, ARENA_WIDTH / 2 + 14, y);
  });
  ctx.textAlign = 'center';

  const pulse = 0.65 + Math.sin(state.time * 3.4) * 0.35;
  ctx.font = `800 23px ${FONT_STACK}`;
  ctx.fillStyle = `rgba(234, 252, 255, ${pulse})`;
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', ARENA_WIDTH / 2, 596);

  ctx.font = `600 14px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`BEST SCORE  ${formatScore(state.best)}`, ARENA_WIDTH / 2, 640);
  ctx.fillText('Grab green crosses to repair · gold bolts for OVERDRIVE triple fire', ARENA_WIDTH / 2, 668);
}

export function drawPauseOverlay(ctx, state) {
  drawDim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.font = `800 46px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText('PAUSED', ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 16);
  ctx.font = `600 16px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('Press P or click to resume', ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 22);
}

export function drawGameOverScreen(ctx, state) {
  drawDim(ctx, 0.66);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = PALETTE.warden;
  ctx.shadowBlur = 28;
  ctx.font = `900 68px ${FONT_STACK}`;
  ctx.fillStyle = '#ff5e7a';
  ctx.fillText('SHIP DOWN', ARENA_WIDTH / 2, 268);
  ctx.restore();
  ctx.font = `600 18px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText(`The void took the sector on wave ${state.wave}.`, ARENA_WIDTH / 2, 312);
  drawResultsBlock(ctx, state, 356);
  const pulse = 0.65 + Math.sin(state.time * 3.4) * 0.35;
  ctx.font = `800 21px ${FONT_STACK}`;
  ctx.fillStyle = `rgba(234, 252, 255, ${pulse})`;
  ctx.fillText('PRESS ENTER TO FLY AGAIN', ARENA_WIDTH / 2, 560);
}

export function drawVictoryScreen(ctx, state) {
  drawDim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#4dff88';
  ctx.shadowBlur = 28;
  ctx.font = `900 64px ${FONT_STACK}`;
  ctx.fillStyle = '#4dff88';
  ctx.fillText('ARENA CLEARED', ARENA_WIDTH / 2, 258);
  ctx.restore();
  ctx.font = `600 18px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText('All ten waves broken. The sector is yours, pilot.', ARENA_WIDTH / 2, 302);
  drawResultsBlock(ctx, state, 346);
  ctx.font = `800 20px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textBright;
  ctx.fillText('ENTER — KEEP FLYING (ENDLESS)', ARENA_WIDTH / 2, 548);
  ctx.font = `600 15px ${FONT_STACK}`;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('R — start a fresh run', ARENA_WIDTH / 2, 578);
}

function drawResultsBlock(ctx, state, topY) {
  const rows = [
    ['FINAL SCORE', formatScore(state.score)],
    ['BEST', formatScore(state.best)],
    ['WAVE REACHED', String(state.wave)],
    ['KILLS', String(state.stats.kills)],
    ['ACCURACY', state.stats.shotsFired > 0 ? `${Math.round((state.stats.hits / state.stats.shotsFired) * 100)}%` : '—'],
  ];
  ctx.font = `600 16px ${FONT_STACK}`;
  rows.forEach(([label, value], i) => {
    const y = topY + i * 30;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(label, ARENA_WIDTH / 2 - 16, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textBright;
    ctx.fillText(value, ARENA_WIDTH / 2 + 16, y);
  });
  ctx.textAlign = 'center';
  if (state.newBest) {
    ctx.font = `800 17px ${FONT_STACK}`;
    ctx.fillStyle = PALETTE.overdrive;
    ctx.fillText('★ NEW BEST SCORE ★', ARENA_WIDTH / 2, topY + rows.length * 30 + 12);
  }
}

function drawDim(ctx, alpha) {
  ctx.fillStyle = `rgba(2, 2, 10, ${alpha})`;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function formatScore(value) {
  return Math.floor(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
