import reg from './region.json';

export interface Region {
  window: { w: number; s: number; e: number; n: number };
  countries: { name: string; iso: string; rings: [number, number][][] }[];
  coast: [number, number][][];
  cities: { n: string; x: number; y: number; pop: number; iso: string }[];
}
export const region = reg as unknown as Region;

/**
 * Defended sectors — real Indian cities with real coordinates and real
 * populations, used as the value-bearing assets a battery network protects.
 * Choosing genuine cities makes the geometry meaningful; the AIR DEFENCE
 * DEPLOYMENTS around them in this tool are fictional.
 */
export interface Sector {
  id: string; name: string; lat: number; lon: number;
  radiusKm: number; value: number; pop: number; kind: string;
}

export const SECTORS: Sector[] = [
  { id: 'DEL', name: 'Delhi NCR',   lat: 28.6139, lon: 77.2090, radiusKm: 34, value: 10, pop: 32_226_000, kind: 'National capital region' },
  { id: 'MUM', name: 'Mumbai',      lat: 19.0760, lon: 72.8777, radiusKm: 26, value: 10, pop: 21_297_000, kind: 'Financial centre / naval command' },
  { id: 'AMR', name: 'Amritsar',    lat: 31.6340, lon: 74.8723, radiusKm: 17, value: 8,  pop: 1_183_000,  kind: 'Forward sector, western border' },
  { id: 'AHM', name: 'Ahmedabad',   lat: 23.0225, lon: 72.5714, radiusKm: 22, value: 8,  pop: 8_450_000,  kind: 'Industrial hub' },
  { id: 'JAI', name: 'Jaipur',      lat: 26.9124, lon: 75.7873, radiusKm: 19, value: 7,  pop: 3_900_000,  kind: 'Regional command' },
  { id: 'LKO', name: 'Lucknow',     lat: 26.8467, lon: 80.9462, radiusKm: 19, value: 7,  pop: 3_680_000,  kind: 'Central sector' },
  { id: 'BLR', name: 'Bengaluru',   lat: 12.9716, lon: 77.5946, radiusKm: 22, value: 9,  pop: 13_608_000, kind: 'Aerospace / R&D concentration' },
  { id: 'CHN', name: 'Chennai',     lat: 13.0827, lon: 80.2707, radiusKm: 21, value: 8,  pop: 11_324_000, kind: 'Eastern seaboard' },
  { id: 'HYD', name: 'Hyderabad',   lat: 17.3850, lon: 78.4867, radiusKm: 21, value: 8,  pop: 10_268_000, kind: 'Defence manufacturing' },
  { id: 'KOL', name: 'Kolkata',     lat: 22.5726, lon: 88.3639, radiusKm: 22, value: 8,  pop: 15_134_000, kind: 'Eastern command' },
];

/**
 * Theatre presets — each defines a defended sector set and a threat-axis
 * bearing band. Real geography; fictional force laydown.
 */
export interface Theatre {
  id: string; name: string; sub: string;
  sectors: string[];
  /** centre of the map view */
  centre: { lat: number; lon: number };
  spanKm: number;
  /** bearing FROM which threats approach (compass degrees), inclusive band */
  threatArc: [number, number];
  originLabel: string;
}

export const THEATRES: Theatre[] = [
  {
    id: 'NW', name: 'Northwestern Sector', sub: 'Delhi · Amritsar · Jaipur',
    sectors: ['DEL', 'AMR', 'JAI'],
    centre: { lat: 29.0, lon: 75.6 }, spanKm: 720,
    threatArc: [250, 320], originLabel: 'Western approach',
  },
  {
    id: 'W', name: 'Western Seaboard', sub: 'Mumbai · Ahmedabad',
    sectors: ['MUM', 'AHM'],
    centre: { lat: 21.2, lon: 71.8 }, spanKm: 700,
    threatArc: [270, 340], originLabel: 'Northwestern approach',
  },
  {
    id: 'CENTRAL', name: 'Central Corridor', sub: 'Delhi · Lucknow · Jaipur',
    sectors: ['DEL', 'LKO', 'JAI'],
    centre: { lat: 27.5, lon: 78.5 }, spanKm: 700,
    threatArc: [280, 30], originLabel: 'Northern approach',
  },
  {
    id: 'S', name: 'Southern Peninsula', sub: 'Bengaluru · Chennai · Hyderabad',
    sectors: ['BLR', 'CHN', 'HYD'],
    centre: { lat: 14.5, lon: 78.5 }, spanKm: 760,
    threatArc: [60, 140], originLabel: 'Eastern maritime approach',
  },
];

export const sectorById = (id: string) => SECTORS.find((s) => s.id === id)!;
