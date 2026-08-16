// InterceptIQ
import { dist3, toGeo } from './geo';
import type { EngagementOption, LaunchArea, Threat, LocalPoint } from './types';


/**
 * INTERCEPT SOLVER
 * ----------------
 * For a launch area L and a threat T with a sampled trajectory, find the
 * earliest trajectory sample the interceptor can physically reach.
 *
 * An interceptor launched at t_launch = t_now + reactionTime flies at an
 * average speed v_i. It can meet the threat at sample k (time t_k, point P_k)
 * iff:      |P_k - L| / v_i  <=  t_k - t_launch
 * i.e. flight time required <= time available. We scan samples in order and
 * bisect within the first feasible bracket for a tight intercept point.
 *
 * All assumptions are deliberately simple, documented and internally
 * consistent — this is a decision-support demonstrator, not a fire-control
 * qualification model.
 */

export interface SolveCtx {
  tNow: number;
  /** Debris keep-out floor, metres. Applied as a DEFAULT only — it never
   *  overrides a battery whose published minimum engagement altitude is
   *  lower, otherwise low-altitude point-defence systems (QRSAM 30 m,
   *  SPYDER 20 m, S-400 10 m) would be unable to engage terrain-hugging
   *  cruise missiles, which is precisely what they exist to do. */
  keepOutAltM?: number;
  /** AOI origin for converting local ENU back to geodetic. MUST be the origin
   *  of the scenario being solved — using a stale global constant here silently
   *  places every intercept point hundreds of km from its true location. */
  origin: { lat0: number; lon0: number };
  /** The protected asset this threat is aimed at. Engagement-point selection
   *  prefers intercepts FAR from it (see the doctrine note below). */
  asset?: { lat: number; lon: number };
}

