// InterceptIQ
import reg from './region.json';

export interface Region {
  window: { w: number; s: number; e: number; n: number };
  countries: { name: string; iso: string; rings: [number, number][][] }[];
  coast: [number, number][][];
  cities: { n: string; x: number; y: number; pop: number; iso: string }[];
  /** Admin-1 units: Indian states/UTs, Pakistani & Chinese provinces, etc.
   *  n = name, iso = parent country, r = rings, c = label centroid, a = area */
  admin1: { n: string; iso: string; r: [number, number][][]; c: [number, number]; a: number }[];
  /** Hand-placed country label anchors so text sits in open space. */
  countryLabels: { n: string; iso: string; c: [number, number]; s: number }[];
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

  // ---- Northwestern border belt: Rajasthan, Gujarat, Haryana, Punjab,
  // ---- J&K and the Uttarakhand hill sector. These are the shortest-warning
  // ---- approaches, so they carry the densest interceptor coverage.
  { id: 'JOD', name: 'Jodhpur',     lat: 26.2389, lon: 73.0243, radiusKm: 20, value: 8,  pop: 1_138_000, kind: 'Rajasthan — forward air base sector' },
  { id: 'BIK', name: 'Bikaner',     lat: 28.0229, lon: 73.3119, radiusKm: 17, value: 7,  pop: 644_000,   kind: 'Rajasthan — desert border sector' },
  { id: 'BAR', name: 'Barmer',      lat: 25.7521, lon: 71.3967, radiusKm: 16, value: 7,  pop: 100_000,   kind: 'Rajasthan — western desert frontier' },
  { id: 'BHU', name: 'Bhuj–Kutch',  lat: 23.2420, lon: 69.6669, radiusKm: 18, value: 8,  pop: 213_000,   kind: 'Gujarat — Kutch coastal frontier' },
  { id: 'JAM', name: 'Jamnagar',    lat: 22.4707, lon: 70.0577, radiusKm: 18, value: 8,  pop: 615_000,   kind: 'Gujarat — refinery & naval air complex' },
  { id: 'AMB', name: 'Ambala',      lat: 30.3752, lon: 76.7821, radiusKm: 17, value: 8,  pop: 208_000,   kind: 'Haryana — forward air base sector' },
  { id: 'HIS', name: 'Hisar',       lat: 29.1492, lon: 75.7217, radiusKm: 16, value: 7,  pop: 301_000,   kind: 'Haryana — Delhi western approach' },
  { id: 'LDH', name: 'Ludhiana',    lat: 30.9010, lon: 75.8573, radiusKm: 18, value: 8,  pop: 1_618_000, kind: 'Punjab — industrial belt' },
  { id: 'JAL', name: 'Jalandhar',   lat: 31.3260, lon: 75.5762, radiusKm: 16, value: 7,  pop: 873_000,   kind: 'Punjab — forward corps sector' },
  { id: 'PTH', name: 'Pathankot',   lat: 32.2643, lon: 75.6421, radiusKm: 16, value: 8,  pop: 159_000,   kind: 'Punjab — J&K gateway' },
  { id: 'SGR', name: 'Srinagar',    lat: 34.0837, lon: 74.7973, radiusKm: 18, value: 9,  pop: 1_620_000, kind: 'J&K — Kashmir valley' },
  { id: 'JMU', name: 'Jammu',       lat: 32.7266, lon: 74.8570, radiusKm: 17, value: 8,  pop: 651_000,   kind: 'J&K — southern approach' },
  { id: 'LEH', name: 'Leh',         lat: 34.1526, lon: 77.5771, radiusKm: 16, value: 8,  pop: 30_000,    kind: 'Ladakh — high-altitude sector' },
  { id: 'DDN', name: 'Dehradun',    lat: 30.3165, lon: 78.0322, radiusKm: 16, value: 7,  pop: 803_000,   kind: 'Uttarakhand — hill border sector' },

