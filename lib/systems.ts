// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
import type { ThreatClass } from './types';

/**
 * REAL WEAPON-SYSTEM REFERENCE DATA
 * =================================
 * Every figure below is from published, open-source, unclassified reporting
 * (DRDO/BEL public literature, manufacturer brochures, Wikipedia, defence
 * press). Sources are named per entry. Where sources disagree, a representative
 * mid-band figure is used and the spread is noted in `note`.
 *
 * These are REAL systems with REAL published specifications. They are used to
 * parameterise the simulation so ranges, altitudes and speeds are physically
 * meaningful rather than invented.
 *
 * NOTHING here is classified, and no real deployment location is represented —
 * battery SITES in the scenario are fictional placements of real system TYPES.
 */

export interface InterceptorSpec {
  id: string;
  name: string;
  fullName: string;
  origin: string;
  role: 'BMD-Exo' | 'BMD-Endo' | 'LR-SAM' | 'MR-SAM' | 'SR-SAM' | 'QR-SAM';
  /** Engagement range against aerodynamic/ballistic targets, km */
  rangeKm: [number, number];
  /** Engagement altitude band, metres */
  altM: [number, number];
  /** Peak interceptor velocity */
  mach: number;
  speedMs: number;
  guidance: string;
  warheadKg: number | null;
  /** Typical rounds held at readiness on launchers per fire unit */
  readyRounds: number;
  reloadS: number;
  /** System reaction time, detection-to-launch, seconds */
  reactionS: number;
  /** Simultaneous engagements per fire unit */
  simTargets: number;
  radar: string;
  /** Associated acquisition/surveillance radar detection range, km */
  radarDetectKm: number;
  /** Fire-control / engagement radar range, km */
  radarTrackKm: number;
  status: string;
  source: string;
  note?: string;
}

