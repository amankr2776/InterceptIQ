// InterceptIQ
import type { GeoPoint, LocalPoint } from './types';

/** Equirectangular local-tangent-plane projection.
 *  Accurate to well under a metre over a 100x100 km AOI — adequate and
 *  fully deterministic, which is what we want for a solver. */
export const KM_PER_DEG_LAT = 110.574;
export const kmPerDegLon = (lat: number) =>
  111.32 * Math.cos((lat * Math.PI) / 180);

export function toLocal(
  lat: number,
  lon: number,
  alt: number,
  origin: { lat0: number; lon0: number }
): LocalPoint {
  return {
    x: (lon - origin.lon0) * kmPerDegLon(origin.lat0),
    y: (lat - origin.lat0) * KM_PER_DEG_LAT,
    z: alt / 1000,
  };
}

export function toGeo(
  p: { x: number; y: number; z: number },
  origin: { lat0: number; lon0: number }
): GeoPoint {
  return {
    lat: origin.lat0 + p.y / KM_PER_DEG_LAT,
    lon: origin.lon0 + p.x / kmPerDegLon(origin.lat0),
    alt: p.z * 1000,
  };
}

export const dist3 = (a: LocalPoint, b: LocalPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const dist2 = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => Math.hypot(a.x - b.x, a.y - b.y);

/** Centroid of a simple polygon (shoelace). Falls back to mean for degenerate. */
export function polygonCentroid(pts: { lat: number; lon: number }[]) {
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.lon * q.lat - q.lon * p.lat;
    a += f;
    cx += (p.lon + q.lon) * f;
    cy += (p.lat + q.lat) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) {
    return {
      lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    };
  }
  return { lon: cx / (6 * a), lat: cy / (6 * a) };
}

/** Regular-ish polygon footprint around a centre — used to synthesise
 *  deployment areas (PS input b is a polygon, not a point). */
export function makeFootprint(
  latC: number,
  lonC: number,
  radiusKm: number,
  n: number,
  jitter: () => number
) {
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n;
    const r = radiusKm * (0.7 + 0.6 * jitter());
    pts.push({
      lat: latC + (r * Math.sin(th)) / KM_PER_DEG_LAT,
      lon: lonC + (r * Math.cos(th)) / kmPerDegLon(latC),
    });
  }
  return pts;
}
