'use client';
// InterceptIQ
import React, { useEffect, useRef } from 'react';
import { Particles } from '@/lib/fx';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { stateAt } from '@/lib/geometry';
import {
  killTimes, shotPhase, interceptorAt, interceptorHeading, salvoSide, salvoLoft,
} from '@/lib/flight';

/**
 * IN-APP EFFECTS LAYER
 * ====================
 * A transparent canvas sitting over the tactical map, driven by the same
 * particle engine as the opening sequence. The SVG map stays authoritative
 * for geometry and interaction; this layer only adds the light and smoke that
 * make an engagement read as an engagement:
 *
 *   · motor plumes trailing every live track and interceptor
 *   · launch signature at a battery the moment it fires
 *   · detonation with cooling debris at each intercept point
 *   · screen shake on kills
 *
 * It is purely decorative — pointer-events: none, and it reads position from
 * the solver rather than owning any state. If it were removed the app would
 * behave identically.
 */

interface Props {
  sc: Scenario;
  sol: AllocationSolution | null;
  t: number;
  playing: boolean;
  /** projection from the map, so effects land exactly on the SVG geometry */
  project: (lat: number, lon: number) => { x: number; y: number } | null;
  width: number;
  height: number;
}

export default function FxLayer({ sc, sol, t, playing, project, width, height }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const P = useRef(new Particles());
  const fired = useRef<Set<string>>(new Set());
  const blown = useRef<Set<string>>(new Set());
  const lastT = useRef(0);
  const raf = useRef<number | null>(null);

  // reset when the scenario or plan changes
  useEffect(() => {
    fired.current.clear();
    blown.current.clear();
    P.current.list.length = 0;
  }, [sc.id, sol?.selectedAreaIds.join(',')]);

  // scrubbing backwards should not replay old events
  useEffect(() => {
    if (t < lastT.current - 0.5) { fired.current.clear(); blown.current.clear(); }
    lastT.current = t;
  }, [t]);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;

    let prev = performance.now();
    const frame = (now: number) => {
      /* Clamp to >= 0. rAF passes the timestamp of when the FRAME BEGAN,
       * which can predate the performance.now() captured when this effect
       * was set up — and this effect re-runs on every clock tick. That gave
       * a negative dt on the first frame after each re-subscribe, which
       * integrated shock-ring radii backwards past zero and threw
       * IndexSizeError from arc(). */
      const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000));
      prev = now;
      const parts = P.current;

      g.clearRect(0, 0, width, height);

      /* ---- live threat motor plumes ---- */
      for (const th of sc.threats) {
        if (t < th.trajectory[0].t || t > th.impact.t) continue;
        const res = sol?.perThreat.find((p) => p.threatId === th.id);
        const first = res?.shots.slice().sort((a, b) => a.option.tIntercept - b.option.tIntercept)[0];
        if (first && t >= first.option.tIntercept) continue;    // already dead
        const st = stateAt(th, t);
        if (!st) continue;
        const p = project(st.p.lat, st.p.lon);
        if (!p) continue;
        const st2 = stateAt(th, Math.min(th.impact.t, t + 1.2));
        const q = st2 ? project(st2.p.lat, st2.p.lon) : null;
        const ang = q ? Math.atan2(q.y - p.y, q.x - p.x) : 0;
        /* Thin trails only. A full motor plume on every one of eight
         * simultaneous tracks buried the airframes in smoke — the icons are
         * the information, the smoke is decoration. */
        if (playing) parts.contrail(p.x, p.y);
      }

      /* ---- interceptor plumes, launch signatures, detonations ----
       * Uses the SAME flight model as the SVG map (lib/flight.ts), so the
       * motor plume is emitted from the tail of the airframe the map is
       * drawing, on the same lofted curve, and terminates at the same instant.
       * Previously this integrated a straight chord while the map drew its
       * own line, so plume and missile drifted apart on every long shot. */
      const kt = killTimes(sol);
      for (const s of sol?.shots ?? []) {
        const a = sc.areas.find((x) => x.id === s.areaId);
        if (!a) continue;
        const o = s.option;
        const key = `${s.areaId}|${s.threatId}|${s.salvoIndex}`;
        const ph = shotPhase(s, t, kt.get(s.threatId));
        const bp = project(a.centroid.lat, a.centroid.lon);
        const ip = project(o.interceptPoint.lat, o.interceptPoint.lon);
        if (!bp || !ip) continue;
        const side = salvoSide(s), loft = salvoLoft(s);

        if (t >= o.tLaunch && !fired.current.has(key)) {
          fired.current.add(key);
          parts.launchPlume(bp.x, bp.y);
        }

        if (ph.state === 'flying') {
          const p = interceptorAt(bp, ip, ph.f, loft, side);
          const ang = interceptorHeading(bp, ip, ph.f, loft, side);
          // interceptors keep a real motor plume — they are the thing the
          // user is being asked to watch — but a lean one
          if (playing) parts.exhaust(p.x, p.y, ang, 0.5);
        }

        // terminal kill, or self-destruct if another round got there first
        if ((ph.state === 'terminal' || ph.state === 'destruct') && !blown.current.has(key)) {
          blown.current.add(key);
          const p = interceptorAt(bp, ip, ph.f, loft, side);
          if (ph.aborted) parts.detonate(p.x, p.y, 0.22);
          else parts.detonate(p.x, p.y, 0.55);
        }
      }

      /* ---- leaker impacts ---- */
      for (const r of sol?.perThreat ?? []) {
        if (!r.leaker) continue;
        const th = sc.threats.find((x) => x.id === r.threatId);
        if (!th) continue;
        const key = `imp|${th.id}`;
        if (t >= th.impact.t && !blown.current.has(key)) {
          blown.current.add(key);
          const ip = project(th.impact.p.lat, th.impact.p.lon);
          if (ip) parts.detonate(ip.x, ip.y, 0.9);
        }
      }

      parts.step(dt);

      /* NO CAMERA SHAKE on the tactical map. Shake is a cinema device; on a
       * console the operator is reading positions off a chart, and jolting
       * the whole picture on every detonation makes the map unreadable
       * exactly when the most is happening. The intro keeps its shake — that
       * is a film. This is an instrument. */
      parts.draw(g);

      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [sc, sol, t, playing, project, width, height]);

  return (
    <canvas
      ref={cv}
      width={width}
      height={height}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 5,
      }}
    />
  );
}