  // ---- Eastern & northeastern frontier: the Siliguri Corridor, the
  // ---- Brahmaputra valley and the LAC facing Tibet, plus the Bangladesh
  // ---- and Myanmar frontiers. India has publicly deployed S-400, MR-SAM
  // ---- and Akash into this theatre; it is no longer a western-only problem.
  { id: 'SIL', name: 'Siliguri Corridor', lat: 26.7271, lon: 88.3953, radiusKm: 20, value: 10, pop: 706_000,   kind: "West Bengal — the 22 km 'Chicken's Neck' land bridge" },
  { id: 'GAU', name: 'Guwahati',    lat: 26.1445, lon: 91.7362, radiusKm: 20, value: 9,  pop: 1_120_000, kind: 'Assam — Brahmaputra valley hub' },
  { id: 'TEZ', name: 'Tezpur',      lat: 26.6528, lon: 92.7926, radiusKm: 17, value: 8,  pop: 103_000,   kind: 'Assam — forward air base, LAC sector' },
  { id: 'TAW', name: 'Tawang',      lat: 27.5860, lon: 91.8590, radiusKm: 15, value: 8,  pop: 11_000,    kind: 'Arunachal — high-altitude LAC sector' },
  { id: 'GTK', name: 'Gangtok',     lat: 27.3314, lon: 88.6138, radiusKm: 15, value: 8,  pop: 100_000,   kind: 'Sikkim — Nathu La / Doklam approach' },
  { id: 'SHL', name: 'Shillong',    lat: 25.5788, lon: 91.8933, radiusKm: 16, value: 7,  pop: 354_000,   kind: 'Meghalaya — eastern air command sector' },
  { id: 'AGT', name: 'Agartala',    lat: 23.8315, lon: 91.2868, radiusKm: 15, value: 7,  pop: 522_000,   kind: 'Tripura — Bangladesh frontier salient' },
  { id: 'IMP', name: 'Imphal',      lat: 24.8170, lon: 93.9368, radiusKm: 16, value: 7,  pop: 518_000,   kind: 'Manipur — Myanmar frontier sector' },
  { id: 'DIB', name: 'Dibrugarh',   lat: 27.4728, lon: 94.9120, radiusKm: 16, value: 7,  pop: 154_000,   kind: 'Assam — upper Brahmaputra, oil & rail hub' },