export function solveEngagement(
  area: LaunchArea,
  threat: Threat,
  ctx: SolveCtx
): EngagementOption {
  const L: LocalPoint = { x: area.centroidLocal.x, y: area.centroidLocal.y, z: 0 };
  /* Earliest the battery could physically fire. The ACTUAL launch time is
   * computed after the intercept point is chosen — a battery does not fire and
   * then let the round loiter for minutes, it fires so the interceptor arrives
   * at the intercept point. See tLaunchActual below. */
  const tReady = ctx.tNow + area.reactionTime;
  const tLaunch = tReady;
  const vi = area.interceptorSpeed / 1000; // km/s
  // Effective floor = the battery's own published minimum, never higher.
  const floor = Math.min(ctx.keepOutAltM ?? 0, area.minEngageAlt);

  const base = {
    areaId: area.id,
    threatId: threat.id,
    tLaunch,
    interceptPoint: threat.impact.p,
    interceptLocal: threat.impact.l,
    slantRangeKm: 0,
    interceptAltM: 0,
    aspectAngleDeg: 0,
    closingSpeed: 0,
    pk: 0,
  };

  if (!area.active) {
    return { ...base, feasible: false, reason: 'SITE OFFLINE', tIntercept: -1, timeMarginS: -1 };
  }

  const traj = threat.trajectory;

  /* Scan the ENTIRE feasible engagement window, not just its first instant.
   * The earliest feasible point always sits on the max-range boundary, which
   * is the WORST shot available. A battle manager commits at the point of
   * highest kill probability, subject to still leaving time before impact.
   * We evaluate Pk at every feasible sample and keep the best, then refine
   * with a local golden-section sweep between neighbouring samples. */
  let hit: { t: number; p: LocalPoint; range: number; pk: number } | null = null;
  let windowStart = Infinity;
  let windowEnd = -Infinity;
  let anyInRange = false;

  const evalAt = (t: number): { p: LocalPoint; range: number; pk: number } | null => {
    const p = interpolate(traj, t);
    if (!p) return null;
    const altM = p.z * 1000;
    if (altM < Math.max(floor, area.minEngageAlt) || altM > area.maxEngageAlt) return null;
    const range = dist3(L, p);
    if (range > area.maxSlantRange) return null;
    if (range / vi > t - tLaunch) return null;      // interceptor can't get there
    const margin = threat.impact.t - t;
    if (margin <= 0) return null;
    const v = velocityAt(traj, t);
    const los = { x: p.x - L.x, y: p.y - L.y, z: p.z - L.z };
    const dot = -(los.x * v.x + los.y * v.y + los.z * v.z);
    const nL = Math.hypot(los.x, los.y, los.z) || 1e-9;
    const nV = Math.hypot(v.x, v.y, v.z) || 1e-9;
    const asp = (Math.acos(Math.max(-1, Math.min(1, dot / (nL * nV)))) * 180) / Math.PI;
    const pk = killProbability({
      rangeFrac: range / area.maxSlantRange,
      aspectDeg: asp,
      marginS: margin,
      threatSpeed: speedAt(traj, t),
      cls: threat.cls,
    });
    return { p, range, pk };
  };

  /* ENGAGEMENT-POINT SELECTION — layered-defence doctrine.
   *
   * Maximising raw Pk alone drives the intercept toward the battery, because
   * f_range rewards short shots. Batteries sit near what they defend, so that
   * produced intercepts a few km from the city at low altitude with seconds
   * to spare — the opposite of how air defence is actually fought.
   *
   * Doctrine is to kill as FAR from the protected asset as possible:
   *   - debris falls short of the defended population
   *   - a miss leaves time to re-engage (shoot-look-shoot)
   *   - warhead effects never reach the asset
   *
   * So we score candidate points by Pk weighted toward standoff, while the
   * REPORTED Pk stays the physical value at the chosen point. utility is a
   * selection preference, not a claim about lethality. Points below 70% of
   * the best available Pk are excluded so doctrine never buys a bad shot. */
  const assetPt = ctx.asset;
  const standoffKmOf = (p: LocalPoint) => {
    if (!assetPt) return 0;
    const g = toGeo(p, ctx.origin);
    const dLat = (g.lat - assetPt.lat) * 110.574;
    const dLon = (g.lon - assetPt.lon) * 111.32 * Math.cos((assetPt.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
  };

  const cands: { t: number; p: LocalPoint; range: number; pk: number; standoff: number }[] = [];
  for (let i = 0; i < traj.length; i++) {
    const s = traj[i];
    if (s.t <= tLaunch) continue;
    if (dist3(L, s.l) <= area.maxSlantRange) anyInRange = true;
    const e = evalAt(s.t);
    if (!e) continue;
    windowStart = Math.min(windowStart, s.t);
    windowEnd = Math.max(windowEnd, s.t);
    cands.push({ t: s.t, p: e.p, range: e.range, pk: e.pk, standoff: standoffKmOf(e.p) });
  }

  if (cands.length) {
    const bestPk = Math.max(...cands.map((c) => c.pk));
    const floorPk = bestPk * 0.7;
    const maxStand = Math.max(1, ...cands.map((c) => c.standoff));
    let best = cands[0];
    let bestU = -Infinity;
    for (const c of cands) {
      if (c.pk < floorPk) continue;
      // 60% weight on lethality, 40% on how deep the intercept is
      const u = 0.6 * (c.pk / bestPk) + 0.4 * (c.standoff / maxStand);
      if (u > bestU) { bestU = u; best = c; }
    }
    hit = { t: best.t, p: best.p, range: best.range, pk: best.pk };

    // sub-sample refinement around the chosen point, same utility
    const centre = best.t;
    for (let d = -1; d <= 1; d += 0.1) {
      const tt = centre + d;
      if (tt <= tLaunch) continue;
      const e = evalAt(tt);
      if (!e || e.pk < floorPk) continue;
      const u = 0.6 * (e.pk / bestPk) + 0.4 * (standoffKmOf(e.p) / maxStand);
      if (u > bestU) { bestU = u; hit = { t: tt, p: e.p, range: e.range, pk: e.pk }; }
    }
  }

  if (!hit) {
    return {
      ...base,
      feasible: false,
      reason: anyInRange ? 'NO TIME / ALT WINDOW' : 'OUT OF RANGE',
      tIntercept: -1,
      timeMarginS: -1,
    };
  }

  const margin = threat.impact.t - hit.t;

  // --- Aspect angle at the committed intercept point ---
  const vT = velocityAt(traj, hit.t);
  const los = { x: hit.p.x - L.x, y: hit.p.y - L.y, z: hit.p.z - L.z };
  const dot = -(los.x * vT.x + los.y * vT.y + los.z * vT.z);
  const nL = Math.hypot(los.x, los.y, los.z) || 1e-9;
  const nV = Math.hypot(vT.x, vT.y, vT.z) || 1e-9;
  const aspect = (Math.acos(Math.max(-1, Math.min(1, dot / (nL * nV)))) * 180) / Math.PI;
  const threatSpeed = speedAt(traj, hit.t);
  const closing = threatSpeed * Math.cos((aspect * Math.PI) / 180) + area.interceptorSpeed;

  /* LAUNCH TIME.
   * The interceptor needs range/speed seconds of flight. Fire so it arrives
   * exactly at the intercept point, never earlier than the battery is ready.
   * Previously tLaunch was pinned to tReady, so a round committed against a
   * distant future intercept appeared to sit on the launcher for minutes
   * before moving. */
  const flightS = hit.range / vi;
  const tLaunchActual = Math.max(tReady, hit.t - flightS);

  return {
    ...base,
    feasible: true,
    tLaunch: +tLaunchActual.toFixed(2),
    flightTimeS: +Math.min(flightS, hit.t - tLaunchActual).toFixed(2),
    tIntercept: +hit.t.toFixed(2),
    timeMarginS: +margin.toFixed(2),
    interceptPoint: toGeo(hit.p, ctx.origin),
    interceptLocal: hit.p,
    slantRangeKm: +hit.range.toFixed(2),
    interceptAltM: Math.round(hit.p.z * 1000),
    aspectAngleDeg: +aspect.toFixed(1),
    closingSpeed: Math.round(closing),
    windowOpenS: +windowStart.toFixed(1),
    windowCloseS: +windowEnd.toFixed(1),
    pk: hit.pk,
  };
}

/**
 * SINGLE-SHOT KILL PROBABILITY MODEL  (documented, not classified fidelity)
 *   Pk = Pk_max . f_range . f_aspect . f_margin . f_class
 *   f_range  : degradation toward the range edge (energy/seeker margin)
 *   f_aspect : head-on (0 deg) best; tail-chase (>120 deg) heavily penalised
 *   f_margin : more time before impact => better shoot-look-shoot posture
 *   f_class  : faster re-entry vehicles are harder
 * Every factor is bounded [0,1] and monotone, so the ordering the optimiser
 * produces is explainable and defensible to a judge.
 */
export function killProbability(o: {
  rangeFrac: number;
  aspectDeg: number;
  marginS: number;
  threatSpeed: number;
  cls: string;
}) {
  const PK_MAX = 0.92;
  const fRange = Math.max(0.25, 1 - 0.55 * Math.pow(Math.min(1, o.rangeFrac), 1.6));
  const a = Math.min(180, Math.max(0, o.aspectDeg));
  const fAspect = a <= 60 ? 1 - 0.12 * (a / 60)
    : a <= 120 ? 0.88 - 0.33 * ((a - 60) / 60)
    : 0.55 - 0.40 * ((a - 120) / 60);
  const fMargin = 1 - Math.exp(-o.marginS / 22);
  const fClass = o.cls === 'CRUISE' ? 0.96
    : o.threatSpeed > 3000 ? 0.72
    : o.threatSpeed > 2000 ? 0.84
    : 0.93;
  return +Math.max(0.01, Math.min(0.98,
    PK_MAX * fRange * Math.max(0.08, fAspect) * fMargin * fClass
  )).toFixed(4);
}

function interpolate(traj: Threat['trajectory'], t: number): LocalPoint | null {
  if (t <= traj[0].t) return traj[0].l;
  const last = traj[traj.length - 1];
  if (t >= last.t) return last.l;
  let lo = 0, hi = traj.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (traj[m].t <= t) lo = m; else hi = m;
  }
  const a = traj[lo], b = traj[hi];
  const f = (t - a.t) / (b.t - a.t || 1);
  return {
    x: a.l.x + (b.l.x - a.l.x) * f,
    y: a.l.y + (b.l.y - a.l.y) * f,
    z: a.l.z + (b.l.z - a.l.z) * f,
  };
}

/** Interpolated state at time t: local ENU, geodetic position and speed. */
export function stateAt(threat: Threat, t: number) {
  const l = interpolate(threat.trajectory, t);
  if (!l) return null;
  const traj = threat.trajectory;
  let lo = 0, hi = traj.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (traj[m].t <= t) lo = m; else hi = m;
  }
  const a = traj[lo], b = traj[hi];
  const f = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t || 1)));
  const p = {
    lat: a.p.lat + (b.p.lat - a.p.lat) * f,
    lon: a.p.lon + (b.p.lon - a.p.lon) * f,
    alt: a.p.alt + (b.p.alt - a.p.alt) * f,
  };
  return { l, p, speed: speedAt(traj, t) };
}

function speedAt(traj: Threat['trajectory'], t: number) {
  let lo = 0, hi = traj.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (traj[m].t <= t) lo = m; else hi = m;
  }
  const a = traj[lo], b = traj[hi];
  const f = (t - a.t) / (b.t - a.t || 1);
  return a.speed + (b.speed - a.speed) * f;
}

function velocityAt(traj: Threat['trajectory'], t: number) {
  const dt = 0.5;
  const p1 = interpolate(traj, Math.max(traj[0].t, t - dt));
  const p2 = interpolate(traj, Math.min(traj[traj.length - 1].t, t + dt));
  if (!p1 || !p2) return { x: 0, y: 0, z: 0 };
  const d = 2 * dt;
  return { x: (p2.x - p1.x) / d, y: (p2.y - p1.y) / d, z: (p2.z - p1.z) / d };
}
