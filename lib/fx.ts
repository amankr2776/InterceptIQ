// InterceptIQ
'use client';

/**
 * TACTICAL EFFECTS ENGINE
 * =======================
 * Canvas 2D, sprite-based, drawn over the vector map.
 *
 * DESIGN RULE: NO FIRE. There is not a single orange ember, fireball or ash
 * cloud in this file. An earlier version rendered explosions the way a game
 * does — hot orange cores, billowing flame, drifting ash — and against a
 * cool blue-green defence console that reads as arcade, not instrumentation.
 *
 * Instead every effect is keyed to the app's OWN symbology, the same four
 * colours the legend already teaches:
 *
 *   BLUE  (#4da3ff)  interceptor motor efflux and launch signature
 *   GREEN (#34d399)  successful intercept — matches the burst icon exactly
 *   RED   (#f43f5e)  a leaker striking a protected asset: the only failure
 *   GREY             exhaust and residual smoke, desaturated
 *
 * The result is that an effect can never be mistaken for decoration: its
 * colour tells you what happened. Green flash = kill. Red = we lost one.
 *
 * Particles draw from pre-rendered radial sprites rather than per-frame
 * gradients, which is far cheaper and lets a few thousand run at 60 fps.
 */

export type SpriteKind = 'intcp' | 'kill' | 'fail' | 'smoke';

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
    // interceptor efflux — the blue of the legend's "interceptor response"
    intcp: makeSprite([
      [0, 'rgba(232,246,255,0.95)'],
      [0.3, 'rgba(120,190,255,0.55)'],
      [0.65, 'rgba(58,132,220,0.20)'],
      [1, 'rgba(30,80,150,0)'],
    ]),
    // successful intercept — the green of the burst icon
    kill: makeSprite([
      [0, 'rgba(240,255,250,0.95)'],
      [0.28, 'rgba(52,211,153,0.60)'],
      [0.62, 'rgba(24,150,110,0.22)'],
      [1, 'rgba(10,80,60,0)'],
    ]),
    // asset struck — the red reserved for threats
    fail: makeSprite([
      [0, 'rgba(255,236,240,0.9)'],
      [0.3, 'rgba(244,63,94,0.55)'],
      [0.65, 'rgba(160,30,50,0.22)'],
      [1, 'rgba(80,15,25,0)'],
    ]),
    smoke: makeSprite([
      [0, 'rgba(120,132,146,0.22)'],
      [0.45, 'rgba(70,80,92,0.12)'],
      [1, 'rgba(24,28,34,0)'],
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

  /**
   * Interceptor motor efflux — a short blue-white trail behind the round.
   * Deliberately thin: at theatre scale the missile is the signal and the
   * plume is punctuation. The old version emitted a wide grey column that
   * smeared across the map and hid the tracks underneath it.
   */
  exhaust(x: number, y: number, ang: number, power = 1) {
    const bx = Math.cos(ang + Math.PI), by = Math.sin(ang + Math.PI);
    this.spawn({
      x: x + bx * 5 + (Math.random() - 0.5) * 2,
      y: y + by * 5 + (Math.random() - 0.5) * 2,
      vx: bx * (40 + Math.random() * 40) * power,
      vy: by * (40 + Math.random() * 40) * power,
      life: 0.12 + Math.random() * 0.08, max: 0.2,
      r0: 3.4 * power, r1: 9 * power, kind: 'intcp', add: true, drag: 0.86,
    });
    // faint residual trail, cool grey, fades quickly
    this.spawn({
      x: x + bx * 10, y: y + by * 10,
      vx: bx * 12 + (Math.random() - 0.5) * 6,
      vy: by * 12 + (Math.random() - 0.5) * 6,
      life: 0.5 + Math.random() * 0.4, max: 0.9,
      r0: 2.4 * power, r1: 10 * power, kind: 'smoke', drag: 0.99,
    });
  }

  /**
   * LAUNCH SIGNATURE — a compact blue flare at the launcher.
   * Was a 40-particle dust storm with a muzzle flash; on a map with a dozen
   * batteries firing it turned the whole sector into fog. Now it is a brief
   * bloom plus a small shock ring, which reads as "this battery just fired"
   * without obscuring the battery.
   */
  launchPlume(x: number, y: number) {
    this.shock(x, y, 0.3);
    for (let i = 0; i < 5; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 40,
        life: 0.16 + Math.random() * 0.14, max: 0.32,
        r0: 5, r1: 17, kind: 'intcp', add: true, drag: 0.88,
      });
    }
    for (let i = 0; i < 4; i++) {
      this.spawn({
        x, y, vx: (Math.random() - 0.5) * 34, vy: (Math.random() - 0.5) * 20,
        life: 0.6 + Math.random() * 0.5, max: 1.1,
        r0: 4, r1: 20, kind: 'smoke', drag: 0.96,
      });
    }
  }

  /** Thin persistent contrail for air-breathing threats. */
  contrail(x: number, y: number) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2,
      vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
      life: 1.0 + Math.random() * 0.6, max: 1.6,
      r0: 1.6, r1: 7, kind: 'smoke', drag: 0.99,
    });
  }

  /**
   * Expanding shock ring — the pressure front. `tone` selects the palette so
   * a kill ring is green and an asset strike is red, matching the map legend.
   */
  rings: {
    x: number; y: number; r: number; v: number;
    life: number; max: number; w: number; tone: 'kill' | 'fail' | 'intcp';
  }[] = [];

  shock(x: number, y: number, scale = 1, tone: 'kill' | 'fail' | 'intcp' = 'intcp') {
    this.rings.push({
      x, y, r: 3 * scale, v: 460 * scale, life: 0.45, max: 0.45, w: 2.4 * scale, tone,
    });
  }

  /**
   * INTERCEPT — a clean green flash at the kill point.
   *
   * NO FIRE. A fragmentation kill at 15-30 km has nothing to burn: the
   * visible event is a brief flash, a pressure ring and a scatter of
   * fragments that cool in well under a second. Rendering it in the same
   * green as the burst icon means the effect *states the outcome* — the
   * viewer reads "destroyed" from the colour alone.
   */
  airburst(x: number, y: number, scale = 1) {
    this.shock(x, y, scale * 0.85, 'kill');
    for (let i = 0; i < 6; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 90 * scale,
        vy: (Math.random() - 0.5) * 90 * scale,
        life: 0.07 + Math.random() * 0.08, max: 0.16,
        r0: 8 * scale, r1: 26 * scale, kind: 'kill', add: true, drag: 0.8,
      });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, s = 150 + Math.random() * 300;
      this.spawn({
        x, y, vx: Math.cos(a) * s * scale, vy: Math.sin(a) * s * scale,
        life: 0.18 + Math.random() * 0.22, max: 0.42,
        r0: 2.4 * scale, r1: 0.7, kind: 'kill', add: true, drag: 0.93,
      });
    }
  }

  /**
   * ASSET STRUCK — the failure case, in threat red.
   * Still no fire: this is a map symbol for "a leaker got through", not a
   * simulation of combustion. Bigger and longer than a kill so a miss is
   * unmistakable, but the same restrained vocabulary.
   */
  detonate(x: number, y: number, scale = 1) {
    this.shock(x, y, scale, 'fail');
    for (let i = 0; i < 8; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 120 * scale,
        vy: (Math.random() - 0.5) * 120 * scale,
        life: 0.1 + Math.random() * 0.12, max: 0.24,
        r0: 11 * scale, r1: 38 * scale, kind: 'fail', add: true, drag: 0.82,
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 280;
      this.spawn({
        x, y, vx: Math.cos(a) * s * scale, vy: Math.sin(a) * s * scale,
        life: 0.3 + Math.random() * 0.3, max: 0.65,
        r0: 3 * scale, r1: 0.8, kind: 'fail', add: true, drag: 0.93,
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, s = 25 + Math.random() * 70;
      this.spawn({
        x, y, vx: Math.cos(a) * s * scale, vy: Math.sin(a) * s * scale,
        life: 0.9 + Math.random() * 0.7, max: 1.7,
        r0: 7 * scale, r1: 34 * scale, kind: 'smoke', drag: 0.96,
      });
    }
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
    const d = Math.max(0, dt);        // a negative step would shrink radii
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= d;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      r.r += r.v * d;
      r.v *= Math.pow(0.28, d);       // the front decelerates hard
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
        // smoke fades in then out; emissive kinds decay quadratically
        const a = p.kind === 'smoke'
          ? Math.sin(Math.min(1, u * 3.2) * Math.PI * 0.5) * (1 - u) * 0.4
          : (1 - u) * (1 - u);
        if (a <= 0.004 || r <= 0.2) continue;
        g.globalAlpha = a;
        g.drawImage(S[p.kind], p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    /* Shock fronts last, additively, so they read as light rather than paint.
     * Two concentric strokes give the front a bright core and a soft edge —
     * a single-width circle looks like a UI ring. */
    /* Shock fronts last, additively, so they read as light rather than paint.
     * Tinted to the event's meaning — green kill, red leak, blue launch —
     * never the amber they used to be, which looked like a muzzle flash. */
    const RING: Record<string, [string, string]> = {
      kill:  ['rgba(52,211,153,1)',  'rgba(226,255,244,1)'],
      fail:  ['rgba(244,63,94,1)',   'rgba(255,232,238,1)'],
      intcp: ['rgba(120,190,255,1)', 'rgba(232,246,255,1)'],
    };
    g.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const u = 1 - r.life / r.max;
      const a = (1 - u) * (1 - u) * 0.7;
      // arc() throws IndexSizeError on a negative radius; never let one through
      if (a <= 0.004 || !(r.r > 0)) continue;
      const [halo, core] = RING[r.tone] ?? RING.intcp;
      g.globalAlpha = a * 0.45;
      g.lineWidth = r.w * (1 + u * 2);
      g.strokeStyle = halo;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke();
      g.globalAlpha = a;
      g.lineWidth = Math.max(0.5, r.w * (1 - u * 0.6));
      g.strokeStyle = core;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke();
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
