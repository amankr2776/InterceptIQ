// InterceptIQ
import { makeRng } from './rng';
import { INTERCEPTORS, THREATS, type InterceptorSpec, type ThreatSpec } from './systems';
import { THEATRES, sectorById, type Theatre } from './theatre';
import { findHostileLaunch, inIndia } from './border';
import { findSite } from './siting';
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

/* Threat mix per tier. Harder tiers add manned strike aircraft, which ingress
 * low and fast and are a point-defence problem rather than an area-defence
 * one — they exercise a different layer of the network than ballistic tracks. */
const THREAT_MIX: Record<string, string[]> = {
  easy:   ['ABDALI', 'GHAZNAVI', 'LOITER', 'NASR', 'SHAHPAR'],
  medium: ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHPAR', 'JF17',
           'NASR', 'RAAD', 'MIRAGE', 'WINGLOONG', 'AH1Z', 'SWARM', 'DF15'],
  /* HARD is the full-spectrum raid: every capability class the PAF/PLAAF and
   * the two rocket forces field at once — hypersonics, MIRV, supersonic
   * stand-off, stealth, bombers, helicopters and swarms. If the network holds
   * against this, it holds. */
  hard:   ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHEEN2', 'SHAHPAR',
           'LOITER', 'JF17', 'F16', 'J10', 'SU30',
           'DF17', 'FATAH2', 'ABABEEL', 'DF21', 'DF26', 'DF15', 'NASR',
           'RAAD', 'CM400', 'CJ10', 'YJ12',
           'J20', 'J35', 'H6K', 'MIRAGE',
           'AH1Z', 'Z10', 'AKINCI', 'WINGLOONG', 'GJ11', 'SWARM'],
  random: ['ABDALI', 'GHAZNAVI', 'BABUR', 'GHAURI', 'SHAHEEN2', 'SHAHPAR',
           'LOITER', 'JF17', 'J10', 'DF17', 'FATAH2', 'CM400', 'J20',
           'AH1Z', 'AKINCI', 'SWARM', 'GJ11', 'DF15'],
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

  /* HYPERSONIC GLIDE VEHICLE.
   * A boost-glide weapon is NOT ballistic and must not be propagated as one.
   * The booster lofts it, the glide body separates and then flies a shallow,
   * depressed, near-constant-altitude path in the upper atmosphere at Mach
   * 5-10, pulling lateral manoeuvres, before a terminal dive.
   *
   * This matters to the solver rather than just the picture: the glide phase
   * sits BELOW the exo-atmospheric BMD layer (PAD engages above 50 km) and
   * ABOVE most medium SAMs, and the manoeuvring means the intercept point
   * cannot be extrapolated far ahead. That is exactly why the class exists. */
  if (spec.cls === 'HGV') {
    const glideAlt = rng.range(spec.apogeeKm[0], spec.apogeeKm[1]) * 1000;
    const v = spec.terminalSpeedMs;
    /* Model the terminal glide leg, capped so the display stays watchable.
     * The truncated START must still lie outside Indian territory — the
     * validated launch point is at full range, so simply cutting the leg can
     * place the first sample over the country being attacked. Observed with
     * Fatah-II tracks starting inside PoK, which the India-POV boundary
     * counts as Indian soil. Extend the leg until it clears the frontier. */
    let ingressKm = Math.min(rangeKm, 700);
    {
      const bt = (bearingFrom * Math.PI) / 180;
      for (let k = 0; k < 60; k++) {
        const sLat = aim.lat + (ingressKm * Math.cos(bt)) / KM_LAT;
        const sLon = aim.lon + (ingressKm * Math.sin(bt)) / kmLon(aim.lat);
        if (!inIndia(sLat, sLon) || ingressKm >= rangeKm) break;
        ingressKm = Math.min(rangeKm, ingressKm + 25);
      }
    }
    const dur = Math.min((ingressKm * 1000) / v, 900);
    const ing = ingressKm / rangeKm;
    const sLat = aim.lat + (oLat - aim.lat) * ing;
    const sLon = aim.lon + (oLon - aim.lon) * ing;
    const steps = Math.ceil(dur);
    /* Lateral weave: a real HGV cross-ranges to defeat prediction. Amplitude
     * is a fraction of the leg, deterministic per track via the seeded rng.
     *
     * The weave is faded IN over the first fifth of the leg. The launch point
     * is validated as outside India on the straight line; displacing the very
     * first sample sideways can push it back across the frontier, which is
     * how Fatah-II tracks ended up originating inside PoK. Starting the
     * weave at zero keeps the validated entry geometry intact. */
    const weaveKm = rng.range(18, 45);
    const weavePhase = rng.range(0, Math.PI * 2);
    // unit vector perpendicular to the ground track
    const dLat = aim.lat - sLat, dLon = aim.lon - sLon;
    const nrm = Math.hypot(dLat, dLon) || 1;
    const pLat = -dLon / nrm, pLon = dLat / nrm;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      // fade in over the first 20% of the leg, fade out toward the aimpoint
      const ramp = Math.min(1, f / 0.2) * (1 - f);
      const w = Math.sin(weavePhase + f * Math.PI * 2.2) * weaveKm * ramp;
      const lat = sLat + dLat * f + (pLat * w) / KM_LAT;
      const lon = sLon + dLon * f + (pLon * w) / kmLon(aim.lat);
      // shallow glide, then a steep terminal dive in the last ~15 s
      const tToGo = dur - i;
      const alt = tToGo < 15 ? glideAlt * (tToGo / 15) : glideAlt * (1 - 0.25 * f);
      apogee = Math.max(apogee, alt);
      mk(t0 + i, lat, lon, alt, v);
    }
    return { samples, apogee, origin: { lat: oLat, lon: oLon } };
  }

  if (spec.cls === 'CRUISE' || spec.cls === 'DRONE' || spec.cls === 'AIRCRAFT' ||
      spec.cls === 'SUPCRUISE' || spec.cls === 'SWARM' || spec.cls === 'HELO' ||
      spec.cls === 'STEALTH' || spec.cls === 'BOMBER') {
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

  /* ---------- Which assets are actually going to be attacked? ----------
   * Battery siting used to walk the asset list round-robin (`i % length`)
   * while threats picked their target at RANDOM. The two sets diverged, so
   * batteries were routinely sited to defend cities nobody was attacking
   * while the city under attack went uncovered.
   *
   * Measured consequence: 9.8% of QRSAM and 8.3% of Akash batteries never had
   * a single threat track within reach for the entire scenario — dead icons
   * on the map, and the dominant cause of "many interceptors are not
   * working". Long-range systems masked the bug because a 400 km envelope
   * covers the whole theatre regardless of where it sits.
   *
   * Aimpoints are therefore drawn FIRST, and batteries are then assigned to
   * assets in proportion to the threat each is actually facing. Short-range
   * point defence goes to the most-attacked assets; long-range area defence
   * can still cover the rest. */
  const aimCount = new Map<string, number>(assets.map((a) => [a.id, 0]));
  const plannedAims: DefendedAsset[] = [];
  for (let i = 0; i < nThreats; i++) {
    const a = assets[rng.int(0, assets.length - 1)];
    plannedAims.push(a);
    aimCount.set(a.id, (aimCount.get(a.id) ?? 0) + 1);
  }
  /* Assets ordered by how much fire they are taking. Ties keep list order so
   * generation stays deterministic for a seed. */
  const byThreat = assets
    .map((a, idx) => ({ a, n: aimCount.get(a.id) ?? 0, idx }))
    .sort((x, y) => (y.n - x.n) || (x.idx - y.idx));
  const defended = byThreat.filter((x) => x.n > 0);
  /** Asset a battery should be sited on, given its index and reach. */
  const assetFor = (i: number, reachKm: number): DefendedAsset => {
    // nothing is under attack (possible only in degenerate cases): round-robin
    if (!defended.length) return assets[i % assets.length];
    // long-range systems can cover an unattacked asset without being wasted
    if (reachKm >= 150) return byThreat[i % byThreat.length].a;
    // point/medium defence must sit where the fire actually is
    return defended[i % defended.length].a;
  };

  const areas: LaunchArea[] = [];
  const placed: { lat: number; lon: number }[] = [];
  for (let i = 0; i < nAreas; i++) {
    const spec: InterceptorSpec = pool[i % pool.length];
    // Place against an asset that is actually being attacked, offset along
    // the threat axis so the envelope covers the approach rather than the rear.
    const a = assetFor(i, spec.rangeKm[1]);
    const arc = theatre.threatArc;

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
      ? Math.min(spec.rangeKm[1] * rng.range(0.10, 0.28), a.radiusKm + 22)
      : Math.min(spec.rangeKm[1] * rng.range(0.20, 0.45), span * 0.28);
    /* HARD CAP: a battery must never be sited so far from the asset it
     * defends that the asset falls outside its own envelope. findSite is
     * free to relax the requested standoff to satisfy soil and dispersion
     * constraints, and was observed putting a 45 km Akash 417 km from Delhi
     * and a 30 km QRSAM 128 km from Amritsar — batteries that cannot defend
     * the thing they are assigned to. 70% of reach leaves margin to engage
     * on the threat side while still covering the asset. */
    const maxOff = Math.max(4, spec.rangeKm[1] * 0.7);

    /* Separation scales with the system's reach: a 400 km S-400 gains nothing
     * from sitting beside another S-400, whereas point-defence units
     * legitimately cluster closer around the asset they protect.
     *
     * The floor here used to be a flat 25 km, which is fatal for short-range
     * systems: a QRSAM reaches 30 km, so demanding 25 km of dispersion pushed
     * it almost its whole radius away from the thing it defends. Measured
     * result: 9.8% of QRSAM and 8.3% of Akash batteries had NO threat track
     * within reach at any point in the scenario — they were painted on the
     * map contributing nothing, which is what "many interceptors are not
     * working" describes. "OUT OF RANGE" was the dominant infeasibility
     * reason for every short-range type.
     *
     * Separation is now a fraction of the system's OWN reach, so dispersion
     * never exceeds what the weapon can cover. */
    const minSep = Math.max(
      6,
      Math.min(spec.rangeKm[1] * 0.45, 130, spec.rangeKm[1] * 0.35)
    );

    const site = findSite({
      anchor: { lat: a.centroid.lat, lon: a.centroid.lon },
      arc: [arc[0] - 45, (arc[1] < arc[0] ? arc[1] + 360 : arc[1]) + 45],
      standoffKm: Math.min(off, maxOff),
      minSepKm: minSep,
      maxStandoffKm: maxOff,
      placed,
      rnd: rng.next,
    });
    placed.push(site);
    const bLat = site.lat, bLon = site.lon;

    /* Deployment polygon footprint (battery dispersal, ~2-4 km across).
     * The centroid is guaranteed on national soil, but a footprint drawn
     * around a coastal site can still spill into the sea, so each vertex is
     * pulled back toward the centroid until it sits on land. */
    const rk = rng.range(1.8, 3.4);
    const poly: { lat: number; lon: number }[] = [];
    const nv = 6;
    for (let v = 0; v < nv; v++) {
      const t = (2 * Math.PI * v) / nv;
      let r = rk * (0.75 + 0.5 * rng.next());
      let vLat = bLat + (r * Math.sin(t)) / KM_LAT;
      let vLon = bLon + (r * Math.cos(t)) / kmLon(bLat);
      /* Shrink along the spoke first — that keeps the footprint's shape. */
      for (let k = 0; k < 14 && !inIndia(vLat, vLon); k++) {
        r *= 0.55;
        vLat = bLat + (r * Math.sin(t)) / KM_LAT;
        vLon = bLon + (r * Math.cos(t)) / kmLon(bLat);
      }
      /* Shrinking along one bearing cannot escape a CONCAVE notch: on the
       * Tripura-Bangladesh border a vertex 250 m from an on-soil centroid
       * stayed outside at every radius. Sweep bearings at a small radius
       * before giving up. */
      if (!inIndia(vLat, vLon)) {
        search:
        for (const rr of [rk * 0.5, rk * 0.25, rk * 0.1]) {
          for (let b = 0; b < 360; b += 20) {
            const th2 = (b * Math.PI) / 180;
            const la = bLat + (rr * Math.sin(th2)) / KM_LAT;
            const lo = bLon + (rr * Math.cos(th2)) / kmLon(bLat);
            if (inIndia(la, lo)) { vLat = la; vLon = lo; break search; }
          }
        }
      }
      /* Last resort — collapse onto the centroid, which is guaranteed on
       * soil. Correct for a fire unit on a Lakshadweep atoll under 2 km
       * across: it genuinely has no room to disperse. */
      if (!inIndia(vLat, vLon)) { vLat = bLat; vLon = bLon; }
      poly.push({ lat: +vLat.toFixed(6), lon: +vLon.toFixed(6) });
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
    /* Use the aimpoint drawn before siting, so the batteries that were placed
     * to defend this asset are the ones that actually face this track. */
    const aimAsset = plannedAims[i] ?? assets[rng.int(0, assets.length - 1)];
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
    /* Standoff band for this shot.
     *
     * The old expression was `max(rangeMin*0.45, 120) .. min(rangeMax, 900)`,
     * which INVERTS for systems at either extreme: a DF-26 (3000-4000 km)
     * produced a band of 1350..900 and a Nasr (60-70 km) produced 120..70.
     * With min > max no bearing can ever satisfy it, so those systems were
     * silently dropped from every scenario — three of the roster never
     * appeared at all.
     *
     * Clamp to the theatre-sized window first, then order the pair, so a
     * shooter is always given a usable band inside its own envelope. */
    const capKm = 900;
    const loWant = Math.min(Math.max(spec.rangeKm[0] * 0.45, 40), capKm);
    const hiWant = Math.min(spec.rangeKm[1], capKm);
    const bandLo = Math.min(loWant, hiWant);
    const bandHi = Math.max(loWant, hiWant);
    const launch = findHostileLaunch(
      aim.lat, aim.lon,
      theatre.threatArc,
      bandLo,
      bandHi,
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

    /* Frontier crossing: first sample inside Indian airspace. This is the
     * event that drives the air-defence alert chain — batteries hold at
     * READY until a track is actually inbound over national territory. */
    let crossT: number | null = null;
    let crossP: typeof first.p | null = null;
    for (const sm of samples) {
      if (inIndia(sm.p.lat, sm.p.lon)) { crossT = sm.t; crossP = sm.p; break; }
    }
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
      borderCrossT: crossT,
      borderCrossP: crossP,
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
