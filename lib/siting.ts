import { inIndia } from './border';

const KM_LAT = 110.574;
const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

export interface SitePoint { lat: number; lon: number }

export interface SiteRequest {
  /** Sector this battery defends. */
  anchor: SitePoint;
  /** Preferred bearing band to place along (compass degrees, from anchor). */
  arc: [number, number];
  /** Preferred stand-off from the anchor, km. */
  standoffKm: number;
  /** Minimum separation from every already-placed battery, km. */
  minSepKm: number;
  /** Already-placed battery positions to disperse away from. */
  placed: SitePoint[];
  rnd: () => number;
}

/**
 * BATTERY SITING SOLVER
 * =====================
 * Two hard constraints that the old inline placement did not enforce:
 *
 *   1. ON NATIONAL SOIL. Batteries were projected blindly along a bearing at
 *      a stand-off distance. Near a frontier or coastline that put ~9% of them
 *      in Pakistan, China or the sea — an air-defence unit cannot be deployed
 *      on foreign territory.
 *
 *   2. DISPERSED. Placement had no awareness of other batteries, so units
 *      stacked (minimum observed separation 2.4 km). Co-located batteries
 *      share the same engagement geometry, cover no extra area, and are
 *      destroyed by a single strike. Real air defence disperses so envelopes
 *      overlap at the edges rather than sitting on top of one another.
 *
 * Strategy: score candidate points over the preferred arc and a range of
 * stand-offs, rejecting anything off national soil, and maximising distance
 * from already-placed units while staying near the requested geometry.
 * Falls back progressively so a site is always found.
 */
export function findSite(req: SiteRequest): SitePoint {
  const { anchor, arc, standoffKm, minSepKm, placed, rnd } = req;
  const lo = arc[0];
  const hi = arc[1] < arc[0] ? arc[1] + 360 : arc[1];

  const project = (bearing: number, km: number): SitePoint => {
    const th = (bearing * Math.PI) / 180;
    return {
      lat: anchor.lat + (km * Math.cos(th)) / KM_LAT,
      lon: anchor.lon + (km * Math.sin(th)) / kmLon(anchor.lat),
    };
  };

  const sepFrom = (p: SitePoint) => {
    if (!placed.length) return Infinity;
    let best = Infinity;
    for (const q of placed) {
      const d = Math.hypot(
        (p.lat - q.lat) * KM_LAT,
        (p.lon - q.lon) * kmLon(p.lat)
      );
      if (d < best) best = d;
    }
    return best;
  };

  let best: SitePoint | null = null;
  let bestScore = -Infinity;

  /* Sweep the preferred arc at several stand-offs. Bearings are jittered by a
   * seeded value so repeated calls in one scenario do not all pick the same
   * spoke, but the result stays reproducible for a given seed. */
  const jitter = rnd() * 12 - 6;
  for (let b = lo; b <= hi; b += 7) {
    for (const f of [1.0, 0.82, 1.18, 0.66, 1.34, 0.5]) {
      const km = standoffKm * f;
      if (km < 6) continue;
      const p = project(((b + jitter) % 360 + 360) % 360, km);
      if (!inIndia(p.lat, p.lon)) continue;          // hard: must be on national soil

      const sep = sepFrom(p);
      if (sep < minSepKm * 0.55) continue;           // hard: never stack

      /* Score: reward dispersion, penalise drifting from the requested
       * stand-off. Capping the dispersion term stops batteries being flung to
       * the far corner of the theatre just to maximise separation. */
      const dispersion = Math.min(sep, minSepKm * 2.2) / (minSepKm * 2.2);
      const geometry = 1 - Math.min(1, Math.abs(km - standoffKm) / Math.max(standoffKm, 1));
      const score = 0.62 * dispersion + 0.38 * geometry;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  if (best) return best;

  /* Fallback 1 — widen to the full circle, keep the soil constraint. */
  for (let b = 0; b < 360; b += 5) {
    for (const f of [1.0, 0.75, 1.25, 0.5, 1.5]) {
      const p = project(b, standoffKm * f);
      if (!inIndia(p.lat, p.lon)) continue;
      const sep = sepFrom(p);
      const score = Math.min(sep, minSepKm * 2) / (minSepKm * 2);
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  if (best) return best;

  /* Fallback 2 — anywhere on soil close in. */
  for (let b = 0; b < 360; b += 11) {
    for (const km of [14, 22, 30, 40]) {
      const p = project(b, km);
      if (inIndia(p.lat, p.lon)) return p;
    }
  }

  // Last resort: the anchor itself, which is a defended city and always on soil.
  return { lat: anchor.lat, lon: anchor.lon };
}

/** Smallest pairwise separation in a set of sites, km. Used by tests. */
export function minSeparationKm(pts: SitePoint[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(
        (pts[i].lat - pts[j].lat) * KM_LAT,
        (pts[i].lon - pts[j].lon) * kmLon(pts[i].lat)
      );
      if (d < best) best = d;
    }
  }
  return best;
}
