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

/** True if the point lies inside the given country's landmass. */
export function inCountry(lat: number, lon: number, iso = 'IND'): boolean {
  return ringsFor(iso).some((r) => inRing(lon, lat, r));
}

export const inIndia = (lat: number, lon: number) => inCountry(lat, lon, 'IND');

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
    const out = !inIndia(p.lat, p.lon);
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
    if (inIndia(o.lat, o.lon)) return null;        // final guard
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
