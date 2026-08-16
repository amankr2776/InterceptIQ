import { makeRng } from './rng';
import { INTERCEPTORS, THREATS, type InterceptorSpec, type ThreatSpec } from './systems';
import { THEATRES, sectorById, type Theatre } from './theatre';
import { findHostileLaunch, inIndia } from './border';
import type {
  Scenario, Threat, LaunchArea, DefendedAsset, TrajectorySample, ThreatClass,
} from './types';

const g = 9.80665;
export const KM_LAT = 110.574;
export const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Battery designators — fictional unit names on real system types. */
const UNIT = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];

/** Which real systems make up the candidate laydown, by tier. */
/**
 * Candidate laydown per tier. Akash appears more than once because it is the
 * workhorse medium-range system in Indian service (15 squadrons), and the
 * long-range S-400 anchors every tier above easy. Harder tiers add the BMD
 * layer (AAD/PAD) for high-apogee ballistic threats.
 */
const LAYDOWN: Record<string, string[]> = {
  easy:   ['AKASH', 'MRSAM', 'AKASH', 'QRSAM', 'SPYDER'],
  medium: ['S400', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER', 'MRSAM', 'PECHORA'],
  hard:   ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'S400', 'QRSAM', 'SPYDER', 'PAD', 'MRSAM'],
  random: ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER', 'MRSAM', 'PECHORA'],
};

const THREAT_MIX: Record<string, string[]> = {
  easy:   ['ABDALI', 'GHAZNAVI'],
  medium: ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI'],
  hard:   ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHEEN2'],
  random: ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHEEN2'],
};

const TIER: Record<string, { threats: [number, number]; areas: [number, number] }> = {
  easy:   { threats: [2, 3], areas: [3, 5] },
  medium: { threats: [4, 6], areas: [5, 7] },
  hard:   { threats: [7, 9], areas: [7, 8] },
  random: { threats: [3, 8], areas: [5, 7] },
};

export interface GenOpts {
  tier: Scenario['tier'];
  seed?: number;
  theatreId?: string;
  nThreats?: number;
  nAreas?: number;
}

/**
 * Propagate a real threat class from an off-map launch point to an aimpoint,
 * in true lat/lon. Ballistic classes use vacuum kinematics scaled so the
 * apogee matches the published band for that system; cruise classes fly a
 * terrain-hugging profile with a terminal pop-down.
 * Sampled at 1 Hz as (Latitude, Longitude, Altitude).
 */
