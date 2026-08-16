// CK115 — Core domain types
// PS: "Identification of optimal set of multiple interceptor launch areas
//      to maximise the destruction of multiple air targets"
// Org: Dte of IT & Cyber Security, DRDO

/** Geodetic point as specified by the PS: Latitude, Longitude, Altitude(m). */
export interface GeoPoint {
  lat: number;
  lon: number;
  alt: number; // metres AMSL
}

/** Local tangent-plane (ENU) coordinate in km. Origin = AOI south-west corner. */
export interface LocalPoint {
  x: number; // km east
  y: number; // km north
  z: number; // km up
}

/** One sampled state along a ballistic trajectory. */
export interface TrajectorySample {
  t: number; // seconds from scenario T0
  p: GeoPoint;
  l: LocalPoint;
  speed: number; // m/s
}

export type ThreatClass =
  | 'SRBM'      // short-range ballistic missile
  | 'MRBM'      // medium-range ballistic missile
  | 'TBM'       // tactical ballistic missile
  | 'CRUISE';   // depressed / quasi-ballistic profile

/** PS input (a): "Set of Ballistic Missile Trajectories of targets,
 *  each represented by a point (Latitude, Longitude, Altitude)". */
export interface Threat {
  id: string;
  callsign: string;      // fictional, e.g. "TGT-01"
  cls: ThreatClass;
  /** Real threat-system reference (see lib/systems.ts) */
  systemId: string;
  rvValue: number;       // relative defended-asset value at stake (1..10)
  trajectory: TrajectorySample[];
  impact: { t: number; p: GeoPoint; l: LocalPoint };
  apogeeAlt: number;     // m
  /** Where the attacker fired from (may lie outside the AOI). */
  origin: { p: GeoPoint; l: LocalPoint; name: string };
  bearingDeg: number;    // ground-track heading
  rangeKm: number;       // origin -> impact great-circle-ish ground range
}

/** PS input (b): "Set of multiple locations/areas (polygons of Lat & Lon)
 *  where interceptors are deployed". */
export interface LaunchArea {
  id: string;
  name: string;                 // real system type + fictional unit designator
  /** Real interceptor-system reference (see lib/systems.ts) */
  systemId: string;
  polygon: { lat: number; lon: number }[]; // deployment footprint
  centroid: { lat: number; lon: number };
  centroidLocal: { x: number; y: number };
  interceptorSpeed: number;     // m/s average
  maxSlantRange: number;        // km
  minEngageAlt: number;         // m
  maxEngageAlt: number;         // m
  inventory: number;            // interceptors on rail
  reloadTime: number;           // s
  reactionTime: number;         // s (detect->launch latency)
  active: boolean;              // judge can "destroy" a site => false
}

export interface DefendedAsset {
  id: string;
  name: string;
  centroid: { lat: number; lon: number };
  radiusKm: number;
  value: number;
}

export interface Scenario {
  id: string;
  tier: 'easy' | 'medium' | 'hard' | 'random';
  seed: number;
  theatreId: string;
  aoi: { lat0: number; lon0: number; sizeKm: number };
  threats: Threat[];
  areas: LaunchArea[];
  assets: DefendedAsset[];
  createdAt: string;
}

/** A feasible firing solution for one (area, threat) pair. */
export interface EngagementOption {
  areaId: string;
  threatId: string;
  feasible: boolean;
  reason?: string;
  tLaunch: number;        // s
  tIntercept: number;     // s
  timeMarginS: number;    // tImpact - tIntercept
  interceptPoint: GeoPoint;
  interceptLocal: LocalPoint;
  slantRangeKm: number;
  interceptAltM: number;
  aspectAngleDeg: number; // interceptor LOS vs threat velocity
  closingSpeed: number;   // m/s
  windowOpenS?: number;   // engagement window opens (s)
  windowCloseS?: number;  // engagement window closes (s)
  pk: number;             // single-shot kill probability 0..1
}

export interface Shot {
  areaId: string;
  threatId: string;
  salvoIndex: number;   // 0 = first shot, 1 = shoot-look-shoot second round
  option: EngagementOption;
}

export interface ThreatResult {
  threatId: string;
  shots: Shot[];
  cumulativePk: number; // 1 - Π(1 - pk_i)
  leaker: boolean;      // no feasible engagement at all
}

/** One evaluated candidate subset during the minimality search. */
export interface SubsetTrial {
  size: number;
  areaIds: string[];
  protection: number;
  admissible: boolean;
  delta: number;      // protection - baseline
  removed?: string;   // greedy path only
}

/** PS output (c): minimal optimal SUBSET of (b). */
export interface AllocationSolution {
  /** true = minimality PROVEN by exhaustive enumeration; false = greedy heuristic. */
  certified?: boolean;
  baselineProtection?: number;
  threshold?: number;
  subsetTrace?: SubsetTrial[];
  selectedAreaIds: string[];       // <- the PS deliverable
  consideredAreaIds: string[];
  shots: Shot[];
  perThreat: ThreatResult[];
  metrics: {
    expectedKills: number;
    threatsEngaged: number;
    threatsTotal: number;
    leakers: number;
    weightedProtection: number;   // value-weighted expected destruction
    interceptorsUsed: number;
    sitesUsed: number;
    meanPk: number;
    solveMs: number;
    subsetsEvaluated?: number;
  };
  costMatrix: {
    rowLabels: string[];
    colLabels: string[];
    values: (number | null)[][]; // pk, null = infeasible
  };
  log: string[];
}
