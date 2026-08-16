// InterceptIQ
import { makeRng } from './rng';
import { INTERCEPTORS, type InterceptorSpec } from './systems';
import { SECTORS, THEATRES } from './theatre';
import { findSite } from './siting';


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
 * Border sectors — shortest warning time, densest coverage.
 * Rajasthan, Gujarat, Haryana, Punjab, J&K / Ladakh and the Uttarakhand hills.
 */
const BORDER = new Set([
  'AMR', 'LDH', 'JAL', 'PTH', 'JMU', 'SGR', 'LEH',   // Punjab + J&K
  'JAI', 'JOD', 'BIK', 'BAR',                        // Rajasthan
  'BHU', 'JAM', 'AHM',                               // Gujarat
  'AMB', 'HIS',                                      // Haryana
  'DDN',                                             // Uttarakhand
]);

/**
 * Layer template. Border sectors receive a long-range layer plus a doubled
 * medium/point-defence tier, because a threat crossing the frontier gives the
 * defender far less time than one detected deep inside national airspace.
 */
function templateFor(value: number, id: string): string[] {
  const border = BORDER.has(id);
  if (value >= 10) return ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER'];
  if (value >= 9)  return border
    ? ['S400', 'AAD', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER']
    : ['S400', 'MRSAM', 'AKASH', 'SPYDER'];
  if (value >= 8)  return border
    ? ['S400', 'MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER']
    : ['MRSAM', 'AKASH', 'SPYDER', 'QRSAM'];
  return border
    ? ['MRSAM', 'AKASH', 'AKASH', 'QRSAM', 'SPYDER']
    : ['AKASH', 'QRSAM', 'PECHORA'];
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
    const arcMid = theatre
      ? ((theatre.threatArc[0] + (theatre.threatArc[1] < theatre.threatArc[0]
          ? theatre.threatArc[1] + 360 : theatre.threatArc[1])) / 2) % 360
      : 270;

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

  return { batteries, radars };
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
