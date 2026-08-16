// InterceptIQ
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
  /** Operating air arm — drives the roster shown per adversary. */
  origin: 'PAK' | 'CHN' | 'BOTH';
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
    id: 'SHAHEEN2', name: 'Shaheen-II class', cls: 'MRBM', origin: 'PAK',
    category: 'Two-stage solid-fuel MRBM',
    rangeKm: [1500, 2500], apogeeKm: [100, 300], mach: 8, terminalSpeedMs: 2700,
    warheadKg: 1000, guidance: 'INS + GPS, post-separation attitude control',
    cepM: 350, source: 'Open-source (Missile Threat / CSIS, Wikipedia)',
    note: 'Re-entry vehicle separates; terminal speeds cited Mach 8–17 depending on source.',
  },
  {
    id: 'GHAURI', name: 'Ghauri class', cls: 'MRBM', origin: 'PAK',
    category: 'Single-stage liquid-fuel MRBM',
    rangeKm: [1300, 1800], apogeeKm: [280, 350], mach: 6.5, terminalSpeedMs: 2200,
    warheadKg: 700, guidance: 'Inertial navigation',
    cepM: 2500, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'GHAZNAVI', name: 'Ghaznavi class', cls: 'SRBM', origin: 'PAK',
    category: 'Single-stage solid-fuel SRBM',
    rangeKm: [290, 320], apogeeKm: [70, 110], mach: 6.5, terminalSpeedMs: 2200,
    warheadKg: 700, guidance: 'INS with terminal guidance',
    cepM: 250, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'ABDALI', name: 'Abdali class', cls: 'TBM', origin: 'PAK',
    category: 'Solid-fuel tactical ballistic missile',
    rangeKm: [180, 200], apogeeKm: [40, 70], mach: 6, terminalSpeedMs: 2040,
    warheadKg: 500, guidance: 'INS, terminal manoeuvring',
    cepM: 150, source: 'Open-source (CSIS Missile Threat)',
  },
  /* ---- Manned combat aircraft on strike profiles ----
   * Types operated by regional air arms, with published open-source figures.
   * Modelled at low-level ingress speed, not maximum dash. */
  {
    id: 'JF17', name: 'JF-17 Thunder', cls: 'AIRCRAFT', origin: 'PAK',
    category: 'Single-engine multirole fighter (PAF / CAC)',
    rangeKm: [900, 1350], apogeeKm: [0.15, 9], mach: 1.6,
    terminalSpeedMs: 300, warheadKg: 3600,
    guidance: 'Pilot + KLJ-7 radar; stand-off PGM and anti-radiation loadout',
    cepM: null, source: 'Open-source (PAC/CAC published data, IISS Military Balance)',
    note: 'Backbone PAF type. Low-level ingress makes it a point-defence problem.',
  },
  {
    id: 'F16', name: 'F-16 Fighting Falcon', cls: 'AIRCRAFT', origin: 'PAK',
    category: 'Single-engine multirole fighter',
    rangeKm: [1300, 1800], apogeeKm: [0.15, 12], mach: 2.0,
    terminalSpeedMs: 330, warheadKg: 7700,
    guidance: 'Pilot + AN/APG-68 radar; stand-off PGM',
    cepM: null, source: 'Open-source (Lockheed Martin published data)',
  },
  {
    id: 'J10', name: 'J-10C Vigorous Dragon', cls: 'AIRCRAFT', origin: 'BOTH',
    category: 'Single-engine multirole fighter (PLAAF)',
    rangeKm: [1240, 1850], apogeeKm: [0.2, 13], mach: 1.8,
    terminalSpeedMs: 320, warheadKg: 5600,
    guidance: 'Pilot + AESA radar; PL-15 / stand-off munitions',
    cepM: null, source: 'Open-source (IISS Military Balance)',
  },
  {
    id: 'SU30', name: 'Su-30 class', cls: 'AIRCRAFT', origin: 'CHN',
    category: 'Twin-engine heavy multirole fighter',
    rangeKm: [1500, 3000], apogeeKm: [0.2, 14], mach: 2.0,
    terminalSpeedMs: 340, warheadKg: 8000,
    guidance: 'Pilot + PESA radar; heavy stand-off loadout',
    cepM: null, source: 'Open-source (IISS Military Balance)',
    note: 'Heaviest strike payload in the regional inventory.',
  },
  {
    id: 'SHAHPAR', name: 'Shahpar-II class', cls: 'DRONE', origin: 'PAK',
    category: 'Medium-altitude long-endurance armed UAV',
    rangeKm: [300, 1050], apogeeKm: [3, 6], mach: 0.18,
    terminalSpeedMs: 62, warheadKg: 60,
    guidance: 'Satellite / line-of-sight datalink, EO-IR targeting',
    cepM: 15, source: 'Open-source (manufacturer brochure, IISS Military Balance)',
    note: 'Slow and low — long exposure to point defence, but easily missed by long-range SAMs.',
  },
  {
    id: 'LOITER', name: 'Loitering munition', cls: 'DRONE', origin: 'BOTH',
    category: 'One-way attack loitering munition',
    rangeKm: [40, 200], apogeeKm: [1, 4], mach: 0.15,
    terminalSpeedMs: 52, warheadKg: 20,
    guidance: 'INS + GNSS with terminal EO seeker',
    cepM: 8, source: 'Open-source (representative of fielded OWA-UAV classes)',
    note: 'Small radar cross-section; typically engaged by point defence or guns.',
  },
  {
    id: 'BABUR', name: 'Babur class', cls: 'CRUISE', origin: 'PAK',
    category: 'Subsonic turbofan land-attack cruise missile',
    rangeKm: [450, 900], apogeeKm: [0.05, 1], mach: 0.8, terminalSpeedMs: 275,
    warheadKg: 450, guidance: 'INS + TERCOM + DSMAC + GPS',
    cepM: 10, source: 'Open-source (CSIS Missile Threat)',
    note: 'Terrain-hugging low-altitude profile; the hard case for long-range SAMs.',
  },

  /* ================================================================== *
   * FULL-SPECTRUM ADVERSARY INVENTORY
   * ------------------------------------------------------------------
   * The defending side models India's complete layered network, so the
   * threat side has to be equally complete or the problem is artificially
   * easy. These are the remaining capability classes fielded by the PAF /
   * PLAAF and the two rocket forces, with published open-source figures.
   *
   * They are chosen to stress DIFFERENT layers of the defence:
   *   · HGV        depressed manoeuvring glide — defeats exo-atmospheric BMD
   *   · SUPCRUISE  Mach 3-4 sea-skimmer — collapses reaction time
   *   · STEALTH    low RCS — shrinks effective radar horizon
   *   · BOMBER     stand-off launcher — never enters the SAM envelope itself
   *   · HELO       nap-of-the-earth — under the radar horizon entirely
   *   · SWARM      many small cheap tracks — magazine-depth attack
   * ================================================================== */

  /* ---- Hypersonic glide vehicles ---- */
  {
    id: 'DF17', name: 'DF-17 / DF-ZF', cls: 'HGV', origin: 'CHN',
    category: 'MRBM booster with hypersonic glide vehicle (PLARF)',
    rangeKm: [1600, 2500], apogeeKm: [40, 60], mach: 10, terminalSpeedMs: 3400,
    warheadKg: 500, guidance: 'INS + BeiDou, terrain-matching, terminal seeker on the HGV',
    cepM: 10, source: 'Open-source (CSIS Missile Threat; PLA parade disclosures)',
    note: 'Glides in the upper atmosphere rather than arcing, so it stays below exo-atmospheric BMD and manoeuvres unpredictably.',
  },
  {
    id: 'FATAH2', name: 'Fatah-II', cls: 'HGV', origin: 'PAK',
    category: 'Guided rocket / quasi-ballistic system with terminal manoeuvre',
    rangeKm: [250, 400], apogeeKm: [30, 50], mach: 5, terminalSpeedMs: 1700,
    warheadKg: 365, guidance: 'INS + GNSS, terminal manoeuvring re-entry body',
    cepM: 10, source: 'Open-source (ISPR statements, CSIS Missile Threat)',
    note: 'Flat depressed profile aimed specifically at defeating layered SAM coverage.',
  },
  {
    id: 'ABABEEL', name: 'Ababeel', cls: 'MRBM', origin: 'PAK',
    category: 'Medium-range ballistic missile, MIRV-capable',
    rangeKm: [1800, 2200], apogeeKm: [200, 400], mach: 9, terminalSpeedMs: 3060,
    warheadKg: 1500, guidance: 'INS + post-boost vehicle dispensing multiple RVs',
    cepM: 350, source: 'Open-source (CSIS Missile Threat)',
    note: 'Multiple re-entry vehicles from one launch — a saturation problem for the BMD layer.',
  },
  {
    id: 'DF21', name: 'DF-21 class', cls: 'MRBM', origin: 'CHN',
    category: 'Solid-fuel MRBM with manoeuvring re-entry vehicle',
    rangeKm: [1500, 2150], apogeeKm: [250, 550], mach: 10, terminalSpeedMs: 3400,
    warheadKg: 600, guidance: 'INS + satellite, radar/EO terminal updates, MaRV',
    cepM: 30, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'DF26', name: 'DF-26', cls: 'MRBM', origin: 'CHN',
    category: 'Dual-capable IRBM ("Guam killer")',
    rangeKm: [3000, 4000], apogeeKm: [400, 800], mach: 10, terminalSpeedMs: 3400,
    warheadKg: 1200, guidance: 'INS + BeiDou with terminal seeker; MaRV',
    cepM: 150, source: 'Open-source (CSIS Missile Threat; DoD China Military Power Report)',
  },
  {
    id: 'DF15', name: 'DF-15B', cls: 'SRBM', origin: 'CHN',
    category: 'Solid-fuel SRBM with terminal guidance',
    rangeKm: [600, 900], apogeeKm: [120, 200], mach: 6, terminalSpeedMs: 2040,
    warheadKg: 600, guidance: 'INS + BeiDou, radar terminal seeker',
    cepM: 30, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'NASR', name: 'Nasr / Hatf-IX', cls: 'TBM', origin: 'PAK',
    category: 'Short-range battlefield ballistic missile, quad canister',
    rangeKm: [60, 70], apogeeKm: [15, 30], mach: 4, terminalSpeedMs: 1360,
    warheadKg: 400, guidance: 'INS with terminal guidance',
    cepM: 100, source: 'Open-source (CSIS Missile Threat)',
    note: 'Very short flight time — only the quick-reaction point-defence layer can respond.',
  },

  /* ---- High-speed and stand-off cruise ---- */
  {
    id: 'RAAD', name: "Ra'ad-II ALCM", cls: 'CRUISE', origin: 'PAK',
    category: 'Air-launched stand-off cruise missile',
    rangeKm: [550, 600], apogeeKm: [0.05, 1], mach: 0.8, terminalSpeedMs: 272,
    warheadKg: 450, guidance: 'INS + TERCOM + GNSS',
    cepM: 10, source: 'Open-source (CSIS Missile Threat)',
    note: 'Launched from Mirage ROSE / JF-17 well outside the SAM envelope.',
  },
  {
    id: 'CM400', name: 'CM-400AKG', cls: 'SUPCRUISE', origin: 'PAK',
    category: 'High-supersonic air-launched stand-off missile',
    rangeKm: [100, 240], apogeeKm: [12, 20], mach: 4, terminalSpeedMs: 1360,
    warheadKg: 200, guidance: 'INS + terminal seeker; steep high-speed dive',
    cepM: 50, source: 'Open-source (CASIC brochure; PAF JF-17 integration reporting)',
    note: 'Carried by JF-17. Terminal dive at Mach 4 leaves seconds of reaction time.',
  },
  {
    id: 'CJ10', name: 'CJ-10 / DH-10', cls: 'CRUISE', origin: 'CHN',
    category: 'Long-range subsonic land-attack cruise missile',
    rangeKm: [1500, 2000], apogeeKm: [0.05, 1], mach: 0.75, terminalSpeedMs: 255,
    warheadKg: 500, guidance: 'INS + TERCOM + BeiDou + DSMAC',
    cepM: 10, source: 'Open-source (CSIS Missile Threat)',
  },
  {
    id: 'YJ12', name: 'YJ-12 class', cls: 'SUPCRUISE', origin: 'CHN',
    category: 'Supersonic sea-skimming anti-ship / land-attack missile',
    rangeKm: [250, 400], apogeeKm: [0.02, 15], mach: 3, terminalSpeedMs: 1020,
    warheadKg: 500, guidance: 'INS + active radar terminal homing',
    cepM: 20, source: 'Open-source (CSIS Missile Threat)',
    note: 'Sea-skimming terminal run at Mach 3 — the hardest maritime case.',
  },

  /* ---- Manned aviation ---- */
  {
    id: 'J20', name: 'J-20 Mighty Dragon', cls: 'STEALTH', origin: 'CHN',
    category: 'Twin-engine low-observable air-superiority fighter (PLAAF)',
    rangeKm: [1100, 2000], apogeeKm: [0.2, 18], mach: 2.0,
    terminalSpeedMs: 340, warheadKg: 11000,
    guidance: 'Pilot + AESA radar, internal PL-15 / PL-21 carriage',
    cepM: null, source: 'Open-source (IISS Military Balance; PLAAF disclosures)',
    note: 'Low RCS compresses detection range, so the engagement window opens late.',
  },
  {
    id: 'J35', name: 'J-35A / FC-31', cls: 'STEALTH', origin: 'BOTH',
    category: 'Twin-engine low-observable multirole fighter',
    rangeKm: [1000, 1500], apogeeKm: [0.2, 16], mach: 1.8,
    terminalSpeedMs: 330, warheadKg: 8000,
    guidance: 'Pilot + AESA radar, internal weapons bay',
    cepM: null, source: 'Open-source (IISS Military Balance; reported PAF procurement interest)',
  },
  {
    id: 'H6K', name: 'H-6K', cls: 'BOMBER', origin: 'CHN',
    category: 'Twin-turbofan strategic bomber / cruise-missile carrier',
    rangeKm: [3500, 6000], apogeeKm: [8, 12], mach: 0.85,
    terminalSpeedMs: 290, warheadKg: 12000,
    guidance: 'Crew + nav-attack suite; carries 6 × CJ-10 or YJ-12',
    cepM: null, source: 'Open-source (IISS Military Balance)',
    note: 'Never enters the SAM envelope itself — it launches from stand-off and turns away.',
  },
  {
    id: 'MIRAGE', name: 'Mirage III/V ROSE', cls: 'AIRCRAFT', origin: 'PAK',
    category: 'Upgraded delta-wing strike aircraft (PAF)',
    rangeKm: [1200, 2400], apogeeKm: [0.15, 12], mach: 2.0,
    terminalSpeedMs: 310, warheadKg: 4000,
    guidance: "Pilot + ROSE avionics; primary Ra'ad ALCM carrier",
    cepM: null, source: 'Open-source (IISS Military Balance)',
    note: 'Ageing airframe, but the designated stand-off cruise-missile launcher.',
  },
  {
    id: 'AH1Z', name: 'AH-1Z Viper', cls: 'HELO', origin: 'PAK',
    category: 'Twin-engine attack helicopter',
    rangeKm: [230, 690], apogeeKm: [0.02, 6], mach: 0.3,
    terminalSpeedMs: 82, warheadKg: 2600,
    guidance: 'Crew + targeting sight; Hellfire / rocket loadout',
    cepM: null, source: 'Open-source (Bell published data; IISS Military Balance)',
    note: 'Nap-of-the-earth ingress under the radar horizon — a gun and VSHORAD problem.',
  },
  {
    id: 'Z10', name: 'Z-10ME', cls: 'HELO', origin: 'BOTH',
    category: 'Dedicated attack helicopter (PLA / exported to PAF)',
    rangeKm: [800, 1120], apogeeKm: [0.02, 6.4], mach: 0.27,
    terminalSpeedMs: 76, warheadKg: 1500,
    guidance: 'Crew + millimetre-wave radar; HJ-10 ATGM',
    cepM: null, source: 'Open-source (CAIC published data; IISS Military Balance)',
  },

  /* ---- Unmanned ---- */
  {
    id: 'AKINCI', name: 'Bayraktar Akinci', cls: 'DRONE', origin: 'PAK',
    category: 'High-altitude long-endurance armed UAV',
    rangeKm: [600, 1800], apogeeKm: [9, 12], mach: 0.25,
    terminalSpeedMs: 86, warheadKg: 1350,
    guidance: 'Satellite datalink, AESA radar, precision-guided munitions',
    cepM: 10, source: 'Open-source (Baykar published data)',
    note: 'Operates at 12 km with a heavy payload — a medium-SAM target, not a point-defence one.',
  },
  {
    id: 'WINGLOONG', name: 'Wing Loong II', cls: 'DRONE', origin: 'BOTH',
    category: 'Medium-altitude long-endurance armed UAV',
    rangeKm: [1500, 4000], apogeeKm: [7, 9], mach: 0.22,
    terminalSpeedMs: 75, warheadKg: 480,
    guidance: 'Satellite / LOS datalink, SAR + EO-IR, 12 hardpoints',
    cepM: 12, source: 'Open-source (CAIG published data; IISS Military Balance)',
  },
  {
    id: 'GJ11', name: 'GJ-11 Sharp Sword', cls: 'DRONE', origin: 'CHN',
    category: 'Low-observable flying-wing stealth UCAV',
    rangeKm: [1200, 4000], apogeeKm: [10, 12], mach: 0.8,
    terminalSpeedMs: 272, warheadKg: 2000,
    guidance: 'Autonomous / datalink, internal weapons bay',
    cepM: 10, source: 'Open-source (PLA parade disclosures; IISS Military Balance)',
    note: 'Flying wing with a very small radar cross-section — detected late, and fast for a UAV.',
  },
  {
    id: 'SWARM', name: 'Small-UAV swarm', cls: 'SWARM', origin: 'BOTH',
    category: 'Co-ordinated low-cost quadcopter / FPV swarm',
    rangeKm: [20, 120], apogeeKm: [0.1, 2], mach: 0.1,
    terminalSpeedMs: 35, warheadKg: 5,
    guidance: 'GNSS waypoints with co-operative autonomy; terminal EO',
    cepM: 5, source: 'Open-source (representative of fielded OWA quadcopter classes)',
    note: 'Individually trivial, collectively a magazine-depth attack: the cost exchange favours the attacker.',
  },
];

export const byId = <T extends { id: string }>(arr: T[], id: string) =>
  arr.find((x) => x.id === id)!;
