// InterceptIQ
'use client';

/**
 * CINEMATIC PARTICLE ENGINE
 * =========================
 * Canvas 2D, sprite-based. What makes a missile read as real at map scale is
 * not polygon detail — it is the light it throws and the smoke it leaves:
 * a blindingly hot motor with additive bloom, a long persistent smoke column,
 * motion blur from frame persistence, and debris that obeys gravity.
 *
 * Particles draw from pre-rendered radial sprites rather than per-frame
 * gradients, which is far cheaper and lets a few thousand run at 60 fps.
 */

export type SpriteKind = 'hot' | 'fire' | 'smoke' | 'ash';

const SPRITE_PX = 64;

function makeSprite(stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_PX;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(
    SPRITE_PX / 2, SPRITE_PX / 2, 0,
    SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX / 2
  );
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  return c;
}

let SPRITES: Record<SpriteKind, HTMLCanvasElement> | null = null;

export function sprites() {
  if (SPRITES) return SPRITES;
  SPRITES = {
    hot: makeSprite([
      [0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(255,242,205,0.95)'],
      [0.55, 'rgba(255,176,32,0.45)'],
      [1, 'rgba(255,120,20,0)'],
    ]),
    fire: makeSprite([
      [0, 'rgba(255,228,160,0.95)'],
      [0.3, 'rgba(255,150,40,0.7)'],
      [0.65, 'rgba(220,70,20,0.3)'],
      [1, 'rgba(120,30,10,0)'],
    ]),
    smoke: makeSprite([
      [0, 'rgba(126,124,124,0.30)'],
      [0.45, 'rgba(74,74,78,0.17)'],
      [1, 'rgba(26,28,34,0)'],
    ]),
    ash: makeSprite([
      [0, 'rgba(42,44,52,0.30)'],
      [0.5, 'rgba(22,25,31,0.18)'],
      [1, 'rgba(8,10,14,0)'],
    ]),
  };
  return SPRITES;
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  r0: number; r1: number;
  kind: SpriteKind;
  grav: number; drag: number;
  add: boolean;
}

export class Particles {
  list: Particle[] = [];
  cap = 2600;

  spawn(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({
      vx: 0, vy: 0, life: 1, max: 1, r0: 3, r1: 18,
      kind: 'smoke', grav: 0, drag: 0.9, add: false,
      ...p,
    } as Particle);
  }

  /** Rocket motor: brilliant core plus a billowing smoke column behind it. */
  exhaust(x: number, y: number, ang: number, power = 1) {
    const bx = Math.cos(ang + Math.PI), by = Math.sin(ang + Math.PI);
    for (let i = 0; i < 2; i++) {
      this.spawn({
        x: x + bx * 6 + (Math.random() - 0.5) * 3,
        y: y + by * 6 + (Math.random() - 0.5) * 3,
        vx: bx * (60 + Math.random() * 70) * power,
        vy: by * (60 + Math.random() * 70) * power,
        life: 0.16 + Math.random() * 0.12, max: 0.28,
        r0: 5 * power, r1: 15 * power, kind: 'hot', add: true, drag: 0.86,
      });
    }
    this.spawn({
      x: x + bx * 12 + (Math.random() - 0.5) * 5,
      y: y + by * 12 + (Math.random() - 0.5) * 5,
      vx: bx * 22 + (Math.random() - 0.5) * 16,
      vy: by * 22 + (Math.random() - 0.5) * 16 - 5,
      life: 1.5 + Math.random() * 1.1, max: 2.6,
      r0: 4 * power, r1: 26 * power, kind: 'smoke', drag: 0.985, grav: -4,
    });
  }

  /** Launch signature: ground dust ring, smoke tower, muzzle flash. */
  launchPlume(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + (Math.random() - 0.5) * Math.PI * 1.5;
      const s = 60 + Math.random() * 190;
      this.spawn({
        x, y: y + 4,
        vx: Math.cos(a) * s * (Math.random() < 0.5 ? 1 : -1),
        vy: Math.abs(Math.sin(a)) * -s * 0.28,
        life: 1.1 + Math.random() * 1.2, max: 2.3,
        r0: 8, r1: 54, kind: 'smoke', drag: 0.94, grav: 8,
      });
    }
    for (let i = 0; i < 14; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 120,
        life: 0.24 + Math.random() * 0.2, max: 0.45,
        r0: 8, r1: 34, kind: 'hot', add: true, drag: 0.88,
      });
    }
  }

  /** Warhead detonation: flash core, fireball, cooling fragments, ash. */
  detonate(x: number, y: number, scale = 1) {
    for (let i = 0; i < 22; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 460 * scale,
        vy: (Math.random() - 0.5) * 460 * scale,
        life: 0.16 + Math.random() * 0.2, max: 0.36,
        r0: 16 * scale, r1: 78 * scale, kind: 'hot', add: true, drag: 0.83,
      });
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, s = 70 + Math.random() * 300;
      this.spawn({
        x, y, vx: Math.cos(a) * s * scale, vy: Math.sin(a) * s * scale,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        r0: 12 * scale, r1: 62 * scale, kind: 'fire', add: true, drag: 0.9,
      });
    }
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, s = 150 + Math.random() * 520;
      this.spawn({
        x, y, vx: Math.cos(a) * s * scale, vy: Math.sin(a) * s * scale,
        life: 0.7 + Math.random() * 1.3, max: 2.0,
        r0: 4.5 * scale, r1: 1.2, kind: 'hot', add: true, grav: 210, drag: 0.985,
      });
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 130;
      this.spawn({
        x, y, vx: Math.cos(a) * s * scale, vy: Math.sin(a) * s * scale - 14,
        life: 1.7 + Math.random() * 1.5, max: 3.2,
        r0: 14 * scale, r1: 76 * scale, kind: 'ash', drag: 0.972, grav: -7,
      });
    }
  }

  /** Thin persistent contrail for air-breathing threats. */
  contrail(x: number, y: number) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2,
      vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
      life: 1.8 + Math.random() * 1.0, max: 2.8,
      r0: 2, r1: 10, kind: 'smoke', drag: 0.99,
    });
  }

  step(dt: number) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  draw(g: CanvasRenderingContext2D) {
    const S = sprites();
    for (const pass of [false, true]) {
      g.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (const p of this.list) {
        if (p.add !== pass) continue;
        const u = 1 - p.life / p.max;
        const r = p.r0 + (p.r1 - p.r0) * u;
        const a = p.kind === 'smoke' || p.kind === 'ash'
          ? Math.sin(Math.min(1, u * 3.2) * Math.PI * 0.5) * (1 - u) * 0.55
          : (1 - u) * (1 - u);
        if (a <= 0.004 || r <= 0.2) continue;
        g.globalAlpha = a;
        g.drawImage(S[p.kind], p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

/** Decaying camera shake. */
export class Shake {
  amp = 0; x = 0; y = 0;
  kick(a: number) { this.amp = Math.min(46, this.amp + a); }
  step(dt: number) {
    this.amp *= Math.pow(0.06, dt);
    if (this.amp < 0.05) { this.amp = 0; this.x = this.y = 0; return; }
    this.x = (Math.random() - 0.5) * 2 * this.amp;
    this.y = (Math.random() - 0.5) * 2 * this.amp;
  }
}