function propagate(
  spec: ThreatSpec,
  aim: { lat: number; lon: number },
  bearingFrom: number,   // compass bearing the threat comes FROM
  t0: number,
  rng: ReturnType<typeof makeRng>,
  rangeKm: number        // validated: places the origin outside Indian territory
): { samples: TrajectorySample[]; apogee: number; origin: { lat: number; lon: number } } {
  const th = (bearingFrom * Math.PI) / 180;
  // origin lies along bearingFrom, target flies the reciprocal
  const oLat = aim.lat + (rangeKm * Math.cos(th)) / KM_LAT;
  const oLon = aim.lon + (rangeKm * Math.sin(th)) / kmLon(aim.lat);

  const samples: TrajectorySample[] = [];
  let apogee = 0;

  const mk = (t: number, lat: number, lon: number, altM: number, speed: number) => {
    samples.push({
      t: +t.toFixed(2),
      p: { lat: +lat.toFixed(6), lon: +lon.toFixed(6), alt: Math.round(altM) },
      l: { x: 0, y: 0, z: altM / 1000 },   // filled by caller (AOI-relative)
      speed: Math.round(speed),
    });
  };

  if (spec.cls === 'CRUISE') {
    const cruiseAlt = rng.range(spec.apogeeKm[0], spec.apogeeKm[1]) * 1000;
    const v = spec.terminalSpeedMs;
    /* Time compression for long standoff ingress. The geometry (where it was
     * launched, where it crosses the border, where it strikes) stays exact;
     * only the playback clock is compressed, so a 45-minute subsonic transit
     * fits a demo timeline. Reported speeds remain the true published values. */
    /* A subsonic cruise missile flying its full published range takes 30+
     * minutes, which is real but useless on a tactical display. We model the
     * TERMINAL INGRESS LEG only: the track is picked up as it enters radar
     * coverage rather than at the launcher.
     *
     * The ingress start must still lie OUTSIDE Indian territory, otherwise the
     * truncation would place a hostile track over the country it is attacking.
     * We therefore extend the leg until its start point clears the border. */
    let ingressKm = Math.min(rangeKm, 260);
    {
      const bt = (bearingFrom * Math.PI) / 180;
      for (let k = 0; k < 40; k++) {
        const sLat = aim.lat + (ingressKm * Math.cos(bt)) / KM_LAT;
        const sLon = aim.lon + (ingressKm * Math.sin(bt)) / kmLon(aim.lat);
        if (!inIndia(sLat, sLon) || ingressKm >= rangeKm) break;
        ingressKm = Math.min(rangeKm, ingressKm + 25);
      }
    }
    const trueDur = (ingressKm * 1000) / v;
    const dur = Math.min(trueDur, 900);   // cap playback at 15 min
    const ing = ingressKm / rangeKm;      // fraction of the leg we simulate
    const sLat = aim.lat + (oLat - aim.lat) * ing;
    const sLon = aim.lon + (oLon - aim.lon) * ing;
    const steps = Math.ceil(dur);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const lat = sLat + (aim.lat - sLat) * f;
      const lon = sLon + (aim.lon - sLon) * f;
      const tToGo = dur - i;
      const alt = tToGo < 12 ? cruiseAlt * (tToGo / 12) : cruiseAlt;
      apogee = Math.max(apogee, alt);
      mk(t0 + i, lat, lon, alt, v);
    }
    return { samples, apogee, origin: { lat: oLat, lon: oLon } };
  }

  // Ballistic: choose apogee consistent with published band, scaled by range flown
  const frac = rangeKm / spec.rangeKm[1];
  const apoTarget = rng.range(spec.apogeeKm[0], spec.apogeeKm[1]) * 1000 * Math.max(0.35, frac);
  const vz0 = Math.sqrt(2 * g * apoTarget);
  const tTot = (2 * vz0) / g;
  const steps = Math.ceil(tTot);
  for (let i = 0; i <= steps; i++) {
    const tau = i;
    const f = tau / tTot;
    let alt = vz0 * tau - 0.5 * g * tau * tau;
    if (alt < 0) alt = 0;
    const lat = oLat + (aim.lat - oLat) * f;
    const lon = oLon + (aim.lon - oLon) * f;
    // horizontal speed constant; vertical from kinematics; drag bleed low down
    const vh = (rangeKm * 1000) / tTot;
    const vz = vz0 - g * tau;
    let sp = Math.hypot(vh, vz);
    if (alt < 30000 && tau > tTot / 2) sp *= 1 - 0.05 * (1 - alt / 30000);
    apogee = Math.max(apogee, alt);
    mk(t0 + tau, lat, lon, alt, sp);
  }
  return { samples, apogee, origin: { lat: oLat, lon: oLon } };
}

