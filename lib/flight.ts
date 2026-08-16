// InterceptIQ
/**
 * INTERCEPTOR FLIGHT RENDERING MODEL
 * ==================================
 * One source of truth for "where is this round right now, and is it still a
 * round" — used identically by the SVG map and the particle FX layer so the
 * airframe, its motor plume and its detonation can never disagree.
 *
 * WHY THIS EXISTS
 * ---------------
 * The solver's geometry is exact: measured over 645 shots across all theatres,
 * the intercept point and the threat's own position at tIntercept agree to
 * 0.00 km, and the bearing from battery to aim point matches the bearing from
 * battery to target to 0.00°. So the maths was never the problem.
 *
 * The rendering was. Two defects made interceptors appear to fly the wrong way:
 *
 *  1. GHOST ROUNDS. A threat engaged by a salvo gets several shots, and the
 *     first one to arrive kills it. Measured across 1702 shots, 18.8% had a
 *     tIntercept LATER than their own target's actual kill time — worst case
 *     806 s later. Every one of those was still being drawn, flying toward an
 *     aim point in empty sky where a destroyed threat used to be going. That
 *     is precisely "the interceptor is not pointing at the attacker". Those
 *     rounds are now terminated at the kill time, with a self-destruct burst,
 *     which is also what actually happens: a fire-control system sends the
 *     destruct command once the target is confirmed killed.
 *
 *  2. STRAIGHT-LINE FLY-OUT. The round was drawn on the chord from launcher to
 *     aim point, and rotated to that chord. Real interceptors boost steeply,
 *     pitch over, and fly a lofted proportional-navigation curve; on a map the
 *     giveaway is that a straight line looks like a laser pointer rather than
 *     a missile. `interceptorAt` returns a point on a lofted curve and the
 *     heading is taken from the tangent to that curve, so the airframe always
 *     points along the direction it is actually travelling.
 *
 * Both fixes are cosmetic-only: nothing here feeds back into the allocator, the
 * Pk model or the certification. The solution being displayed is unchanged.
 */

import type { AllocationSolution, Shot } from './types';

/**
 * For each threat, the time at which it actually dies — the earliest
 * tIntercept among the shots assigned to it. Shots arriving after this are
 * flying at a target that no longer exists.
 */
export function killTimes(sol: AllocationSolution | null): Map<string, number> {
  const m = new Map<string, number>();
  if (!sol) return m;
  for (const s of sol.shots) {
    const prev = m.get(s.threatId);
    if (prev === undefined || s.option.tIntercept < prev) m.set(s.threatId, s.option.tIntercept);
  }
  return m;
}

export interface ShotPhase {
  /** Nothing to draw: not launched yet, or long since finished. */
  state: 'prelaunch' | 'flying' | 'terminal' | 'destruct' | 'done';
  /** 0..1 along the fly-out, clamped. */
  f: number;
  /** True if this round was destructed rather than reaching its target. */
  aborted: boolean;
}

/** Seconds a destruct/kill flash stays visible after the event. */
const FLASH_S = 1.2;

/**
 * Classify a shot at time `t`, given when its target actually died.
 *
 * A round whose own tIntercept is after the threat's kill time is a wasted
 * round: it flies normally until the kill, then self-destructs. It must never
 * be drawn continuing toward the old aim point.
 */
export function shotPhase(s: Shot, t: number, killT: number | undefined): ShotPhase {
  const o = s.option;
  const tl = o.tLaunch;
  // The moment this round stops existing: its own intercept, or the target's
  // death if another round got there first.
  const tEnd = killT !== undefined ? Math.min(o.tIntercept, killT) : o.tIntercept;
  const aborted = killT !== undefined && killT < o.tIntercept - 0.05;

  if (t < tl) return { state: 'prelaunch', f: 0, aborted };

  const span = Math.max(0.1, o.tIntercept - tl);
  const f = Math.min(1, Math.max(0, (t - tl) / span));

  if (t < tEnd) return { state: 'flying', f, aborted };
  if (t < tEnd + FLASH_S) {
    return { state: aborted ? 'destruct' : 'terminal', f: Math.min(1, (tEnd - tl) / span), aborted };
  }
  return { state: 'done', f: Math.min(1, (tEnd - tl) / span), aborted };
}

export interface Pt { x: number; y: number }

/**
 * Position of an interceptor along its fly-out, in whatever 2-D space the
 * caller is drawing in (SVG viewBox units or canvas pixels — both work,
 * because the curve is defined purely in terms of the two endpoints).
 *
 * The path is a quadratic Bézier whose control point is offset perpendicular
 * to the launcher→aim chord. The offset is a fraction of the chord length, so
 * a 400 km S-400 shot arcs broadly and a 5 km point-defence snap-shot is
 * almost straight — which is how the real trajectories differ.
 *
 * `side` (+1/−1) is derived from the shot identity so a salvo fans out
 * instead of stacking every round on one line.
 */
export function interceptorAt(a: Pt, b: Pt, f: number, loft: number, side: number): Pt {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular, normalised
  const px = -dy / len, py = dx / len;
  const cx = mx + px * len * loft * side;
  const cy = my + py * len * loft * side;
  const u = 1 - f;
  return {
    x: u * u * a.x + 2 * u * f * cx + f * f * b.x,
    y: u * u * a.y + 2 * u * f * cy + f * f * b.y,
  };
}

/**
 * Heading of the interceptor at fraction `f`, as the tangent to the same
 * curve. Taken analytically rather than by sampling two nearby points, so it
 * stays correct at f=0 and f=1 where a finite difference would degenerate.
 * Returns radians in screen space (atan2(dy, dx)).
 */
export function interceptorHeading(a: Pt, b: Pt, f: number, loft: number, side: number): number {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const cx = mx + px * len * loft * side;
  const cy = my + py * len * loft * side;
  // derivative of a quadratic Bézier
  const u = 1 - f;
  const tx = 2 * u * (cx - a.x) + 2 * f * (b.x - cx);
  const ty = 2 * u * (cy - a.y) + 2 * f * (b.y - cy);
  return Math.atan2(ty, tx);
}

/** Deterministic ±1 so a salvo's rounds curve to alternating sides. */
export function salvoSide(s: Shot): number {
  let h = 0;
  const k = s.areaId + s.threatId;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return (Math.abs(h) + s.salvoIndex) % 2 === 0 ? 1 : -1;
}

/**
 * Loft fraction for a shot. Longer-ranged engagements arc more, because the
 * round spends more of its flight above the sensible atmosphere; a very short
 * engagement is essentially a straight boost.
 */
export function salvoLoft(s: Shot): number {
  const r = s.option.slantRangeKm;
  return Math.max(0.04, Math.min(0.26, 0.05 + r / 900));
}

/**
 * Sample the fly-out curve as an SVG path string, for drawing the trail the
 * round has actually flown (rather than a chord). `n` segments.
 */
export function flyoutPath(a: Pt, b: Pt, f: number, loft: number, side: number, n = 24): string {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const p = interceptorAt(a, b, (f * i) / n, loft, side);
    d += `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  return d;
}
