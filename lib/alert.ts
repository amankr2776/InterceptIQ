import type { AllocationSolution, Scenario, Threat } from './types';

/**
 * AIR-DEFENCE ALERT CHAIN
 * =======================
 * Batteries are not inert until the instant they fire. A real SAM unit walks
 * up through readiness states as the threat picture develops, and that
 * progression is what an operator actually watches:
 *
 *   READY      nothing inbound over national territory
 *   ALERT      a hostile track has crossed the frontier — radars to full power
 *   TRACKING   a track has entered this battery's engagement envelope
 *   LOCKED     this battery has been assigned a target and is inside its
 *              firing window (counting down to launch)
 *   FIRING     round away, interceptor in flight
 *   RELOADING  round expended, launcher cycling
 *   OFFLINE    destroyed / unavailable
 *
 * All states are derived from the scenario and the committed fire plan at the
 * current simulation time — nothing is scripted, so the chain responds to
 * live re-optimisation, battery kills and injected tracks.
 */

export type BatteryState =
  | 'READY' | 'ALERT' | 'TRACKING' | 'LOCKED' | 'FIRING' | 'RELOADING' | 'OFFLINE';

export const STATE_COLOUR: Record<BatteryState, string> = {
  READY: 'var(--dim)',
  ALERT: 'var(--amb)',
  TRACKING: 'var(--cy)',
  LOCKED: 'var(--vio)',
  FIRING: 'var(--intcp)',
  RELOADING: 'var(--dim2)',
  OFFLINE: 'var(--threat)',
};

export const STATE_RANK: Record<BatteryState, number> = {
  OFFLINE: -1, READY: 0, RELOADING: 1, ALERT: 2, TRACKING: 3, LOCKED: 4, FIRING: 5,
};

export interface BatteryStatus {
  areaId: string;
  state: BatteryState;
  /** Short operator-facing reason, e.g. "TGT-03 in envelope". */
  detail: string;
  /** Seconds until this battery's next launch, if one is scheduled. */
  countdownS: number | null;
  /** Tracks currently inside this battery's engagement envelope. */
  inEnvelope: string[];
  /** Rounds still on the rail at this instant. */
  roundsLeft: number;
}

/** Has any hostile track crossed into national airspace by time t? */
export function airspaceViolated(sc: Scenario, t: number): Threat[] {
  return sc.threats.filter(
    (th) => th.borderCrossT !== null && t >= th.borderCrossT && t <= th.impact.t
  );
}

/**
 * Is a threat inside this battery's engagement envelope right now?
 * Uses the same slant-range and altitude-band test as the intercept solver,
 * so what the operator sees matches what the optimiser used.
 */
function inEnvelopeNow(
  area: Scenario['areas'][0],
  th: Threat,
  t: number
): boolean {
  if (t < th.trajectory[0].t || t > th.impact.t) return false;
  const traj = th.trajectory;
  let lo = 0, hi = traj.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (traj[m].t <= t) lo = m; else hi = m;
  }
  const s = traj[lo];
  const alt = s.p.alt;
  if (alt < area.minEngageAlt || alt > area.maxEngageAlt) return false;
  const dLat = (s.p.lat - area.centroid.lat) * 110.574;
  const dLon =
    (s.p.lon - area.centroid.lon) * 111.32 * Math.cos((area.centroid.lat * Math.PI) / 180);
  const slant = Math.hypot(Math.hypot(dLat, dLon), alt / 1000);
  return slant <= area.maxSlantRange;
}

/** Full readiness picture for every battery at simulation time t. */
export function batteryStatuses(
  sc: Scenario,
  sol: AllocationSolution | null,
  t: number
): BatteryStatus[] {
  const violators = airspaceViolated(sc, t);
  const anyInbound = violators.length > 0;

  return sc.areas.map((a) => {
    if (!a.active) {
      return {
        areaId: a.id, state: 'OFFLINE' as const,
        detail: 'Battery destroyed or unavailable',
        countdownS: null, inEnvelope: [], roundsLeft: 0,
      };
    }

    const shots = (sol?.shots ?? []).filter((s) => s.areaId === a.id);
    const fired = shots.filter((s) => t >= s.option.tLaunch);
    const roundsLeft = Math.max(0, a.inventory - fired.length);

    // rounds currently in flight from this battery
    const inFlight = shots.filter(
      (s) => t >= s.option.tLaunch && t < s.option.tIntercept
    );
    if (inFlight.length) {
      const names = inFlight
        .map((s) => sc.threats.find((x) => x.id === s.threatId)?.callsign)
        .filter(Boolean);
      return {
        areaId: a.id, state: 'FIRING' as const,
        detail: `${inFlight.length} round(s) in flight → ${names.join(', ')}`,
        countdownS: null,
        inEnvelope: [], roundsLeft,
      };
    }

    // next scheduled launch
    const next = shots
      .filter((s) => t < s.option.tLaunch)
      .sort((x, y) => x.option.tLaunch - y.option.tLaunch)[0];

    const envelope = sc.threats
      .filter((th) => inEnvelopeNow(a, th, t))
      .map((th) => th.callsign);

    if (next) {
      const dt = next.option.tLaunch - t;
      const tgt = sc.threats.find((x) => x.id === next.threatId)?.callsign ?? '—';
      if (dt <= 30) {
        return {
          areaId: a.id, state: 'LOCKED' as const,
          detail: `Locked on ${tgt} — launch in ${dt.toFixed(0)}s`,
          countdownS: dt, inEnvelope: envelope, roundsLeft,
        };
      }
    }

    if (envelope.length) {
      return {
        areaId: a.id, state: 'TRACKING' as const,
        detail: `${envelope.join(', ')} in engagement envelope`,
        countdownS: next ? next.option.tLaunch - t : null,
        inEnvelope: envelope, roundsLeft,
      };
    }

    // reloading: fired everything and rounds are cycling
    if (roundsLeft === 0 && fired.length > 0) {
      return {
        areaId: a.id, state: 'RELOADING' as const,
        detail: `All ${a.inventory} rounds expended — ${a.reloadTime}s reload cycle`,
        countdownS: null, inEnvelope: [], roundsLeft: 0,
      };
    }

    if (anyInbound) {
      const nearest = violators
        .map((th) => ({ th, dt: th.impact.t - t }))
        .sort((x, y) => x.dt - y.dt)[0];
      return {
        areaId: a.id, state: 'ALERT' as const,
        detail: `${violators.length} hostile track(s) in national airspace — nearest impact ${nearest.dt.toFixed(0)}s`,
        countdownS: next ? next.option.tLaunch - t : null,
        inEnvelope: [], roundsLeft,
      };
    }

    return {
      areaId: a.id, state: 'READY' as const,
      detail: 'No hostile tracks over national territory',
      countdownS: null, inEnvelope: [], roundsLeft,
    };
  });
}

/** Highest alert level across the network — drives the header banner. */
export function networkAlert(statuses: BatteryStatus[]): BatteryState {
  return statuses.reduce<BatteryState>(
    (best, s) => (STATE_RANK[s.state] > STATE_RANK[best] ? s.state : best),
    'READY'
  );
}
