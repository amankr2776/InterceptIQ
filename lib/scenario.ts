import { makeRng } from './rng';
import { INTERCEPTORS, THREATS, type InterceptorSpec, type ThreatSpec } from './systems';
import { THEATRES, sectorById, type Theatre } from './theatre';
import type {
  Scenario, Threat, LaunchArea, DefendedAsset, TrajectorySample, ThreatClass,
} from './types';

const g = 9.80665;
export const KM_LAT = 110.574;
export const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Battery designators — fictional unit names on real system types. */
const UNIT = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];

/** Which real systems make up the candidate laydown, by tier. */
const LAYDOWN: Record<string, string[]> = {
  easy:   ['AKASH', 'MRSAM', 'QRSAM', 'SPYDER'],
  medium: ['S400', 'MRSAM', 'AKASH', 'QRSAM', 'SPYDER', 'PECHORA'],
  hard:   ['S400', 'AAD', 'PAD', 'MRSAM', 'AKASH', 'QRSAM', 'SPYDER', 'PECHORA'],
  random: ['S400', 'AAD', 'MRSAM', 'AKASH', 'QRSAM', 'SPYDER', 'PECHORA'],
};

const THREAT_MIX: Record<string, string[]> = {
  easy:   ['ABDALI', 'GHAZNAVI'],
  medium: ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI'],
  hard:   ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHEEN2'],
  random: ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHEEN2'],
};

const TIER: Record<string, { threats: [number, number]; areas: [number, number] }> = {
  easy:   { threats: [2, 3], areas: [3, 4] },
  medium: { threats: [4, 6], areas: [5, 6] },
  hard:   { threats: [7, 9], areas: [7, 8] },
  random: { threats: [3, 8], areas: [4, 7] },
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
  rng: ReturnType<typeof makeRng>
): { samples: TrajectorySample[]; apogee: number; origin: { lat: number; lon: number } } {
  // How far out the shooter is: a fraction of the system's published range
  const rangeKm = rng.range(spec.rangeKm[0] * 0.45, Math.min(spec.rangeKm[1], 900));
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
    /* A subsonic cruise missile flying its full published range takes 30+
     * minutes, which is real but useless on a tactical display. We model the
     * TERMINAL INGRESS LEG only: the track is picked up as it enters radar
     * coverage, so the simulated flight begins at a realistic acquisition
     * range rather than at the launcher. */
    const ingressKm = Math.min(rangeKm, 260);
    const dur = (ingressKm * 1000) / v;
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
  const pool = LAYDOWN[opts.tier] ?? LAYDOWN.random;
  const areas: LaunchArea[] = [];
  for (let i = 0; i < nAreas; i++) {
    const spec: InterceptorSpec =
      INTERCEPTORS.find((x) => x.id === pool[i % pool.length])!;
    // place around a defended sector, offset toward the threat axis
    const a = assets[i % assets.length];
    const arc = theatre.threatArc;
    const lo = arc[0], hi = arc[1] < arc[0] ? arc[1] + 360 : arc[1];
    const bear = ((rng.range(lo - 55, hi + 55) % 360) + 360) % 360;
    // stand-off proportional to the system's own reach
    const off = Math.min(spec.rangeKm[1] * rng.range(0.22, 0.5), span * 0.3);
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
  const mix = THREAT_MIX[opts.tier] ?? THREAT_MIX.random;
  const threats: Threat[] = [];
  for (let i = 0; i < nThreats; i++) {
    const spec = THREATS.find((x) => x.id === mix[rng.int(0, mix.length - 1)])!;
    const aimAsset = assets[rng.int(0, assets.length - 1)];
    const jitter = rng.range(0, aimAsset.radiusKm * 1.1);
    const jAng = rng.range(0, 2 * Math.PI);
    const aim = {
      lat: aimAsset.centroid.lat + (jitter * Math.sin(jAng)) / KM_LAT,
      lon: aimAsset.centroid.lon + (jitter * Math.cos(jAng)) / kmLon(aimAsset.centroid.lat),
    };
    const arc = theatre.threatArc;
    const lo = arc[0], hi = arc[1] < arc[0] ? arc[1] + 360 : arc[1];
    const bearFrom = ((rng.range(lo, hi) % 360) + 360) % 360;
    const t0 = rng.range(0, opts.tier === 'hard' ? 70 : 110);

    const { samples, apogee } = propagate(spec, aim, bearFrom, t0, rng);
    // fill AOI-relative local coords
    samples.forEach((s) => { s.l = toL(s.p.lat, s.p.lon, s.p.alt); });

    const last = samples[samples.length - 1];
    const first = samples[0];
    const gnd = Math.hypot(last.l.x - first.l.x, last.l.y - first.l.y);
    // flight bearing (direction of travel)
    let flyBear = (Math.atan2(last.l.x - first.l.x, last.l.y - first.l.y) * 180) / Math.PI;
    if (flyBear < 0) flyBear += 360;

    threats.push({
      id: `T-${i + 1}`,
      callsign: `TGT-${String(i + 1).padStart(2, '0')}`,
      cls: spec.cls as ThreatClass,
      systemId: spec.id,
      rvValue: Math.round(Math.min(10, 3 + spec.warheadKg / 150)),
      trajectory: samples,
      impact: { t: last.t, p: last.p, l: last.l },
      apogeeAlt: Math.round(apogee),
      origin: { p: first.p, l: first.l, name: `LP-${String(i + 1).padStart(2, '0')}` },
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