export const INTERCEPTORS: InterceptorSpec[] = [
  {
    id: 'S400',
    name: 'S-400',
    fullName: 'S-400 Triumf (40N6E / 48N6DM)',
    origin: 'Russia',
    role: 'LR-SAM',
    rangeKm: [3, 400],
    altM: [10, 30000],
    mach: 14,
    speedMs: 4800,
    guidance: 'Semi-active + active radar homing, mid-course datalink',
    warheadKg: 180,
    readyRounds: 8,
    reloadS: 180,
    reactionS: 10,
    simTargets: 36,
    radar: '91N6E Big Bird acquisition (600 km) + 92N6E engagement',
    radarDetectKm: 600,
    radarTrackKm: 400,
    status: '5 regiments contracted; 3 delivered and operational (2025)',
    source: 'Almaz-Antey published data; Indian MoD statements',
    note: 'Interceptor mix: 40N6E to 400 km, 48N6DM to 250 km, 9M96E2 to 120 km.',
  },
  {
    id: 'PAD',
    name: 'PAD / Pradyumna',
    fullName: 'Prithvi Air Defence — exo-atmospheric interceptor',
    origin: 'India (DRDO)',
    role: 'BMD-Exo',
    rangeKm: [30, 200],
    altM: [50000, 80000],
    mach: 5.5,
    speedMs: 1870,
    guidance: 'INS with LRTR mid-course updates, terminal active radar homing',
    warheadKg: null,
    readyRounds: 4,
    reloadS: 300,
    reactionS: 14,
    simTargets: 2,
    radar: 'Swordfish LRTR (600–800 km)',
    radarDetectKm: 800,
    radarTrackKm: 600,
    status: 'BMD Phase-I; tested, not widely fielded',
    source: 'DRDO BMD programme public releases',
    note: 'Engages IRBM-class targets in the 300–2000 km threat band, above 50 km.',
  },
  {
    id: 'AAD',
    name: 'AAD / Ashwin',
    fullName: 'Advanced Air Defence — endo-atmospheric interceptor',
    origin: 'India (DRDO)',
    role: 'BMD-Endo',
    rangeKm: [10, 200],
    altM: [15000, 30000],
    mach: 4.5,
    speedMs: 1530,
    guidance: 'INS + mid-course datalink, terminal active radar seeker',
    warheadKg: null,
    readyRounds: 6,
    reloadS: 240,
    reactionS: 12,
    simTargets: 2,
    radar: 'Swordfish LRTR + MFCR',
    radarDetectKm: 800,
    radarTrackKm: 400,
    status: 'BMD Phase-I; complements PAD as the lower layer',
    source: 'DRDO BMD programme public releases',
  },
  {
    id: 'MRSAM',
    name: 'MR-SAM',
    fullName: 'Barak-8 / MR-SAM (Abhra)',
    origin: 'India–Israel (DRDO + IAI)',
    role: 'MR-SAM',
    rangeKm: [0.5, 100],
    altM: [50, 16000],
    mach: 2,
    speedMs: 680,
    guidance: 'Two-way datalink, active radar / IIR terminal seeker',
    warheadKg: 60,
    readyRounds: 8,
    reloadS: 120,
    reactionS: 8,
    simTargets: 12,
    radar: 'EL/M-2084 MMR (land) / MF-STAR (naval)',
    radarDetectKm: 250,
    radarTrackKm: 100,
    status: 'In service — Army, IAF and Navy; 18 IAF squadrons contracted',
    source: 'IAI/DRDO published specification',
    note: 'Land variant commonly cited 70–100 km; dual-pulse motor.',
  },
  {
    id: 'AKASH',
    name: 'Akash',
    fullName: 'Akash medium-range SAM',
    origin: 'India (DRDO/BDL/BEL)',
    role: 'MR-SAM',
    rangeKm: [4.5, 45],
    altM: [100, 20000],
    mach: 3.5,
    speedMs: 1190,
    guidance: 'Command guidance + digital autopilot; terminal active radar homing',
    warheadKg: 60,
    readyRounds: 12,
    reloadS: 90,
    reactionS: 6,
    simTargets: 4,
    radar: 'Rajendra 3D PESA — tracks 64, engages 4',
    radarDetectKm: 120,
    radarTrackKm: 80,
    status: 'In service — 15 squadrons; Akash-NG (70–80 km) in development',
    source: 'DRDO/BEL published specification',
    note: 'Integral ramjet-rocket sustainer. Akash-1S adds terminal seeker.',
  },
  {
    id: 'SPYDER',
    name: 'SPYDER',
    fullName: 'SPYDER-MR (Derby / Python-5)',
    origin: 'Israel (Rafael)',
    role: 'SR-SAM',
    rangeKm: [1, 50],
    altM: [20, 16000],
    mach: 4,
    speedMs: 1360,
    guidance: 'Derby: active radar homing · Python-5: IIR / electro-optical',
    warheadKg: 23,
    readyRounds: 8,
    reloadS: 100,
    reactionS: 5,
    simTargets: 4,
    radar: 'EL/M-2106 ATAR 3D surveillance',
    radarDetectKm: 100,
    radarTrackKm: 50,
    status: 'In service — 18 systems with the IAF',
    source: 'Rafael published specification',
  },
  {
    id: 'QRSAM',
    name: 'QRSAM',
    fullName: 'Quick Reaction Surface-to-Air Missile',
    origin: 'India (DRDO)',
    role: 'QR-SAM',
    rangeKm: [3, 30],
    altM: [30, 10000],
    mach: 4.7,
    speedMs: 1600,
    guidance: 'INS + two-way datalink; terminal active radar seeker',
    warheadKg: 32,
    readyRounds: 6,
    reloadS: 60,
    reactionS: 4,
    simTargets: 6,
    radar: 'Active-array battery surveillance + multi-function radar',
    radarDetectKm: 120,
    radarTrackKm: 80,
    status: 'Ordered 2025; deployed on trials in Ladakh',
    source: 'DRDO published specification',
    note: 'Search-on-move and short-halt engagement from 8×8 Tatra TEL.',
  },
  {
    id: 'PECHORA',
    name: 'S-125 Pechora',
    fullName: 'S-125 Pechora (SA-3 Goa), upgraded',
    origin: 'USSR / upgraded India',
    role: 'SR-SAM',
    rangeKm: [3.5, 35],
    altM: [20, 18000],
    mach: 3.5,
    speedMs: 1190,
    guidance: 'Semi-active radar homing / command',
    warheadKg: 60,
    readyRounds: 4,
    reloadS: 150,
    reactionS: 9,
    simTargets: 2,
    radar: 'Low Blow / upgraded digital fire control',
    radarDetectKm: 100,
    radarTrackKm: 40,
    status: 'Legacy — being replaced by Akash',
    source: 'Open-source; Indian Air Force inventory reporting',
  },
];

