// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
import { region } from './theatre';

/**
 * TERRITORY TEST
 * ==============
 * Point-in-polygon against real Natural Earth national borders, used to keep
 * the scenario generator physically honest: a hostile launch point must lie
 * OUTSIDE Indian territory, and an inbound track must actually cross the
 * frontier rather than materialise over the country it is attacking.
 *
 * Rings are pre-filtered by bounding box, so the common case (a point far from
 * a given landmass) costs two comparisons rather than a full ray cast.
 */

interface Ring {
  pts: [number, number][];
  minLon: number; maxLon: number; minLat: number; maxLat: number;
}

function prep(rings: [number, number][][]): Ring[] {
  return rings.map((pts) => {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [x, y] of pts) {
      if (x < minLon) minLon = x;
      if (x > maxLon) maxLon = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
    }
    return { pts, minLon, maxLon, minLat, maxLat };
  });
}

const CACHE = new Map<string, Ring[]>();
function ringsFor(iso: string): Ring[] {
  let r = CACHE.get(iso);
  if (!r) {
    const c = region.countries.find((x) => x.iso === iso);
    r = c ? prep(c.rings) : [];
    CACHE.set(iso, r);
  }
  return r;
}

function inRing(lon: number, lat: number, r: Ring): boolean {
  if (lon < r.minLon || lon > r.maxLon || lat < r.minLat || lat > r.maxLat) return false;
  const p = r.pts;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Strict point-in-polygon against the simplified border rings. */
export function inCountry(lat: number, lon: number, iso = 'IND'): boolean {
  return ringsFor(iso).some((r) => inRing(lon, lat, r));
}

/** Shortest distance (deg) from a point to a ring's edges. */
function distToRing(lon: number, lat: number, r: Ring): number {
  const p = r.pts;
  let best = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((lon - ax) * dx + (lat - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = Math.hypot(lon - cx, lat - cy);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Territory test with a coastal tolerance band.
 *
 * The bundled borders are Douglas-Peucker simplified to ~4 km, which cuts
 * corners on intricate coastlines. Strict point-in-polygon therefore reports
 * genuinely inland locations as "outside" — the southern tip of Mumbai
 * (Colaba) being the clearest case. Treating anything within `tolDeg` of the
 * boundary as inside removes that class of false negative while still
 * rejecting real open water and foreign territory.
 *
 * ~0.08 deg is roughly 9 km: above the worst simplification error on narrow
 * peninsulas, still far below the 40 km+ standoff the launch solver enforces,
 * so it cannot cause a hostile launcher to be accepted on Indian soil.
 */
export function inCountryTolerant(lat: number, lon: number, iso = 'IND', tolDeg = 0.08): boolean {
  const rings = ringsFor(iso);
  for (const r of rings) if (inRing(lon, lat, r)) return true;
  for (const r of rings) {
    if (lon < r.minLon - tolDeg || lon > r.maxLon + tolDeg ||
        lat < r.minLat - tolDeg || lat > r.maxLat + tolDeg) continue;
    if (distToRing(lon, lat, r) <= tolDeg) return true;
  }
  return false;
}

/** Default territory test used across the app. */
export const inIndia = (lat: number, lon: number) => inCountryTolerant(lat, lon, 'IND');

/** Strict variant — used when choosing hostile launch points, where we want
 *  no ambiguity about being clear of the frontier. */
export const inIndiaStrict = (lat: number, lon: number) => inCountry(lat, lon, 'IND');

const KM_LAT = 110.574;
const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Step outward from a point along a compass bearing. */
export function project(lat: number, lon: number, bearingDeg: number, km: number) {
  const th = (bearingDeg * Math.PI) / 180;
  return {
    lat: lat + (km * Math.cos(th)) / KM_LAT,
    lon: lon + (km * Math.sin(th)) / kmLon(lat),
  };
}

/**
 * Walking outward from `aim` along `bearing`, return the distance in km at
 * which the ray leaves Indian territory for good (within `maxKm`).
 * Returns null if it never clears — e.g. a bearing pointing deep inland.
 *
 * `clearKm` requires the ray to stay outside for that additional distance,
 * so a launch point cannot land in a small inlet or just across a river bend
 * and immediately re-enter.
 */
export function exitDistanceKm(
  aimLat: number, aimLon: number, bearingDeg: number,
  maxKm = 1400, stepKm = 12, clearKm = 60
): number | null {
  let firstOut: number | null = null;
  for (let d = stepKm; d <= maxKm; d += stepKm) {
    const p = project(aimLat, aimLon, bearingDeg, d);
    const out = !inCountryTolerant(p.lat, p.lon, 'IND', 0.045);
    if (out) {
      if (firstOut === null) firstOut = d;
      if (d - firstOut >= clearKm) return firstOut;
    } else {
      firstOut = null;    // re-entered; keep looking
    }
  }
  return null;
}

/**
 * Choose a hostile launch bearing and range for a track aimed at (aimLat,aimLon).
 *
 * Guarantees:
 *   - the origin lies outside Indian territory
 *   - the origin is at least `minStandoffKm` beyond the border crossing
 *   - the range stays within the weapon's published envelope
 *
 * Tries the preferred arc first, then widens, then sweeps the full circle.
 * Returns null only if no bearing works, in which case the caller should skip.
 */
export function findHostileLaunch(
  aimLat: number, aimLon: number,
  arc: [number, number],
  rangeMinKm: number, rangeMaxKm: number,
  rnd: () => number,
  minStandoffKm = 40
): { bearingFrom: number; rangeKm: number } | null {
  const lo = arc[0];
  const hi = arc[1] < arc[0] ? arc[1] + 360 : arc[1];

  const attempt = (bearing: number): { bearingFrom: number; rangeKm: number } | null => {
    const exit = exitDistanceKm(aimLat, aimLon, bearing);
    if (exit === null) return null;
    const lowest = exit + minStandoffKm;
    if (lowest > rangeMaxKm) return null;          // weapon cannot reach from outside
    const low = Math.max(lowest, rangeMinKm);
    if (low > rangeMaxKm) return null;
    const rangeKm = low + rnd() * (rangeMaxKm - low);
    const o = project(aimLat, aimLon, bearing, rangeKm);
    if (inCountryTolerant(o.lat, o.lon, 'IND', 0.045)) return null;   // final guard
    return { bearingFrom: bearing, rangeKm };
  };

  // 1) preferred threat arc
  for (let i = 0; i < 26; i++) {
    const r = attempt(((lo + rnd() * (hi - lo)) % 360 + 360) % 360);
    if (r) return r;
  }
  // 2) widened arc
  for (let i = 0; i < 26; i++) {
    const r = attempt(((lo - 40 + rnd() * (hi - lo + 80)) % 360 + 360) % 360);
    if (r) return r;
  }
  // 3) deterministic full sweep — guarantees we find one if any exists
  for (let b = 0; b < 360; b += 6) {
    const r = attempt(b);
    if (r) return r;
  }
  return null;
}
