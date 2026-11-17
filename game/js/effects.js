// Juice: particles, shockwaves, floating score text, screen shake and the
// starfield behind the arena. Everything is pooled and capped so a chaotic
// wave never slows the game down, and every effect is pure decoration — the
// simulation never reads it back.

import { ARENA_WIDTH, ARENA_HEIGHT } from './config.js';

const MAX_PARTICLES = 650;
const MAX_FLOATING_TEXTS = 28;

export class Starfield {
  constructor(random) {
    this.stars = [];
    for (let i = 0; i < 130; i++) {
      this.stars.push({
        x: random() * ARENA_WIDTH,
        y: random() * ARENA_HEIGHT,
        depth: 0.25 + random() * 0.75,
        twinklePhase: random() * Math.PI * 2,
      });
    }
    this.nebula = buildNebulaCanvas();
  }

  draw(ctx, elapsedSeconds) {
    ctx.drawImage(this.nebula, 0, 0);
    for (const star of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(elapsedSeconds * (0.6 + star.depth) + star.twinklePhase);
      ctx.globalAlpha = 0.25 + 0.55 * star.depth * twinkle;
      ctx.fillStyle = '#cfeeff';
      const size = star.depth < 0.6 ? 1.4 : 2.2;
      ctx.fillRect(star.x, star.y, size, size);
    }
    ctx.globalAlpha = 1;
  }
}

function buildNebulaCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = ARENA_WIDTH;
  canvas.height = ARENA_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  const blobs = [
    { x: 240, y: 150, r: 340, color: 'rgba(38, 60, 180, 0.20)' },
    { x: 1060, y: 620, r: 380, color: 'rgba(120, 32, 160, 0.16)' },
    { x: 880, y: 120, r: 260, color: 'rgba(10, 130, 160, 0.13)' },
    { x: 380, y: 700, r: 300, color: 'rgba(160, 40, 90, 0.10)' },
  ];
  for (const blob of blobs) {
    const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
    gradient.addColorStop(0, blob.color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
  }
  ctx.strokeStyle = 'rgba(64, 120, 255, 0.07)';
  ctx.lineWidth = 1;
  const cell = 64;
  ctx.beginPath();
  for (let x = cell; x < ARENA_WIDTH; x += cell) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
  }
  for (let y = cell; y < ARENA_HEIGHT; y += cell) {
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_WIDTH, y);
  }
  ctx.stroke();
  return canvas;
}

export class Effects {
  constructor() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.shakeMagnitude = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  addShake(amount) {
    this.shakeMagnitude = Math.min(16, Math.max(this.shakeMagnitude, amount));
  }

  spawnExplosion(x, y, color, power = 1) {
    const count = Math.floor(16 * power);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 240 * power;
      this.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.5,
        maxLife: 0.85,
        size: 1.5 + Math.random() * 2.6,
        color,
        drag: 3.2,
      });
    }
    this.shockwaves.push({ x, y, radius: 6, maxRadius: 54 * power, life: 0.32, maxLife: 0.32, color });
  }

  spawnHitSparks(x, y, color, directionAngle) {
    for (let i = 0; i < 5; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const angle = directionAngle + (Math.random() - 0.5) * 1.5;
      const speed = 120 + Math.random() * 190;
      this.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.16 + Math.random() * 0.2,
        maxLife: 0.36,
        size: 1.4 + Math.random() * 1.6,
        color,
        drag: 4.5,
      });
    }
  }

  spawnMuzzleFlash(x, y, angle, color) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      kind: 'flash',
      x, y,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      life: 0.06,
      maxLife: 0.06,
      size: 7,
      color,
      drag: 0,
    });
  }

  spawnDashTrail(x, y, color) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      kind: 'ghost',
      x, y,
      vx: 0, vy: 0,
      life: 0.28,
      maxLife: 0.28,
      size: 12,
      color,
      drag: 0,
    });
  }

  spawnPickupGlow(x, y, color) {
    for (let i = 0; i < 10; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const angle = (i / 10) * Math.PI * 2;
      this.particles.push({
        kind: 'spark',
        x: x + Math.cos(angle) * 10,
        y: y + Math.sin(angle) * 10,
        vx: Math.cos(angle) * 46,
        vy: Math.sin(angle) * 46 - 24,
        life: 0.4,
        maxLife: 0.4,
        size: 2,
        color,
        drag: 1.2,
      });
    }
  }

  addFloatingText(x, y, text, color, size = 16) {
    if (this.floatingTexts.length >= MAX_FLOATING_TEXTS) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    this.shakeMagnitude = Math.max(0, this.shakeMagnitude - dt * 34);
    const m = this.shakeMagnitude;
    this.shakeX = (Math.random() * 2 - 1) * m;
    this.shakeY = (Math.random() * 2 - 1) * m;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const dragFactor = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      s.radius += (s.maxRadius - s.radius) * Math.min(1, dt * 14);
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      t.y -= 44 * dt;
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  drawWorld(ctx) {
    for (const s of this.shockwaves) {
      ctx.globalAlpha = Math.max(0, (s.life / s.maxLife)) * 0.7;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'ghost') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha + 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawText(ctx) {
    for (const t of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `700 ${t.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles.length = 0;
    this.shockwaves.length = 0;
    this.floatingTexts.length = 0;
    this.shakeMagnitude = 0;
  }
}
