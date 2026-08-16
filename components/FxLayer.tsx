'use client';
// InterceptIQ
import React, { useEffect, useRef } from 'react';
import { Particles, Shake } from '@/lib/fx';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { stateAt } from '@/lib/geometry';
import { KM_LAT, kmLon } from '@/lib/scenario';

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
  const SH = useRef(new Shake());
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
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const parts = P.current, sh = SH.current;

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
        if (playing) {
          if (th.cls === 'AIRCRAFT' || th.cls === 'DRONE') parts.contrail(p.x, p.y);
          else parts.exhaust(p.x, p.y, ang, th.cls === 'CRUISE' ? 0.45 : 0.8);
        }
      }

      /* ---- interceptor plumes, launch signatures, detonations ---- */
      for (const s of sol?.shots ?? []) {
        const a = sc.areas.find((x) => x.id === s.areaId);
        if (!a) continue;
        const o = s.option;
        const key = `${s.areaId}|${s.threatId}|${s.salvoIndex}`;

        if (t >= o.tLaunch && !fired.current.has(key)) {
          fired.current.add(key);
          const bp = project(a.centroid.lat, a.centroid.lon);
          if (bp) { parts.launchPlume(bp.x, bp.y); sh.kick(4); }
        }

        if (t >= o.tLaunch && t < o.tIntercept) {
          const bp = project(a.centroid.lat, a.centroid.lon);
          const ip = project(o.interceptPoint.lat, o.interceptPoint.lon);
          if (bp && ip) {
            const f = Math.min(1, (t - o.tLaunch) / Math.max(0.1, o.tIntercept - o.tLaunch));
            const x = bp.x + (ip.x - bp.x) * f;
            const y = bp.y + (ip.y - bp.y) * f;
            const ang = Math.atan2(ip.y - bp.y, ip.x - bp.x);
            if (playing) parts.exhaust(x, y, ang, 0.75);
          }
        }

        if (t >= o.tIntercept && !blown.current.has(key)) {
          blown.current.add(key);
          const ip = project(o.interceptPoint.lat, o.interceptPoint.lon);
          if (ip) { parts.detonate(ip.x, ip.y, 0.7); sh.kick(11); }
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
          if (ip) { parts.detonate(ip.x, ip.y, 1.15); sh.kick(20); }
        }
      }

      parts.step(dt);
      sh.step(dt);

      g.save();
      g.translate(sh.x, sh.y);
      parts.draw(g);
      g.restore();

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
