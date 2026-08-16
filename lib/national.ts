// InterceptIQ
import { makeRng } from './rng';
import { INTERCEPTORS, type InterceptorSpec } from './systems';
import { SECTORS, THEATRES, region } from './theatre';
import { findSite, type SitePoint } from './siting';
import { inIndia } from './border';


/**
 * NATIONAL AIR-DEFENCE LAYDOWN
 * ============================
 * A deterministic, seeded disposition of REAL system types across the REAL
 * defended sectors. Each sector gets a layered mix appropriate to its value:
 * high-value sectors receive a long-range layer plus medium and point defence;
 * lower-value sectors receive medium/point defence only.
 *
 * The SYSTEM TYPES and their specifications are real and sourced
 * (see lib/systems.ts). Every POSITION and UNIT DESIGNATOR is fictional —
 * no real installation is represented.
 */

export interface NationalBattery {
  id: string;
  unit: string;
  systemId: string;
  spec: InterceptorSpec;
  sectorId: string;
  sectorName: string;
  lat: number;
  lon: number;
  bearingFromSector: number;
  standoffKm: number;
  rounds: number;
  active: boolean;
  layer: 'Long-range' | 'Medium-range' | 'Point defence' | 'BMD';
  /** Which frontier this battery answers to. */
  front: Front;
}

export interface NationalRadar {
  id: string;
  name: string;
  type: string;
  sectorId: string;
  lat: number;
  lon: number;
  detectKm: number;
  band: string;
  role: string;
}

const UNITS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'Kilo', 'Lima', 'Mike', 'November'];

/**
 * FRONTS
 * ======
 * The laydown is no longer western-only. Every land and maritime frontier gets
 * its own posture, because the threat each faces is genuinely different and
 * the systems India has publicly fielded on each differ accordingly.
 *
 *   WEST      Pakistan. Shortest warning, ballistic + cruise + drone
 *             saturation. Densest layering, full BMD tier.
 *   NORTH     China / LAC, high-altitude. Long-range + high-ceiling systems;
 *             point defence matters less at 4 km elevation.
 *   EAST      Siliguri Corridor, Bangladesh, Myanmar. India has publicly
 *             deployed S-400, MR-SAM and Akash into the Siliguri sector.
 *   MARITIME  Bay of Bengal, Palk Strait, Andamans. Sea-skimming cruise and
 *             long-endurance UAV, so low-altitude capable systems dominate.
 *   INTERIOR  Depth sectors with warning time; leaner posture.
 */
export type Front = 'WEST' | 'NORTH' | 'EAST' | 'MARITIME' | 'INTERIOR';

export const FRONT_OF: Record<string, Front> = {
  // Pakistan frontier
  AMR: 'WEST', LDH: 'WEST', JAL: 'WEST', PTH: 'WEST', JMU: 'WEST', SGR: 'WEST',
  JAI: 'WEST', JOD: 'WEST', BIK: 'WEST', BAR: 'WEST',
  BHU: 'WEST', JAM: 'WEST', AHM: 'WEST', AMB: 'WEST', HIS: 'WEST',
  // China / LAC
  LEH: 'NORTH', DDN: 'NORTH', TAW: 'NORTH', GTK: 'NORTH',
  // Eastern frontier — Siliguri, Bangladesh, Myanmar
  SIL: 'EAST', GAU: 'EAST', TEZ: 'EAST', SHL: 'EAST', AGT: 'EAST',
  IMP: 'EAST', DIB: 'EAST', KOL: 'EAST',
  // Maritime
  VTZ: 'MARITIME', BBS: 'MARITIME', CHN: 'MARITIME', MDU: 'MARITIME',
  TVM: 'MARITIME', PBL: 'MARITIME', MUM: 'MARITIME',
  // Depth
  DEL: 'INTERIOR', LKO: 'INTERIOR', BLR: 'INTERIOR', HYD: 'INTERIOR',
};

