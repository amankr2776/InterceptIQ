import type { AllocationSolution, Scenario } from './types';

export type EventKind =
  | 'TRACK' | 'CLASSIFY' | 'THREAT' | 'SOLUTION' | 'LAUNCH' | 'KILL'
  | 'IMPACT' | 'SYSTEM' | 'LEAKER';

export interface LogEvent {
  t: number;
  kind: EventKind;
  text: string;
}

const SEV: Record<EventKind, string> = {
  TRACK: 'var(--txt)', CLASSIFY: 'var(--cy)', THREAT: 'var(--threat)',
  SOLUTION: 'var(--intcp)', LAUNCH: 'var(--intcp)', KILL: 'var(--burst)',
  IMPACT: 'var(--threat)', SYSTEM: 'var(--dim)', LEAKER: 'var(--threat)',
};
export const eventColor = (k: EventKind) => SEV[k];

export const fmtT = (t: number) =>
  `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/**
 * Mission event log.
 *
 * TEXT CONVENTION — every line states the actor and the direction of action
 * explicitly. An interceptor always DESTROYS / ENGAGES a threat; a threat
 * always TRAVELS TOWARD or STRIKES a protected asset. No line is ever
 * phrased so the reverse could be inferred.
 */
export function buildEventLog(sc: Scenario, sol: AllocationSolution | null): LogEvent[] {
  const ev: LogEvent[] = [];

  ev.push({ t: 0, kind: 'SYSTEM', text: `Scenario ${sc.id} loaded — defending ${sc.assets.map((a) => a.name).join(', ')}` });
  ev.push({ t: 0, kind: 'SYSTEM', text: `${sc.areas.filter((a) => a.active).length} of ${sc.areas.length} interceptor batteries online` });

  for (const t of sc.threats) {
    const t0 = t.trajectory[0].t;
    ev.push({
      t: t0, kind: 'TRACK',
      text: `Track ${t.callsign} acquired — inbound from ${t.origin.name}, heading ${t.bearingDeg.toFixed(0)}°`,
    });
    ev.push({
      t: t0 + 0.6, kind: 'CLASSIFY',
      text: `${t.callsign} classified ${t.cls} — apogee ${(t.apogeeAlt / 1000).toFixed(0)} km, threat value ${t.rvValue}/10`,
    });
    ev.push({
      t: t0 + 1.2, kind: 'THREAT',
      text: `${t.callsign} is tracking toward ${t.targetAssetName} — would strike at ${fmtT(t.impact.t)} if not engaged`,
    });
  }

  if (sol) {
    for (const s of sol.shots) {
      const a = sc.areas.find((x) => x.id === s.areaId)!;
      const th = sc.threats.find((x) => x.id === s.threatId)!;
      const o = s.option;
      ev.push({
        t: Math.max(0, o.tLaunch - a.reactionTime),
        kind: 'SOLUTION',
        text: `Firing solution computed: ${a.name} to engage ${th.callsign} — Pk ${(o.pk * 100).toFixed(1)}% (probability this interceptor destroys the threat)`,
      });
      ev.push({
        t: o.tLaunch, kind: 'LAUNCH',
        text: `${a.name} launches interceptor at ${th.callsign} — ${(o.tIntercept - o.tLaunch).toFixed(0)}s flight, ${o.slantRangeKm.toFixed(0)} km to intercept point`,
      });
      ev.push({
        t: o.tIntercept, kind: 'KILL',
        text: `${a.name} interceptor destroys ${th.callsign} at ${(o.interceptAltM / 1000).toFixed(1)} km altitude — ${
          o.standoffFromAssetKm !== undefined ? `${o.standoffFromAssetKm} km from ${th.targetAssetName}` : `${o.slantRangeKm.toFixed(0)} km from battery`
        }`,
      });
    }
    for (const r of sol.perThreat) {
      const th = sc.threats.find((x) => x.id === r.threatId)!;
      if (r.leaker) {
        ev.push({
          t: th.trajectory[0].t + 2, kind: 'LEAKER',
          text: `LEAKER — no battery can reach ${th.callsign} before it strikes ${th.targetAssetName}`,
        });
        ev.push({
          t: th.impact.t, kind: 'IMPACT',
          text: `${th.callsign} STRIKES ${th.targetAssetName} — protected asset hit`,
        });
      }
    }
  }
  return ev.sort((a, b) => a.t - b.t);
}
