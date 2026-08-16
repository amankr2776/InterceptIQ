import { makeRng } from './rng';
import { THREATS } from './systems';
import { KM_LAT, kmLon } from './scenario';
import type { Scenario, Threat, TrajectorySample } from './types';

const g = 9.80665;

/**
 * Operator/judge action: inject a new track aimed at a clicked map point.
 * Uses the same REAL threat-system specifications and the same kinematics as
 * the scenario generator, so the optimiser treats it identically.
 */
export function injectThreat(
  sc: Scenario,
  aimLat: number,
  aimLon: number,
  tNow: number,
  systemId?: string
): Threat {
  // Attribute the new track to whichever protected asset it threatens most.
  const nearest = sc.assets.reduce((best, a) => {
    const d = Math.hypot(
      (a.centroid.lat - aimLat) * 110.574,
      (a.centroid.lon - aimLon) * 111.32 * Math.cos((aimLat * Math.PI) / 180)
    );
    return !best || d < best.d ? { a, d } : best;
  }, null as null | { a: Scenario['assets'][0]; d: number })!;
  const rng = makeRng(Math.floor(Math.random() * 1e9));
  const spec = THREATS.find((x) => x.id === systemId) ?? THREATS[rng.int(0, THREATS.length - 1)];

  const bearFrom = rng.range(0, 360);
  const rangeKm = rng.range(spec.rangeKm[0] * 0.4, Math.min(spec.rangeKm[1], 700));
  const th = (bearFrom * Math.PI) / 180;
  const oLat = aimLat + (rangeKm * Math.cos(th)) / KM_LAT;
  const oLon = aimLon + (rangeKm * Math.sin(th)) / kmLon(aimLat);

  const { lat0, lon0 } = sc.aoi;
  const toL = (lat: number, lon: number, altM: number) => ({
    x: (lon - lon0) * kmLon(lat0),
    y: (lat - lat0) * KM_LAT,
    z: altM / 1000,
  });

  const samples: TrajectorySample[] = [];
  let apogee = 0;
  const mk = (t: number, lat: number, lon: number, altM: number, speed: number) => {
    samples.push({
      t: +t.toFixed(2),
      p: { lat: +lat.toFixed(6), lon: +lon.toFixed(6), alt: Math.round(altM) },
      l: toL(lat, lon, altM),
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
    const ing = ingressKm / rangeKm;
    const sLat = aimLat + (oLat - aimLat) * ing;
    const sLon = aimLon + (oLon - aimLon) * ing;
    const steps = Math.ceil(dur);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const tToGo = dur - i;
      const alt = tToGo < 12 ? cruiseAlt * (tToGo / 12) : cruiseAlt;
      apogee = Math.max(apogee, alt);
      mk(tNow + i, sLat + (aimLat - sLat) * f, sLon + (aimLon - sLon) * f, alt, v);
    }
  } else {
    const frac = rangeKm / spec.rangeKm[1];
    const apoTarget = rng.range(spec.apogeeKm[0], spec.apogeeKm[1]) * 1000 * Math.max(0.35, frac);
    const vz0 = Math.sqrt(2 * g * apoTarget);
    const tTot = (2 * vz0) / g;
    const steps = Math.ceil(tTot);
    for (let i = 0; i <= steps; i++) {
      const f = i / tTot;
      let alt = vz0 * i - 0.5 * g * i * i;
      if (alt < 0) alt = 0;
      const vh = (rangeKm * 1000) / tTot;
      const vz = vz0 - g * i;
      apogee = Math.max(apogee, alt);
      mk(tNow + i, oLat + (aimLat - oLat) * f, oLon + (aimLon - oLon) * f, alt, Math.hypot(vh, vz));
    }
  }

  const last = samples[samples.length - 1];
  const first = samples[0];
  const gnd = Math.hypot(last.l.x - first.l.x, last.l.y - first.l.y);
  let flyBear = (Math.atan2(last.l.x - first.l.x, last.l.y - first.l.y) * 180) / Math.PI;
  if (flyBear < 0) flyBear += 360;
  const n = sc.threats.length + 1;

  return {
    id: `T-INJ-${Date.now().toString(36)}`,
    callsign: `TGT-${String(n).padStart(2, '0')}`,
    cls: spec.cls,
    systemId: spec.id,
    rvValue: Math.round(Math.min(10, 3 + spec.warheadKg / 150)),
    trajectory: samples,
    impact: { t: last.t, p: last.p, l: last.l },
    apogeeAlt: Math.round(apogee),
    origin: { p: first.p, l: first.l, name: `LP-${String(n).padStart(2, '0')}` },
    targetAssetId: nearest.a.id,
    targetAssetName: nearest.a.name,
    bearingDeg: +flyBear.toFixed(1),
    rangeKm: +gnd.toFixed(1),
  };
}