/* ------------------------------------------------------------------ */

export interface ThreatSpec {
  id: string;
  name: string;
  cls: ThreatClass;
  category: string;
  rangeKm: [number, number];
  apogeeKm: [number, number];
  mach: number;
  terminalSpeedMs: number;
  warheadKg: number;
  guidance: string;
  cepM: number | null;
  source: string;
  note?: string;
}

/**
 * Representative REAL threat classes for a South Asian theatre, from public
 * open-source reporting. Used to parameterise trajectory physics. Individual
 * launch points in the simulation are FICTIONAL.
 */
export const THREATS: ThreatSpec[] = [
  {
    id: 'SHAHEEN2', name: 'Shaheen-II class', cls: 'MRBM',
    category: 'Two-stage solid-fuel MRBM',
    rangeKm: [1500, 2500], apogeeKm: [100, 300], mach: 8, terminalSpeedMs: 2700,
    warheadKg: 1000, guidance: 'INS + GPS, post-separation attitude control',
    cepM: 350, source: 'Open-source (Missile Threat / CSIS, Wikipedia)',
    note: 'Re-entry vehicle separates; terminal speeds cited Mach 8–17 depending on source.',
  },
  {
    id: 'GHAURI', name: 'Ghauri class', cls: 'MRBM',
    category: 'Single-stage liquid-fuel MRBM',
    rangeKm: [1300, 1800], apogeeKm: [280, 350], mach: 6.5, terminalSpeedMs: 2200,
    warheadKg: 700, guidance: 'Inertial navigation',
    cepM: 2500, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'GHAZNAVI', name: 'Ghaznavi class', cls: 'SRBM',
    category: 'Single-stage solid-fuel SRBM',
    rangeKm: [290, 320], apogeeKm: [70, 110], mach: 6.5, terminalSpeedMs: 2200,
    warheadKg: 700, guidance: 'INS with terminal guidance',
    cepM: 250, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'ABDALI', name: 'Abdali class', cls: 'TBM',
    category: 'Solid-fuel tactical ballistic missile',
    rangeKm: [180, 200], apogeeKm: [40, 70], mach: 6, terminalSpeedMs: 2040,
    warheadKg: 500, guidance: 'INS, terminal manoeuvring',
    cepM: 150, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'SHAHPAR', name: 'Shahpar-II class', cls: 'DRONE',
    category: 'Medium-altitude long-endurance armed UAV',
    rangeKm: [300, 1050], apogeeKm: [3, 6], mach: 0.18,
    terminalSpeedMs: 62, warheadKg: 60,
    guidance: 'Satellite / line-of-sight datalink, EO-IR targeting',
    cepM: 15, source: 'Open-source (manufacturer brochure, IISS Military Balance)',
    note: 'Slow and low — long exposure to point defence, but easily missed by long-range SAMs.',
  },
  {
    id: 'LOITER', name: 'Loitering munition', cls: 'DRONE',
    category: 'One-way attack loitering munition',
    rangeKm: [40, 200], apogeeKm: [1, 4], mach: 0.15,
    terminalSpeedMs: 52, warheadKg: 20,
    guidance: 'INS + GNSS with terminal EO seeker',
    cepM: 8, source: 'Open-source (representative of fielded OWA-UAV classes)',
    note: 'Small radar cross-section; typically engaged by point defence or guns.',
  },
  {
    id: 'BABUR', name: 'Babur class', cls: 'CRUISE',
    category: 'Subsonic turbofan land-attack cruise missile',
    rangeKm: [450, 900], apogeeKm: [0.05, 1], mach: 0.8, terminalSpeedMs: 275,
    warheadKg: 450, guidance: 'INS + TERCOM + DSMAC + GPS',
    cepM: 10, source: 'Open-source (CSIS Missile Threat)',
    note: 'Terrain-hugging low-altitude profile; the hard case for long-range SAMs.',
  },
];

export const byId = <T extends { id: string }>(arr: T[], id: string) =>
  arr.find((x) => x.id === id)!;
