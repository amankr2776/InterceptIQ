// InterceptIQ
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
  /** Latitude-bucketed edge index — see `prep`. */
  bands: Int32Array[];
  bandLat0: number; bandStep: number;
}

/** Latitude bands per ring. Enough to keep buckets small without bloating. */
const BAND_TARGET = 64;

/**
 * Pre-compute bounding boxes and a LATITUDE-BUCKETED EDGE INDEX.
 *
 * The border is now built at ~5 km resolution (India alone is 4562 vertices,
 * up from 564). A naive ray cast walks every edge, and scenario generation
 * performs millions of territory tests during battery siting and hostile
 * launch placement — generation time had risen to 426 ms mean / 1042 ms worst.
 *
 * A crossing test only cares about edges that SPAN the query latitude, so
 * each ring's edges are bucketed by the latitude range they cover. A test
 * then examines only the handful of edges in one band instead of thousands.
 * This is exact — it changes cost, not the answer.
 */
function prep(rings: [number, number][][]): Ring[] {
  return rings.map((pts) => {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [x, y] of pts) {
      if (x < minLon) minLon = x;
      if (x > maxLon) maxLon = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
    }
    const nBands = Math.max(1, Math.min(BAND_TARGET, Math.ceil(pts.length / 8)));
    const span = Math.max(1e-9, maxLat - minLat);
    const step = span / nBands;
    const lists: number[][] = Array.from({ length: nBands }, () => []);
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i][1], yj = pts[j][1];
      const lo = Math.min(yi, yj), hi = Math.max(yi, yj);
      let b0 = Math.floor((lo - minLat) / step);
      let b1 = Math.floor((hi - minLat) / step);
      if (b0 < 0) b0 = 0;
      if (b1 >= nBands) b1 = nBands - 1;
      for (let b = b0; b <= b1; b++) lists[b].push(i);
    }
    return {
      pts, minLon, maxLon, minLat, maxLat,
      bands: lists.map((l) => Int32Array.from(l)),
      bandLat0: minLat, bandStep: step,
    };
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
  // only edges spanning this latitude can be crossed by the eastward ray
  let bi = Math.floor((lat - r.bandLat0) / r.bandStep);
  if (bi < 0) bi = 0;
  if (bi >= r.bands.length) bi = r.bands.length - 1;
  const band = r.bands[bi];
  let inside = false;
  for (let k = 0; k < band.length; k++) {
    const i = band[k];
    const j = i === 0 ? p.length - 1 : i - 1;
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

/**
 * Is the point within `tol` degrees of this ring's edge?
 *
 * Only edges whose latitude range comes within `tol` of the query can be the
 * nearest, so the search is limited to the bands spanning [lat-tol, lat+tol].
 * Scanning all 4562 India edges on every tolerance check was the single
 * biggest cost in scenario generation (69 us per territory test).
 *
 * Returns early as soon as a qualifying edge is found — the callers only ask
 * "is it near?", never "how near?".
 */
function nearRing(lon: number, lat: number, r: Ring, tol: number): boolean {
  const p = r.pts;
  let b0 = Math.floor((lat - tol - r.bandLat0) / r.bandStep);
  let b1 = Math.floor((lat + tol - r.bandLat0) / r.bandStep);
  if (b0 < 0) b0 = 0;
  if (b1 >= r.bands.length) b1 = r.bands.length - 1;
  const tol2 = tol * tol;
  for (let b = b0; b <= b1; b++) {
    const band = r.bands[b];
    for (let k = 0; k < band.length; k++) {
      const i = band[k];
      const j = i === 0 ? p.length - 1 : i - 1;
      const ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((lon - ax) * dx + (lat - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = lon - (ax + t * dx), ey = lat - (ay + t * dy);
      if (ex * ex + ey * ey <= tol2) return true;
    }
  }
  return false;
}

/**
 * Territory test with a small coastal tolerance band.
 *
 * HISTORY: this band used to be 0.08 deg (~9 km) to compensate for borders
 * simplified to a 30 km mean segment, which cut the corners off peninsulas
 * and reported genuinely inland places (Colaba, Chennai Marina) as "outside".
 * That was a fudge covering for bad geometry, and a 9 km slop around the
 * entire frontier is dangerous in a tool that decides what is sovereign soil.
 *
 * The border is now built at a 0.004 deg tolerance (mean segment 5.0 km) from
 * the Natural Earth India-POV edition, and 8 of the 9 hardest coastal
 * reference points pass STRICT point-in-polygon with no tolerance at all.
 * The band is therefore reduced to 0.02 deg (~2 km), which still absorbs the
 * residual simplification error on places like the Dwarka spit while being
 * far too small to admit foreign territory or open sea.
 */
export function inCountryTolerant(lat: number, lon: number, iso = 'IND', tolDeg = 0.02): boolean {
  const rings = ringsFor(iso);
  for (const r of rings) if (inRing(lon, lat, r)) return true;
  for (const r of rings) {
    if (lon < r.minLon - tolDeg || lon > r.maxLon + tolDeg ||
        lat < r.minLat - tolDeg || lat > r.maxLat + tolDeg) continue;
    if (nearRing(lon, lat, r, tolDeg)) return true;
  }
  return false;
}

/** Default territory test used across the app. */
/** Neighbours whose territory must never be mistaken for Indian soil. */
const NEIGHBOURS = ['PAK', 'CHN', 'BGD', 'NPL', 'BTN', 'MMR', 'LKA', 'AFG'];

/**
 * Default territory test used across the app.
 *
 * The tolerance band exists to rescue points that a simplified coastline
 * wrongly excludes — but a band is blind to WHICH side of the frontier it
 * reaches across. On the intricate Tripura border it was accepting a point
 * that is STRICTLY INSIDE BANGLADESH, and a battery was sited there. An
 * air-defence unit cannot be deployed on foreign territory.
 *
 * So the band is only honoured when the point is not strictly inside a
 * neighbour. Strict containment in India always wins (enclaves and the
 * India-POV depiction of J&K are genuinely Indian), and the tolerance is
 * reserved for what it was meant for: coastline, not land frontier.
 */
export const inIndia = (lat: number, lon: number): boolean => {
  if (inCountry(lat, lon, 'IND')) return true;
  for (const iso of NEIGHBOURS) if (inCountry(lat, lon, iso)) return false;
  return inCountryTolerant(lat, lon, 'IND');
};

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
    /* Use the SAME tolerance the rest of the app uses for "is this India".
     * Must match inCountryTolerant's default, or launch points sit in the
     * gap between the two tests and the territory audit flags them as
     * hostile fire originating on Indian soil. Observed on the intricate
     * Mizoram-Myanmar border. */
    const out = !inCountryTolerant(p.lat, p.lon, 'IND', 0.02);
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
    if (inCountryTolerant(o.lat, o.lon, 'IND', 0.02)) return null;    // final guard
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