export function generateScenario(opts: GenOpts): Scenario {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = makeRng(seed);
  const theatre: Theatre =
    THEATRES.find((t) => t.id === opts.theatreId) ??
    THEATRES[rng.int(0, THEATRES.length - 1)];

  const tier = TIER[opts.tier] ?? TIER.random;
  const nThreats = opts.nThreats ?? rng.int(tier.threats[0], tier.threats[1]);
  const nAreas = opts.nAreas ?? rng.int(tier.areas[0], tier.areas[1]);

  // AOI origin: south-west of the theatre centre, span from the preset
  const span = theatre.spanKm;
  const lat0 = theatre.centre.lat - span / 2 / KM_LAT;
  const lon0 = theatre.centre.lon - span / 2 / kmLon(theatre.centre.lat);
  const aoi = { lat0, lon0, sizeKm: span };
  const toL = (lat: number, lon: number, altM: number) => ({
    x: (lon - lon0) * kmLon(lat0),
    y: (lat - lat0) * KM_LAT,
    z: altM / 1000,
  });

  // ---------- Defended sectors: REAL cities ----------
  const maxVal = Math.max(...theatre.sectors.map((sid) => sectorById(sid).value));
  const assets: DefendedAsset[] = theatre.sectors.map((sid) => {
    const s = sectorById(sid);
    return {
      id: s.id, name: s.name,
      centroid: { lat: s.lat, lon: s.lon },
      radiusKm: s.radiusKm, value: s.value,
      population: s.pop, kind: s.kind,
      primary: s.value === maxVal,
    };
  });

  // ---------- Candidate batteries: REAL system types ----------
  // Resolve the laydown to concrete specs up front. Filtering here means an
  // unknown id can never reach the loop as `undefined`, and the modulo below
  // is always taken against a non-empty array of real systems.
  const poolIds = LAYDOWN[opts.tier] ?? LAYDOWN.random;
  const pool: InterceptorSpec[] = poolIds
    .map((id) => INTERCEPTORS.find((x) => x.id === id))
    .filter((x): x is InterceptorSpec => !!x);
  if (!pool.length) throw new Error(`No valid interceptor systems for tier "${opts.tier}"`);

  const areas: LaunchArea[] = [];
  for (let i = 0; i < nAreas; i++) {
    const spec: InterceptorSpec = pool[i % pool.length];
    // Place against the sector this battery defends, offset along the threat
    // axis so its envelope covers the approach rather than the rear.
    const a = assets[i % assets.length];
    const arc = theatre.threatArc;
    const lo = arc[0], hi = arc[1] < arc[0] ? arc[1] + 360 : arc[1];
    const bear = ((rng.range(lo - 45, hi + 45) % 360) + 360) % 360;

    /* Stand-off doctrine.
     * Long-range area-defence systems sit well forward so their large
     * envelopes cover the approach corridor. Short-range, low-altitude
     * systems (QRSAM, SPYDER, Akash) are terminal defence — they must sit
     * ON the asset, because a terrain-hugging cruise missile is only
     * engageable in the last few tens of km. Pushing them forward was
     * leaving a hole under the long-range layer that Babur-class threats
     * flew straight through. */
    const lowAlt = spec.altM[1] <= 20000;
    const off = lowAlt
      ? Math.min(spec.rangeKm[1] * rng.range(0.10, 0.28), a.radiusKm + 18)
      : Math.min(spec.rangeKm[1] * rng.range(0.20, 0.45), span * 0.28);
    const bLat = a.centroid.lat + (off * Math.cos((bear * Math.PI) / 180)) / KM_LAT;
    const bLon = a.centroid.lon + (off * Math.sin((bear * Math.PI) / 180)) / kmLon(a.centroid.lat);

    // deployment polygon footprint (battery dispersal, ~2-4 km across)
    const rk = rng.range(1.8, 3.4);
    const poly: { lat: number; lon: number }[] = [];
    const nv = 6;
    for (let v = 0; v < nv; v++) {
      const t = (2 * Math.PI * v) / nv;
      const r = rk * (0.75 + 0.5 * rng.next());
      poly.push({
        lat: +(bLat + (r * Math.sin(t)) / KM_LAT).toFixed(6),
        lon: +(bLon + (r * Math.cos(t)) / kmLon(bLat)).toFixed(6),
      });
    }

    areas.push({
      id: `BTY-${i + 1}`,
      name: `${spec.name} ${UNIT[i % UNIT.length]}`,
      systemId: spec.id,
      polygon: poly,
      centroid: { lat: +bLat.toFixed(6), lon: +bLon.toFixed(6) },
      centroidLocal: { x: (bLon - lon0) * kmLon(lat0), y: (bLat - lat0) * KM_LAT },
      interceptorSpeed: spec.speedMs,
      maxSlantRange: spec.rangeKm[1],
      minEngageAlt: spec.altM[0],
      maxEngageAlt: spec.altM[1],
      inventory: spec.readyRounds,
      reloadTime: spec.reloadS,
      reactionTime: spec.reactionS,
      active: true,
    });
  }

  // ---------- Threats: REAL system classes ----------
  const mixIds = THREAT_MIX[opts.tier] ?? THREAT_MIX.random;
  const mix: ThreatSpec[] = mixIds
    .map((id) => THREATS.find((x) => x.id === id))
    .filter((x): x is ThreatSpec => !!x);
  if (!mix.length) throw new Error(`No valid threat systems for tier "${opts.tier}"`);

  const threats: Threat[] = [];
  for (let i = 0; i < nThreats; i++) {
    const spec: ThreatSpec = mix[rng.int(0, mix.length - 1)];
    const aimAsset = assets[rng.int(0, assets.length - 1)];
    /* Aimpoint scatter around the target city. Coastal assets (Mumbai,
     * Chennai, Jamnagar...) sit on the shoreline, so unconstrained jitter can
     * put the impact point out to sea. Retry inward, then fall back to the
     * city centre, so a strike always lands on the territory being defended. */
    let aim = { lat: aimAsset.centroid.lat, lon: aimAsset.centroid.lon };
    for (let k = 0; k < 12; k++) {
      const jitter = rng.range(0, aimAsset.radiusKm * 1.1);
      const jAng = rng.range(0, 2 * Math.PI);
      const cand = {
        lat: aimAsset.centroid.lat + (jitter * Math.sin(jAng)) / KM_LAT,
        lon: aimAsset.centroid.lon + (jitter * Math.cos(jAng)) / kmLon(aimAsset.centroid.lat),
      };
      if (inIndia(cand.lat, cand.lon)) { aim = cand; break; }
    }
    // If the city centre itself sits just offshore in the simplified border
    // geometry, keep it — but never let scatter push the impact out to sea.
    if (!inIndia(aim.lat, aim.lon)) {
      aim = { lat: aimAsset.centroid.lat, lon: aimAsset.centroid.lon };
    }
    /* Hostile launch geometry.
     * A launch point must lie OUTSIDE Indian territory and far enough beyond
     * the frontier to be a credible standoff shot. findHostileLaunch ray-casts
     * against the real national border, so tracks always cross the boundary
     * inbound instead of appearing over the country they are attacking. */
    const launch = findHostileLaunch(
      aim.lat, aim.lon,
      theatre.threatArc,
      Math.max(spec.rangeKm[0] * 0.45, 120),
      Math.min(spec.rangeKm[1], 900),
      rng.next,
    );
    if (!launch) continue;   // no viable hostile geometry for this aimpoint
    const bearFrom = launch.bearingFrom;
    const t0 = rng.range(0, opts.tier === 'hard' ? 70 : 110);

    const { samples, apogee } = propagate(spec, aim, bearFrom, t0, rng, launch.rangeKm);
    // fill AOI-relative local coords
    samples.forEach((s) => { s.l = toL(s.p.lat, s.p.lon, s.p.alt); });

    const last = samples[samples.length - 1];
    const first = samples[0];
    const gnd = Math.hypot(last.l.x - first.l.x, last.l.y - first.l.y);
    // flight bearing (direction of travel)
    let flyBear = (Math.atan2(last.l.x - first.l.x, last.l.y - first.l.y) * 180) / Math.PI;
    if (flyBear < 0) flyBear += 360;

    const n = threats.length + 1;
    threats.push({
      id: `T-${n}`,
      callsign: `TGT-${String(n).padStart(2, '0')}`,
      cls: spec.cls as ThreatClass,
      systemId: spec.id,
      rvValue: Math.round(Math.min(10, 3 + spec.warheadKg / 150)),
      trajectory: samples,
      impact: { t: last.t, p: last.p, l: last.l },
      apogeeAlt: Math.round(apogee),
      origin: { p: first.p, l: first.l, name: `LP-${String(n).padStart(2, '0')}` },
      targetAssetId: aimAsset.id,
      targetAssetName: aimAsset.name,
      bearingDeg: +flyBear.toFixed(1),
      rangeKm: +gnd.toFixed(1),
    });
  }

  threats.sort((a, b) => a.impact.t - b.impact.t);

  return {
    id: `SC-${seed.toString(36).toUpperCase().slice(0, 6)}`,
    tier: opts.tier,
    seed,
    theatreId: theatre.id,
    aoi,
    threats,
    areas,
    assets,
    createdAt: new Date().toISOString(),
  };
}

export const AOI = { lat0: 21.2, lon0: 71.6, sizeKm: 700 };