export const frontOf = (id: string): Front => FRONT_OF[id] ?? 'INTERIOR';

export const FRONT_LABEL: Record<Front, string> = {
  WEST: 'Western frontier — Pakistan',
  NORTH: 'Northern frontier — China / LAC',
  EAST: 'Eastern frontier — Siliguri, Bangladesh, Myanmar',
  MARITIME: 'Maritime frontier — Bay of Bengal, Palk Strait, Andamans',
  INTERIOR: 'Interior depth sectors',
};

/**
 * Layer template, chosen by front and by the value of the sector. Frontier
 * sectors receive a long-range layer plus a doubled medium/point-defence
 * tier, because a threat crossing the frontier gives the defender far less
 * time than one detected deep inside national airspace.
 */
function templateFor(value: number, id: string): string[] {
  const front = frontOf(id);

  switch (front) {
    /* Pakistan front: the full stack. Ballistic threat is real, so the BMD
     * tier is present at high-value sectors; drone saturation means two
     * point-defence units per sector. */
    case 'WEST':
      if (value >= 9) return ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER'];
      if (value >= 8) return ['S400', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER'];
      return ['MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER'];

    /* LAC: high terrain, long approach, thin air. Reach and ceiling matter
     * more than magazine depth; Akash-Prime was trialled in Ladakh precisely
     * for this. Fewer, longer-reaching units. */
    case 'NORTH':
      if (value >= 8) return ['S400', 'MRSAM', 'AKASH', 'QRSAM'];
      return ['MRSAM', 'AKASH', 'QRSAM'];

    /* Eastern frontier. S-400 in the Siliguri sector is publicly reported,
     * alongside MR-SAM and Akash; the corridor is only ~22 km wide so its
     * defence is dense out of proportion to its population. */
    case 'EAST':
      if (value >= 9) return ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER'];
      if (value >= 8) return ['S400', 'MRSAM', 'AKASH', 'QRSAM', 'SPYDER'];
      return ['MRSAM', 'AKASH', 'QRSAM', 'SPYDER'];

    /* Maritime: sea-skimmers and UAV. Low-altitude-capable systems
     * (MR-SAM down to 50 m, SPYDER to 20 m, QRSAM to 30 m) do the work;
     * a high-ceiling BMD tier would be spent on a threat that never climbs. */
    case 'MARITIME':
      if (value >= 9) return ['S400', 'MRSAM', 'MRSAM', 'AKASH', 'SPYDER', 'QRSAM'];
      if (value >= 8) return ['MRSAM', 'MRSAM', 'AKASH', 'SPYDER', 'QRSAM'];
      return ['MRSAM', 'AKASH', 'SPYDER', 'QRSAM'];

    /* Depth: warning time is measured in minutes, not seconds. */
    default:
      if (value >= 10) return ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER'];
      if (value >= 9) return ['S400', 'MRSAM', 'AKASH', 'SPYDER'];
      if (value >= 8) return ['MRSAM', 'AKASH', 'SPYDER', 'QRSAM'];
      return ['AKASH', 'QRSAM', 'PECHORA'];
  }
}

const layerOf = (role: InterceptorSpec['role']): NationalBattery['layer'] =>
  role === 'LR-SAM' ? 'Long-range'
  : role === 'BMD-Exo' || role === 'BMD-Endo' ? 'BMD'
  : role === 'MR-SAM' ? 'Medium-range'
  : 'Point defence';


export interface NationalLaydown {
  batteries: NationalBattery[];
  radars: NationalRadar[];
}

export function buildNationalLaydown(seed = 20260816): NationalLaydown {
  const rng = makeRng(seed);
  const batteries: NationalBattery[] = [];
  const radars: NationalRadar[] = [];
  let u = 0;

  for (const s of SECTORS) {
    const tmpl = templateFor(s.value, s.id);
    // ring the sector, biased toward the nearest threat axis
    const theatre = THEATRES.find((t) => t.sectors.includes(s.id));
    /* Fall back to the front's own axis rather than a hardcoded 270°, which
     * would have faced every eastern and southern battery back at Pakistan. */
    const FRONT_AXIS: Record<Front, number> = {
      WEST: 270, NORTH: 10, EAST: 80, MARITIME: 135, INTERIOR: 300,
    };
    const arcMid = theatre
      ? ((theatre.threatArc[0] + (theatre.threatArc[1] < theatre.threatArc[0]
          ? theatre.threatArc[1] + 360 : theatre.threatArc[1])) / 2) % 360
      : FRONT_AXIS[frontOf(s.id)];

    tmpl.forEach((sysId, i) => {
      const spec = INTERCEPTORS.find((x) => x.id === sysId)!;
      // spread around the threat axis; longer-range systems sit further back
      const spread = 128;
      const bear = (arcMid - spread / 2 + (spread * (i + 0.5)) / tmpl.length + 360) % 360;
      const standoff = Math.min(
        spec.rangeKm[1] * rng.range(0.16, 0.34),
        s.radiusKm + 62
      );
      /* Site on national soil and dispersed from every battery already placed
       * anywhere in the country — not just this sector — so neighbouring
       * sectors' units do not end up stacked on a shared boundary. */
      const site = findSite({
        anchor: { lat: s.lat, lon: s.lon },
        arc: [bear - 55, bear + 55],
        standoffKm: standoff,
        minSepKm: Math.max(22, Math.min(spec.rangeKm[1] * 0.32, 90)),
        placed: batteries.map((b) => ({ lat: b.lat, lon: b.lon })),
        rnd: rng.next,
      });
      const lat = site.lat, lon = site.lon;
      batteries.push({
        id: `${s.id}-B${i + 1}`,
        unit: UNITS[u++ % UNITS.length],
        systemId: sysId,
        spec,
        sectorId: s.id,
        sectorName: s.name,
        lat: +lat.toFixed(5),
        lon: +lon.toFixed(5),
        bearingFromSector: +bear.toFixed(0),
        standoffKm: +standoff.toFixed(1),
        rounds: spec.readyRounds,
        active: true,
        layer: layerOf(spec.role),
        front: frontOf(s.id),
      });
    });

    // one surveillance radar per sector, sited near the centre
    const best = tmpl
      .map((id) => INTERCEPTORS.find((x) => x.id === id)!)
      .sort((a, b) => b.radarDetectKm - a.radarDetectKm)[0];
    const rb = (arcMid + rng.range(-40, 40) + 360) % 360;
    const rsite = findSite({
      anchor: { lat: s.lat, lon: s.lon },
      arc: [rb - 60, rb + 60],
      standoffKm: rng.range(8, 20),
      minSepKm: 14,
      placed: radars.map((r) => ({ lat: r.lat, lon: r.lon })),
      rnd: rng.next,
    });
    radars.push({
      id: `${s.id}-R1`,
      name: `${s.name} Surveillance`,
      type: best.radar.split('(')[0].split('+')[0].trim(),
      sectorId: s.id,
      lat: +rsite.lat.toFixed(5),
      lon: +rsite.lon.toFixed(5),
      detectKm: best.radarDetectKm,
      band: best.radarDetectKm >= 500 ? 'S/L-band phased array'
        : best.radarDetectKm >= 200 ? 'S-band AESA'
        : 'X-band multi-function',
      role: best.radarDetectKm >= 500 ? 'Early warning + battle management'
        : 'Acquisition + fire control',
    });
  }

  /* ---------------------------------------------------------------- *
   * FRONTIER FIRE-UNIT GAP FILL
   * ----------------------------------------------------------------
   * Sector batteries defend cities, so like the radars they leave real
   * frontier uncovered. Measured on the sector-only laydown, 15.7% of the
   * borderline sat outside EVERY interceptor envelope — the Nicobars, the
   * Andaman chain, the Kerala/Karnataka coast, the Mizoram salient and long
   * Himalayan stretches. A leaker crossing there meets nothing.
   *
   * This plants MR-SAM fire units (100 km, 50 m floor — the right compromise
   * for coastal and mountain approaches, and the system India is fielding
   * most widely) wherever the frontier is unengageable, re-testing as it
   * goes so it only adds what is genuinely needed.
   * ---------------------------------------------------------------- */
  const gapSpec = INTERCEPTORS.find((x) => x.id === 'MRSAM')!;
  const engaged = (p: SitePoint) =>
    batteries.some((b) => b.active && haversineKm(p, b) <= b.spec.rangeKm[1]);

  let gapN = 0;
  for (const p of borderSamples(70)) {
    if (engaged(p)) continue;
    // sit back from the line so the envelope straddles the frontier
    const site = pullInland(p, gapSpec.rangeKm[1] * 0.35) ??
      (inIndia(p.lat, p.lon) ? p : null);
    if (!site) continue;
    gapN++;
    const sid = nearestSectorId(site);
    const sec = SECTORS.find((s) => s.id === sid)!;
    batteries.push({
      id: `FRN-B${gapN}`,
      unit: `Frontier ${gapN}`,
      systemId: gapSpec.id,
      spec: gapSpec,
      sectorId: sid,
      sectorName: sec.name,
      lat: +site.lat.toFixed(5),
      lon: +site.lon.toFixed(5),
      bearingFromSector: 0,
      standoffKm: +haversineKm(site, { lat: sec.lat, lon: sec.lon }).toFixed(1),
      rounds: gapSpec.readyRounds,
      active: true,
      layer: layerOf(gapSpec.role),
      front: frontOf(sid),
    });
  }

  /* ---------------------------------------------------------------- *
   * FRONTIER EARLY-WARNING CHAIN
   * ----------------------------------------------------------------
   * Sector radars are sited to defend cities, so coverage follows the
   * population map — which leaves real frontier with nothing looking at it.
   * Measured on the sector-only laydown: 3.1% of the national borderline was
   * outside every radar horizon, the worst gap being Great Nicobar at 305 km
   * beyond the nearest set. An air-defence network with a 305 km hole is not
   * a network.
   *
   * This pass walks the actual border ring and plants an EW radar wherever a
   * sample point is uncovered, then re-tests, until the whole frontier is
   * inside somebody's horizon. Sites are pulled slightly inland and are
   * required to be on national soil like any other unit.
   *
   * These are surveillance sets, not fire units — they generate the track
   * picture that cues the batteries, which is exactly how the real IACCS /
   * Akashteer grid is described in open sources.
   * ---------------------------------------------------------------- */
  const EW_RANGE = 450;              // Swordfish/LRTR-class early warning
  const border = borderSamples(60);  // ~60 km spacing around the whole ring
  const covered = (p: SitePoint) =>
    radars.some((r) => haversineKm(p, r) <= r.detectKm);

  let ewN = 0;
  for (const p of border) {
    if (covered(p)) continue;
    /* Pull the site inland from the frontier so it is defensible and on
     * soil — a radar sitting exactly on the border line is neither. */
    const site = pullInland(p, 45) ?? (inIndia(p.lat, p.lon) ? p : null);
    if (!site) continue;
    ewN++;
    radars.push({
      id: `EW-${String(ewN).padStart(2, '0')}`,
      name: `Frontier EW ${ewN}`,
      type: 'Long-range early-warning array',
      sectorId: nearestSectorId(site),
      lat: +site.lat.toFixed(5),
      lon: +site.lon.toFixed(5),
      detectKm: EW_RANGE,
      band: 'S/L-band phased array',
      role: 'Frontier early warning — feeds the national track picture',
    });
  }

  return { batteries, radars };
}

const D2R = Math.PI / 180;
function haversineKm(a: SitePoint, b: { lat: number; lon: number }) {
  return Math.hypot(
    (b.lat - a.lat) * 110.574,
    (b.lon - a.lon) * 111.32 * Math.cos(a.lat * D2R)
  );
}

/** Nearest defended sector, used to file an EW set under a command. */
function nearestSectorId(p: SitePoint): string {
  let best = SECTORS[0], bd = Infinity;
  for (const s of SECTORS) {
    const d = haversineKm(p, { lat: s.lat, lon: s.lon });
    if (d < bd) { bd = d; best = s; }
  }
  return best.id;
}

/**
 * Walk the Indian border ring and return sample points at roughly `stepKm`
 * spacing. This is the same geometry the territory tests use, so coverage is
 * measured against the real frontier rather than a bounding box.
 */
function borderSamples(stepKm: number): SitePoint[] {
  const ind = region.countries.find((c) => c.iso === 'IND');
  if (!ind) return [];
  const out: SitePoint[] = [];
  for (const ring of ind.rings) {
    for (let i = 1; i < ring.length; i++) {
      const [x0, y0] = ring[i - 1], [x1, y1] = ring[i];
      const seg = Math.hypot(
        (x1 - x0) * 111.32 * Math.cos(y0 * D2R), (y1 - y0) * 110.574
      );
      const n = Math.max(1, Math.ceil(seg / stepKm));
      for (let k = 0; k < n; k++) {
        const f = k / n;
        out.push({ lat: y0 + (y1 - y0) * f, lon: x0 + (x1 - x0) * f });
      }
    }
  }
  return out;
}

/**
 * Step inward from a frontier point until the position is comfortably on
 * national soil. Tries progressively shorter offsets and every bearing, so
 * narrow salients and small islands still yield a site.
 */
function pullInland(p: SitePoint, km: number): SitePoint | null {
  for (const d of [km, km * 0.6, km * 0.3, km * 0.12, 0]) {
    for (let b = 0; b < 360; b += 15) {
      const th = b * D2R;
      const q = {
        lat: p.lat + (d * Math.cos(th)) / 110.574,
        lon: p.lon + (d * Math.sin(th)) / (111.32 * Math.cos(p.lat * D2R)),
      };
      if (inIndia(q.lat, q.lon)) return q;
    }
  }
  return null;
}

/** Aggregate a laydown by frontier, for the national dashboard. */
export function frontStats(lay: NationalLaydown) {
  const fronts: Front[] = ['WEST', 'NORTH', 'EAST', 'MARITIME', 'INTERIOR'];
  return fronts.map((f) => {
    const b = lay.batteries.filter((x) => x.front === f && x.active);
    const sectors = new Set(b.map((x) => x.sectorId));
    return {
      front: f,
      label: FRONT_LABEL[f],
      batteries: b.length,
      sectors: sectors.size,
      rounds: b.reduce((a, x) => a + x.rounds, 0),
      types: Array.from(new Set(b.map((x) => x.spec.name))).sort(),
      maxRangeKm: Math.max(0, ...b.map((x) => x.spec.rangeKm[1])),
    };
  }).filter((x) => x.batteries > 0);
}

/** Aggregate coverage statistics for a sector. */
export function sectorStats(lay: NationalLaydown, sectorId: string) {
  const b = lay.batteries.filter((x) => x.sectorId === sectorId);
  const r = lay.radars.filter((x) => x.sectorId === sectorId);
  return {
    batteries: b.length,
    rounds: b.reduce((a, x) => a + (x.active ? x.rounds : 0), 0),
    maxRangeKm: Math.max(0, ...b.filter((x) => x.active).map((x) => x.spec.rangeKm[1])),
    maxAltM: Math.max(0, ...b.filter((x) => x.active).map((x) => x.spec.altM[1])),
    radarKm: Math.max(0, ...r.map((x) => x.detectKm)),
    layers: Array.from(new Set(b.filter((x) => x.active).map((x) => x.layer))),
    offline: b.filter((x) => !x.active).length,
  };
}