  // ---- Peninsular & maritime south: the Sri Lanka narrows, the Kerala coast
  // ---- and the Bay of Bengal seaboard. Threats here are sea-launched cruise
  // ---- and long-endurance UAV rather than ballistic.
  { id: 'BBS', name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245, radiusKm: 18, value: 7,  pop: 1_163_000, kind: 'Odisha — Bay of Bengal seaboard, test range belt' },
  { id: 'VTZ', name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185, radiusKm: 19, value: 9, pop: 2_358_000, kind: 'Andhra — Eastern Naval Command' },
  { id: 'MDU', name: 'Madurai',     lat: 9.9252,  lon: 78.1198, radiusKm: 16, value: 7,  pop: 1_561_000, kind: 'Tamil Nadu — Palk Strait / Sri Lanka narrows' },
  { id: 'TVM', name: 'Thiruvananthapuram', lat: 8.5241, lon: 76.9366, radiusKm: 17, value: 8, pop: 1_688_000, kind: 'Kerala — southern tip, space & naval complex' },
  { id: 'PBL', name: 'Port Blair',  lat: 11.6234, lon: 92.7265, radiusKm: 15, value: 8,  pop: 141_000,   kind: 'Andaman & Nicobar — tri-service island command' },
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
  {
    id: 'PB', name: 'Punjab & J&K Border', sub: 'Amritsar · Ludhiana · Pathankot · Jammu',
    sectors: ['AMR', 'LDH', 'JAL', 'PTH', 'JMU'],
    centre: { lat: 31.6, lon: 75.2 }, spanKm: 620,
    threatArc: [230, 330], originLabel: 'Western border approach',
  },
  {
    id: 'RAJ', name: 'Rajasthan Desert Frontier', sub: 'Jaipur · Jodhpur · Bikaner · Barmer',
    sectors: ['JAI', 'JOD', 'BIK', 'BAR'],
    centre: { lat: 26.6, lon: 73.4 }, spanKm: 760,
    threatArc: [240, 320], originLabel: 'Western desert approach',
  },
  {
    id: 'GUJ', name: 'Gujarat Coastal Frontier', sub: 'Bhuj–Kutch · Jamnagar · Ahmedabad',
    sectors: ['BHU', 'JAM', 'AHM'],
    centre: { lat: 23.0, lon: 70.9 }, spanKm: 700,
    threatArc: [250, 340], originLabel: 'Northwestern maritime approach',
  },
  {
    id: 'HIM', name: 'Himalayan Northern Sector', sub: 'Srinagar · Leh · Dehradun',
    sectors: ['SGR', 'LEH', 'DDN'],
    centre: { lat: 32.8, lon: 76.5 }, spanKm: 820,
    threatArc: [300, 80], originLabel: 'Northern high-altitude approach',
  },
  {
    id: 'NCR', name: 'Delhi Approach Belt', sub: 'Delhi NCR · Ambala · Hisar · Jaipur',
    sectors: ['DEL', 'AMB', 'HIS', 'JAI'],
    centre: { lat: 29.2, lon: 76.4 }, spanKm: 620,
    threatArc: [235, 325], originLabel: 'Western approach to the capital',
  },
  {
    id: 'SILI', name: 'Siliguri Corridor', sub: "Siliguri · Gangtok · Kolkata — the Chicken's Neck",
    sectors: ['SIL', 'GTK', 'KOL'],
    centre: { lat: 26.2, lon: 88.2 }, spanKm: 640,
    threatArc: [340, 130], originLabel: 'Tibet / Bangladesh convergent approach',
  },
  {
    id: 'NE', name: 'Northeastern Theatre', sub: 'Guwahati · Tezpur · Shillong · Dibrugarh',
    sectors: ['GAU', 'TEZ', 'SHL', 'DIB'],
    centre: { lat: 26.5, lon: 92.6 }, spanKm: 780,
    threatArc: [300, 60], originLabel: 'Northern LAC approach',
  },
  {
    id: 'LAC', name: 'Eastern LAC — Arunachal', sub: 'Tawang · Tezpur · Dibrugarh',
    sectors: ['TAW', 'TEZ', 'DIB'],
    centre: { lat: 27.5, lon: 93.4 }, spanKm: 720,
    threatArc: [320, 70], originLabel: 'Trans-Himalayan approach',
  },
  {
    id: 'BGD', name: 'Bangladesh Frontier', sub: 'Agartala · Shillong · Kolkata',
    sectors: ['AGT', 'SHL', 'KOL'],
    centre: { lat: 24.4, lon: 90.3 }, spanKm: 720,
    threatArc: [120, 260], originLabel: 'Eastern lowland approach',
  },
  {
    id: 'MYN', name: 'Myanmar Frontier', sub: 'Imphal · Aizawl sector · Dibrugarh',
    sectors: ['IMP', 'DIB', 'AGT'],
    centre: { lat: 25.2, lon: 94.0 }, spanKm: 680,
    threatArc: [60, 180], originLabel: 'Eastern hill approach',
  },
  {
    id: 'BAY', name: 'Bay of Bengal Seaboard', sub: 'Visakhapatnam · Bhubaneswar · Chennai',
    sectors: ['VTZ', 'BBS', 'CHN'],
    centre: { lat: 17.5, lon: 84.0 }, spanKm: 820,
    threatArc: [45, 150], originLabel: 'Bay of Bengal maritime approach',
  },
  {
    id: 'SLK', name: 'Palk Strait & Southern Tip', sub: 'Madurai · Thiruvananthapuram · Bengaluru',
    sectors: ['MDU', 'TVM', 'BLR'],
    centre: { lat: 10.5, lon: 77.8 }, spanKm: 700,
    threatArc: [100, 220], originLabel: 'Sri Lanka narrows / Indian Ocean approach',
  },
  {
    id: 'AND', name: 'Andaman & Nicobar Command', sub: 'Port Blair · island chain',
    sectors: ['PBL'],
    centre: { lat: 11.6, lon: 92.7 }, spanKm: 620,
    threatArc: [40, 200], originLabel: 'Andaman Sea / Malacca approach',
  },
];

export const sectorById = (id: string) => SECTORS.find((s) => s.id === id)!;
