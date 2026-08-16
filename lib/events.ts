import type { AllocationSolution, Scenario } from './types';

export type EventKind =
  | 'TRACK' | 'CLASSIFY' | 'SOLUTION' | 'LAUNCH' | 'INTERCEPT'
  | 'IMPACT' | 'SYSTEM' | 'WARN' | 'LEAKER';

export interface LogEvent {
  t: number;
  kind: EventKind;
  text: string;
}

const SEV: Record<EventKind, string> = {
  TRACK: 'var(--txt)', CLASSIFY: 'var(--cy)', SOLUTION: 'var(--amb)',
  LAUNCH: 'var(--amb)', INTERCEPT: 'var(--grn)', IMPACT: 'var(--red)',
  SYSTEM: 'var(--dim)', WARN: 'var(--amb)', LEAKER: 'var(--red)',
};
export const eventColor = (k: EventKind) => SEV[k];

export const fmtT = (t: number) =>
  `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/**
 * Derive the full mission event timeline from the scenario + solution.
 * Deterministic: the same inputs always produce the same log, so the demo is
 * repeatable and every line is traceable to a computed value.
 */
export function buildEventLog(sc: Scenario, sol: AllocationSolution | null): LogEvent[] {
  const ev: LogEvent[] = [];
  ev.push({ t: 0, kind: 'SYSTEM', text: `Scenario ${sc.id} loaded — AOI 100×100 km @ ${sc.aoi.lat0.toFixed(2)}°N ${sc.aoi.lon0.toFixed(2)}°E` });
  ev.push({ t: 0, kind: 'SYSTEM', text: `${sc.areas.length} candidate launch area(s), ${sc.areas.filter(a => a.active).length} online` });

  for (const t of sc.threats) {
    const t0 = t.trajectory[0].t;
    ev.push({ t: t0, kind: 'TRACK', text: `Track ${t.callsign} acquired — bearing ${bearing(t)}°, alt ${(t.trajectory[0].p.alt / 1000).toFixed(1)} km` });
    ev.push({ t: t0 + 0.6, kind: 'CLASSIFY', text: `${t.callsign} classified ${t.cls} — apogee ${(t.apogeeAlt / 1000).toFixed(0)} km, threat value ${t.rvValue}/10` });
    ev.push({ t: t0 + 1.2, kind: 'WARN', text: `${t.callsign} predicted impact ${fmtT(t.impact.t)} at ${t.impact.p.lat.toFixed(3)}°N ${t.impact.p.lon.toFixed(3)}°E if unengaged` });
  }

  if (sol) {
    for (const s of sol.shots) {
      const a = sc.areas.find((x) => x.id === s.areaId)!;
      const th = sc.threats.find((x) => x.id === s.threatId)!;
      ev.push({
        t: Math.max(0, s.option.tLaunch - a.reactionTime),
        kind: 'SOLUTION',
        text: `Engagement solution: ${a.name} → ${th.callsign}, Pk ${s.option.pk.toFixed(3)}, intercept ${fmtT(s.option.tIntercept)}`,
      });
      ev.push({
        t: s.option.tLaunch, kind: 'LAUNCH',
        text: `${a.name} round ${s.salvoIndex + 1} away → ${th.callsign} — flight ${(s.option.tIntercept - s.option.tLaunch).toFixed(1)}s, closing ${s.option.closingSpeed} m/s`,
      });
      ev.push({
        t: s.option.tIntercept, kind: 'INTERCEPT',
        text: `Intercept ${th.callsign} @ ${(s.option.interceptAltM / 1000).toFixed(1)} km, slant ${s.option.slantRangeKm.toFixed(1)} km, aspect ${s.option.aspectAngleDeg.toFixed(0)}° — Pk ${s.option.pk.toFixed(3)}`,
      });
    }
    for (const r of sol.perThreat) {
      const th = sc.threats.find((x) => x.id === r.threatId)!;
      if (r.leaker) {
        ev.push({ t: th.trajectory[0].t + 2, kind: 'LEAKER', text: `NO FEASIBLE SOLUTION for ${th.callsign} — leaker, no site can reach it in time` });
        ev.push({ t: th.impact.t, kind: 'IMPACT', text: `${th.callsign} IMPACT at ${th.impact.p.lat.toFixed(3)}°N ${th.impact.p.lon.toFixed(3)}°E` });
      }
    }
  }
  return ev.sort((a, b) => a.t - b.t);
}

function bearing(t: { trajectory: { l: { x: number; y: number } }[] }) {
  const a = t.trajectory[0].l, b = t.trajectory[Math.min(5, t.trajectory.length - 1)].l;
  let d = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  if (d < 0) d += 360;
  return d.toFixed(0);
}
