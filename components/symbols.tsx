'use client';
// InterceptIQ
import React from 'react';

/**
 * SHARED ENGAGEMENT SYMBOLOGY
 * ===========================
 * One source of truth for the visual language, used identically on every map
 * and panel in the app so a viewer never has to re-learn what a colour means.
 *
 *   RED   dashed, marching  = INCOMING THREAT, moving toward the protected asset
 *   BLUE  solid,  marching  = OUTGOING INTERCEPTOR, moving away from its battery
 *   GOLD  shield            = PROTECTED ASSET (the thing being defended)
 *   GREEN burst             = SUCCESSFUL INTERCEPT (threat destroyed in the air)
 */

export const COL = {
  threat: '#f43f5e',
  intcp: '#4da3ff',
  asset: '#ffc247',
  burst: '#34d399',
  radar: '#a78bfa',
} as const;

/** Protected-asset shield. Rendered in SVG user space; scale via `s`. */
export function ShieldIcon({ s = 1, col = COL.asset, halo = false }: { s?: number; col?: string; halo?: boolean }) {
  return (
    <g transform={`scale(${s})`}>
      {halo && <circle r="20" fill="none" stroke={col} strokeWidth="1" opacity=".28" className="shield-halo" />}
      <path
        d="M0,-12 L10,-7.5 L10,2 C10,8.5 5.4,12.6 0,14.5 C-5.4,12.6 -10,8.5 -10,2 L-10,-7.5 Z"
        fill="rgba(10,14,20,.82)" stroke={col} strokeWidth="1.9" strokeLinejoin="round"
      />
      <path d="M-4.2,0.4 L-1.2,3.6 L4.4,-3.4" fill="none" stroke={col} strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Intercept burst — "threat destroyed in the air at this point". */
export function BurstIcon({ s = 1, animate = true }: { s?: number; animate?: boolean }) {
  const spikes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const r0 = 4.5, r1 = i % 2 ? 8.5 : 12;
    return `M${(Math.cos(a) * r0).toFixed(1)},${(Math.sin(a) * r0).toFixed(1)} L${(Math.cos(a) * r1).toFixed(1)},${(Math.sin(a) * r1).toFixed(1)}`;
  }).join(' ');
  return (
    <g transform={`scale(${s})`}>
      {animate && <circle r="3" fill="none" stroke={COL.burst} strokeWidth="1.6" className="burst-ring" />}
      <path d={spikes} stroke={COL.burst} strokeWidth="1.8" strokeLinecap="round" />
      <circle r="4" fill={COL.burst} />
      <circle r="4" fill="none" stroke="#eafff6" strokeWidth="1" />
    </g>
  );
}

/**
 * LAUNCHER SILHOUETTES — a TEL viewed from the side, drawn per system class so
 * the map distinguishes a large long-range battery from a mobile point-defence
 * vehicle at a glance.
 *   'heavy'  S-400 / PAD / AAD  — 8x8 TEL, four erect canisters
 *   'medium' MR-SAM / Akash     — 6x6 TEL, twin/quad canisters
 *   'light'  QRSAM / SPYDER     — 4x4 vehicle, compact launcher
 */
export type LauncherClass = 'heavy' | 'medium' | 'light';

export function launcherClassFor(rangeKm: number): LauncherClass {
  return rangeKm >= 150 ? 'heavy' : rangeKm >= 60 ? 'medium' : 'light';
}

export function BatteryIcon({ s = 1, col = COL.intcp, dead = false, kind = 'medium' }:
  { s?: number; col?: string; dead?: boolean; kind?: LauncherClass }) {
  const hull = '#0c141f';
  const wheels =
    kind === 'heavy' ? [-7.4, -4.4, 4.4, 7.4]
    : kind === 'medium' ? [-5.6, -2.6, 3.4, 6.2]
    : [-4.4, 4.0];
  const canisters =
    kind === 'heavy' ? [-3.6, -1.2, 1.2, 3.6]
    : kind === 'medium' ? [-2.2, 0.4, 2.8]
    : [-1.4, 1.4];
  const w = kind === 'heavy' ? 10.5 : kind === 'medium' ? 8.6 : 6.8;
  const canH = kind === 'heavy' ? 11 : kind === 'medium' ? 9 : 7.2;

  return (
    <g transform={`scale(${s})`}>
      {/* erect canisters, angled slightly back like a real TEL at readiness */}
      <g transform="rotate(-13)">
        {canisters.map((x, i) => (
          <g key={i}>
            <rect x={x - 0.85} y={-canH} width="1.7" height={canH} rx=".5"
              fill={hull} stroke={col} strokeWidth=".9" />
            <rect x={x - 0.85} y={-canH} width="1.7" height="1.9" fill={col} opacity=".9" />
          </g>
        ))}
      </g>
      {/* chassis */}
      <path d={`M${-w},1.6 L${w},1.6 L${w - 1.4},-2.4 L${-w + 1.2},-2.4 Z`}
        fill={hull} stroke={col} strokeWidth="1.15" strokeLinejoin="round" />
      {/* cab */}
      <path d={`M${-w},-2.4 L${-w + 3.2},-2.4 L${-w + 3.2},-5 L${-w + 0.9},-5 Z`}
        fill={hull} stroke={col} strokeWidth="1" strokeLinejoin="round" />
      {/* wheels */}
      {wheels.map((x, i) => <circle key={i} cx={x} cy="2.6" r="1.5" fill="#05090f" stroke={col} strokeWidth=".9" />)}
      {dead && <path d="M-11,-11 L11,11 M11,-11 L-11,11" stroke={COL.threat} strokeWidth="2.2" />}
    </g>
  );
}

/** Threat track symbol by class (simplified NATO-style, kept for legends). */
export function symbolPath(cls: string): string {
  switch (cls) {
    case 'AIRCRAFT': return 'M0,-10 L3,-3 L11,3 L11,5 L3,2 L3,7 L6,10 L6,11 L0,9.5 L-6,11 L-6,10 L-3,7 L-3,2 L-11,5 L-11,3 L-3,-3 Z';
    case 'CRUISE': return 'M0,-9 L8,8 L0,4 L-8,8 Z';
    case 'TBM': return 'M0,-9 L8.5,8 L-8.5,8 Z';
    case 'MRBM': return 'M0,-9 L9,0 L0,9 L-9,0 Z';
    default: return 'M0,-8 L8,0 L0,8 L-8,0 Z';
  }
}

/**
 * MISSILE BODY — drawn nose-up in local space; the caller rotates it to the
 * track heading. Ballistic RVs are slim finned cones with a blunt re-entry
 * nose; cruise missiles carry a fuselage, mid-body wings, tailplane and an
 * underslung intake. Detail is tuned to read correctly at map scale.
 */
export function MissileBody({ cls, s = 1, col = COL.threat, hot = true }:
  { cls: string; s?: number; col?: string; hot?: boolean }) {
  const cruise = cls === 'CRUISE';
  const body = '#1b2330';
  const edge = '#55627a';

  if (cruise) {
    return (
      <g transform={`scale(${s})`}>
        {hot && (
          <g className="plume">
            <ellipse cy="12" rx="2.1" ry="7" fill="#8d94a6" opacity=".3" />
            <ellipse cy="9.5" rx="1.15" ry="4" fill="#dbe3ee" opacity=".72" />
          </g>
        )}
        {/* tailplane */}
        <path d="M2.3,4.6 L5.4,7.4 L2.3,7.4 Z M-2.3,4.6 L-5.4,7.4 L-2.3,7.4 Z" fill={col} fillOpacity=".85" />
        {/* main wings */}
        <path d="M2.3,-2.2 L10.5,1.6 L10.5,3.0 L2.3,1.4 Z" fill={col} fillOpacity=".7" stroke={col} strokeWidth=".7" strokeLinejoin="round" />
        <path d="M-2.3,-2.2 L-10.5,1.6 L-10.5,3.0 L-2.3,1.4 Z" fill={col} fillOpacity=".7" stroke={col} strokeWidth=".7" strokeLinejoin="round" />
        {/* fuselage */}
        <path d="M0,-11 C1.6,-9.4 2.4,-7 2.4,-4.6 L2.4,7.2 L-2.4,7.2 L-2.4,-4.6 C-2.4,-7 -1.6,-9.4 0,-11 Z"
          fill={body} stroke={col} strokeWidth="1.25" strokeLinejoin="round" />
        {/* dorsal intake */}
        <path d="M-1.3,2.2 L1.3,2.2 L1.3,5.6 L-1.3,5.6 Z" fill={edge} opacity=".8" />
        {/* seeker */}
        <circle cy="-8.6" r="1.35" fill="#ffd7dc" />
        <path d="M0,-11 L0,-7" stroke="#ffd7dc" strokeWidth=".6" opacity=".7" />
      </g>
    );
  }

  return (
    <g transform={`scale(${s})`}>
      {hot && (
        <g className="plume">
          <ellipse cy="15" rx="2.6" ry="9" fill="#8d94a6" opacity=".32" />
          <ellipse cy="11.5" rx="1.4" ry="5" fill="#dbe3ee" opacity=".75" />
        </g>
      )}
      {/* grid fins */}
      <path d="M2.9,3.4 L6.8,9 L2.9,9 Z M-2.9,3.4 L-6.8,9 L-2.9,9 Z"
        fill={col} fillOpacity=".8" stroke={col} strokeWidth=".7" strokeLinejoin="round" />
      {/* body: ogive nose into cylindrical section */}
      <path d="M0,-13 C2,-10.4 3,-6.6 3,-3.4 L3,8.4 L-3,8.4 L-3,-3.4 C-3,-6.6 -2,-10.4 0,-13 Z"
        fill={body} stroke={col} strokeWidth="1.3" strokeLinejoin="round" />
      {/* re-entry heat band */}
      <path d="M0,-13 C2,-10.4 3,-6.6 3,-3.4 L-3,-3.4 C-3,-6.6 -2,-10.4 0,-13 Z" fill={col} fillOpacity=".55" />
      {/* stage joint */}
      <path d="M-3,1.4 L3,1.4" stroke={edge} strokeWidth=".8" opacity=".85" />
      <circle cy="-10" r="1.25" fill="#ffe3e7" />
    </g>
  );
}

/**
 * INTERCEPTOR in flight — slim, blue, canard-controlled, bright motor.
 * Deliberately a different silhouette from any threat so the two can never be
 * confused at a glance even in monochrome.
 */
export function InterceptorBody({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <g className="plume">
        <ellipse cy="13" rx="2.3" ry="8.5" fill={COL.intcp} opacity=".4" />
        <ellipse cy="10" rx="1.2" ry="4.6" fill="#eaf5ff" opacity=".95" />
      </g>
      {/* tail fins */}
      <path d="M2.3,3.2 L5.6,8 L2.3,8 Z M-2.3,3.2 L-5.6,8 L-2.3,8 Z" fill={COL.intcp} />
      {/* forward canards */}
      <path d="M2.2,-5.2 L5.2,-3.4 L2.2,-2.6 Z M-2.2,-5.2 L-5.2,-3.4 L-2.2,-2.6 Z"
        fill={COL.intcp} fillOpacity=".9" />
      {/* body */}
      <path d="M0,-11.5 C1.6,-9 2.3,-6 2.3,-3.2 L2.3,7 L-2.3,7 L-2.3,-3.2 C-2.3,-6 -1.6,-9 0,-11.5 Z"
        fill="#0a1c2e" stroke={COL.intcp} strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M0,-11.5 C1.6,-9 2.3,-6 2.3,-3.2 L-2.3,-3.2 C-2.3,-6 -1.6,-9 0,-11.5 Z" fill="#9fd0ff" />
      <circle cy="-8.8" r="1.15" fill="#ffffff" />
    </g>
  );
}

/** Rotating radar dish with a sweeping beam. */
export function RadarIcon({ s = 1, sweep = true }: { s?: number; sweep?: boolean }) {
  return (
    <g transform={`scale(${s})`}>
      {sweep && (
        <g className="radar-sweep">
          <path d="M0,0 L16,-9.5 A18.5,18.5 0 0 1 16,9.5 Z" fill={COL.radar} opacity=".15" />
        </g>
      )}
      <path d="M-7.5,6 L0,-8.5 L7.5,6 Z" fill="#12131f" stroke={COL.radar} strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M-4,1.5 L4,1.5" stroke={COL.radar} strokeWidth=".8" opacity=".7" />
      <path d="M-9.5,6 h19" stroke={COL.radar} strokeWidth="1.7" strokeLinecap="round" />
      <circle cy="-2.5" r="1.4" fill={COL.radar} />
    </g>
  );
}

/**
 * HYPERSONIC GLIDE VEHICLE — a lifting body, not a missile.
 * Deliberately a wedge: wide flat underside, sharp nose, no cylindrical
 * fuselage, with a plasma sheath rather than a rocket plume (the glide phase
 * is unpowered). It must be unmistakable at a glance because it is the one
 * threat the exo-atmospheric layer cannot reach.
 */
export function GlideBody({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  return (
    <g transform={`scale(${s})`}>
      {/* plasma / shock heating around the leading edges */}
      <g className="plume">
        <path d="M0,-13 L9,7 L-9,7 Z" fill="#9db8ff" opacity=".26" />
        <path d="M0,-11 L6.5,5 L-6.5,5 Z" fill="#e6efff" opacity=".4" />
      </g>
      {/* lifting-body wedge */}
      <path d="M0,-12 L7.5,6.5 L4.5,8 L-4.5,8 L-7.5,6.5 Z"
        fill="#241820" stroke={col} strokeWidth="1.35" strokeLinejoin="round" />
      {/* hot leading edges */}
      <path d="M0,-12 L7.5,6.5 M0,-12 L-7.5,6.5"
        stroke="#dfe9ff" strokeWidth="1.15" opacity=".9" />
      {/* control flaps */}
      <path d="M4.6,8 L7.4,11 L3.4,11 Z M-4.6,8 L-7.4,11 L-3.4,11 Z"
        fill={col} fillOpacity=".9" />
      {/* centreline ridge */}
      <path d="M0,-9 L0,7" stroke={col} strokeWidth=".8" opacity=".55" />
    </g>
  );
}

/**
 * SUPERSONIC STAND-OFF MISSILE — slim, sharply pointed, ramjet intake,
 * cropped delta fins. Reads as "fast" next to the fatter subsonic cruise body.
 */
export function SupersonicBody({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <g className="plume">
        <ellipse cy="13" rx="2" ry="8.5" fill="#8d94a6" opacity=".34" />
        <ellipse cy="10" rx="1.05" ry="4.6" fill="#dbe3ee" opacity=".78" />
      </g>
      {/* cropped delta wings */}
      <path d="M1.9,0 L7.6,5.5 L7.6,7 L1.9,4 Z" fill={col} fillOpacity=".8" />
      <path d="M-1.9,0 L-7.6,5.5 L-7.6,7 L-1.9,4 Z" fill={col} fillOpacity=".8" />
      {/* tail fins */}
      <path d="M1.9,5.5 L4.6,8.6 L1.9,8.6 Z M-1.9,5.5 L-4.6,8.6 L-1.9,8.6 Z" fill={col} />
      {/* needle-nosed body */}
      <path d="M0,-14 L2,-6.5 L2,8.4 L-2,8.4 L-2,-6.5 Z"
        fill="#1b2330" stroke={col} strokeWidth="1.2" strokeLinejoin="round" />
      {/* ventral ramjet intake */}
      <path d="M-1.5,1.5 L1.5,1.5 L1.2,5.4 L-1.2,5.4 Z" fill="#55627a" opacity=".9" />
      <circle cy="-10.5" r="1.05" fill="#ffe3e7" />
    </g>
  );
}

/** ATTACK HELICOPTER — rotor disc, stub weapon pylons, tail boom. */
export function HeloIcon({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  return (
    <g transform={`scale(${s})`}>
      {/* spinning main rotor disc */}
      <g className="rotor">
        <ellipse rx="13.5" ry="3.2" cy="-1" fill="none" stroke={col}
          strokeWidth=".8" strokeOpacity=".5" />
        <path d="M-13.5,-1 L13.5,-1" stroke={col} strokeWidth="1.5" strokeOpacity=".85" />
        <path d="M-6,-4.4 L6,2.4" stroke={col} strokeWidth="1.1" strokeOpacity=".45" />
      </g>
      {/* tail boom + rotor */}
      <path d="M-1.5,4 L-1.5,11 L1.5,11 L1.5,4 Z" fill="#1b2330" stroke={col} strokeWidth="1" />
      <path d="M-3.4,11.6 L3.4,11.6" stroke={col} strokeWidth="1.4" strokeLinecap="round" />
      {/* fuselage — tandem cockpit profile */}
      <path d="M0,-7 C2.6,-6 3.4,-3 3.4,0 L3.4,4.5 L-3.4,4.5 L-3.4,0 C-3.4,-3 -2.6,-6 0,-7 Z"
        fill="#1b2330" stroke={col} strokeWidth="1.25" strokeLinejoin="round" />
      {/* stub wings with pylons */}
      <path d="M3.2,-0.5 L7.6,0.6 L7.6,2.1 L3.2,1.4 Z" fill={col} fillOpacity=".85" />
      <path d="M-3.2,-0.5 L-7.6,0.6 L-7.6,2.1 L-3.2,1.4 Z" fill={col} fillOpacity=".85" />
      {/* canopy */}
      <ellipse cy="-3.6" rx="1.9" ry="2.6" fill="#9fd0ff" opacity=".6" />
    </g>
  );
}

/** STEALTH FIGHTER — chined diamond planform, canted tails, no curves. */
export function StealthIcon({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <g className="plume">
        <ellipse cy="12" rx="2.6" ry="6" fill="#9fd0ff" opacity=".3" />
      </g>
      {/* faceted diamond wing — all straight edges, aligned planform */}
      <path d="M0,-13 L3,-4 L11,5.5 L9,8.5 L3.2,6.6 L2.4,10 L-2.4,10 L-3.2,6.6 L-9,8.5 L-11,5.5 L-3,-4 Z"
        fill="#151d2a" stroke={col} strokeWidth="1.3" strokeLinejoin="round" />
      {/* canted twin tails */}
      <path d="M2.6,6 L5.6,11 L3.4,11 Z M-2.6,6 L-5.6,11 L-3.4,11 Z"
        fill={col} fillOpacity=".9" />
      {/* chine highlight */}
      <path d="M0,-13 L3,-4 L11,5.5 M0,-13 L-3,-4 L-11,5.5"
        stroke="#cfe8ff" strokeWidth=".7" fill="none" opacity=".55" />
      {/* internal bay line */}
      <path d="M-2,0 L2,0" stroke={col} strokeWidth=".7" opacity=".6" />
      <circle cy="-8" r="1" fill="#ffd7dc" />
    </g>
  );
}

/** HEAVY BOMBER — long fuselage, broad swept wings, four engines. */
export function BomberIcon({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  return (
    <g transform={`scale(${s})`}>
      {/* big swept wings */}
      <path d="M2.6,-3 L14,4 L14,6.2 L2.6,2.2 Z" fill="#2b3444" stroke={col} strokeWidth=".9" strokeLinejoin="round" />
      <path d="M-2.6,-3 L-14,4 L-14,6.2 L-2.6,2.2 Z" fill="#2b3444" stroke={col} strokeWidth=".9" strokeLinejoin="round" />
      {/* engine nacelles, two per side */}
      <rect x="4.6" y="0.6" width="2.2" height="4.4" rx=".7" fill="#0d1420" stroke={col} strokeWidth=".7" />
      <rect x="8.4" y="1.8" width="2.2" height="4.4" rx=".7" fill="#0d1420" stroke={col} strokeWidth=".7" />
      <rect x="-6.8" y="0.6" width="2.2" height="4.4" rx=".7" fill="#0d1420" stroke={col} strokeWidth=".7" />
      <rect x="-10.6" y="1.8" width="2.2" height="4.4" rx=".7" fill="#0d1420" stroke={col} strokeWidth=".7" />
      {/* tailplane */}
      <path d="M2,8.5 L6.4,11.5 L6.4,12.8 L2,10.6 Z" fill={col} fillOpacity=".85" />
      <path d="M-2,8.5 L-6.4,11.5 L-6.4,12.8 L-2,10.6 Z" fill={col} fillOpacity=".85" />
      {/* long fuselage */}
      <path d="M0,-13 C2,-11 2.6,-8 2.6,-5 L2.6,11.5 L-2.6,11.5 L-2.6,-5 C-2.6,-8 -2,-11 0,-13 Z"
        fill="#1b2330" stroke={col} strokeWidth="1.3" strokeLinejoin="round" />
      {/* fin */}
      <path d="M0,7.5 L0,13.5 L-1.5,13.5 L-1.5,9 Z" fill={col} fillOpacity=".9" />
      <ellipse cy="-9.5" rx="1.5" ry="2.1" fill="#9fd0ff" opacity=".6" />
    </g>
  );
}

/**
 * UAV SWARM — a cluster of small rotorcraft rather than one airframe, so the
 * viewer immediately reads "many cheap tracks" instead of "one target".
 */
export function SwarmIcon({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  const one = (x: number, y: number, r: number) => (
    <g transform={`translate(${x},${y}) scale(${r})`}>
      <circle r="1.5" fill="#1b2330" stroke={col} strokeWidth="1" />
      <path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke={col} strokeWidth=".85" opacity=".9" />
      <circle cx="-3" cy="-3" r="1.5" fill="none" stroke={col} strokeWidth=".6" opacity=".75" />
      <circle cx="3" cy="-3" r="1.5" fill="none" stroke={col} strokeWidth=".6" opacity=".75" />
      <circle cx="-3" cy="3" r="1.5" fill="none" stroke={col} strokeWidth=".6" opacity=".75" />
      <circle cx="3" cy="3" r="1.5" fill="none" stroke={col} strokeWidth=".6" opacity=".75" />
    </g>
  );
  return (
    <g transform={`scale(${s})`}>
      {/* loose formation envelope */}
      <circle r="12" fill={col} fillOpacity=".07" stroke={col}
        strokeWidth=".8" strokeOpacity=".45" strokeDasharray="2 3" />
      {one(0, -5.5, 1.05)}
      {one(-6, 1.5, 0.9)}
      {one(6, 1.5, 0.9)}
      {one(-2.4, 7.5, 0.78)}
      {one(3.4, 7, 0.78)}
    </g>
  );
}

/** Small fixed-wing UAV / loitering-munition planform, nose-up. */
export function DroneIcon({ s = 1, col = COL.threat }: { s?: number; col?: string }) {
  return (
    <g transform={`scale(${s})`}>
      {/* straight high-aspect wing */}
      <path d="M-12,0.4 L12,0.4 L12,2 L-12,2 Z" fill={col} fillOpacity=".72" stroke={col} strokeWidth=".7" />
      {/* fuselage */}
      <path d="M0,-9 C1.3,-7.4 1.9,-5.4 1.9,-3.4 L1.9,6.5 L-1.9,6.5 L-1.9,-3.4 C-1.9,-5.4 -1.3,-7.4 0,-9 Z"
        fill="#1b2330" stroke={col} strokeWidth="1.15" strokeLinejoin="round" />
      {/* V-tail */}
      <path d="M-1.9,5 L-5,8.2 L-1.9,8.2 Z M1.9,5 L5,8.2 L1.9,8.2 Z" fill={col} fillOpacity=".85" />
      {/* pusher prop */}
      <path d="M-2.6,8.6 L2.6,8.6" stroke={col} strokeWidth="1.5" strokeLinecap="round" opacity=".85" />
      <circle cy="-6.4" r="1.2" fill="#ffd7dc" />
    </g>
  );
}


/**
 * THREAT GLYPH DISPATCHER
 * One place that maps a ThreatClass to its silhouette, so every map, legend
 * and panel in the app draws the same shape for the same class. Each class
 * gets a genuinely distinct outline — a viewer must be able to tell a glide
 * vehicle from a bomber from a swarm at a glance, without reading the label.
 */
export function ThreatGlyph({ cls, s = 1 }: { cls: string; s?: number }) {
  switch (cls) {
    case 'HGV': return <GlideBody s={s} />;
    case 'SUPCRUISE': return <SupersonicBody s={s} />;
    case 'HELO': return <HeloIcon s={s} />;
    case 'STEALTH': return <StealthIcon s={s} />;
    case 'BOMBER': return <BomberIcon s={s} />;
    case 'SWARM': return <SwarmIcon s={s} />;
    case 'DRONE': return <DroneIcon s={s} />;
    case 'AIRCRAFT':
      return (
        <path d={symbolPath('AIRCRAFT')} transform={`scale(${s})`}
          fill={COL.threat} fillOpacity=".9" stroke="#ffd7dc" strokeWidth="1.1"
          strokeLinejoin="round" />
      );
    default: return <MissileBody cls={cls} s={s} />;
  }
}

/** Arrow-marker defs — must be included once per <svg> that draws engagement lines. */
export function EngagementDefs() {
  return (
    <>
      <marker id="arrowThreat" markerWidth="7" markerHeight="7" refX="6" refY="3.5"
        orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,3.5 L0,7 z" fill={COL.threat} />
      </marker>
      <marker id="arrowIntcp" markerWidth="7" markerHeight="7" refX="6" refY="3.5"
        orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,3.5 L0,7 z" fill={COL.intcp} />
      </marker>
      <filter id="glowSoft">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </>
  );
}

/* ------------------------- HTML-space legend ------------------------- */

/** Always-visible key. Placed over every map so a colour never needs explaining. */
export function MapLegend({ compact = false }: { compact?: boolean }) {
  const items = [
    { c: COL.threat, label: 'Incoming threat', dash: true },
    { c: COL.intcp, label: 'Interceptor response', dash: false },
    { c: COL.asset, label: 'Protected asset', icon: 'shield' as const },
    { c: COL.burst, label: 'Successful intercept', icon: 'burst' as const },
  ];
  return (
    <div style={{
      display: 'flex', gap: compact ? 10 : 15, alignItems: 'center', flexWrap: 'wrap',
      background: 'rgba(6,10,15,.94)', border: '1px solid var(--line)', borderRadius: 3,
      padding: compact ? '4px 8px' : '6px 11px', fontSize: compact ? 8.5 : 9.5,
    }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--dim)' }}>
          {it.icon === 'shield' ? (
            <svg width="12" height="12" viewBox="-13 -14 26 30"><ShieldIcon s={0.85} /></svg>
          ) : it.icon === 'burst' ? (
            <svg width="12" height="12" viewBox="-13 -13 26 26"><BurstIcon s={0.85} animate={false} /></svg>
          ) : (
            <svg width="22" height="8" viewBox="0 0 22 8">
              <line x1="0" y1="4" x2="17" y2="4" stroke={it.c} strokeWidth="2"
                strokeDasharray={it.dash ? '4 3' : '0'} />
              <path d="M17,1 L22,4 L17,7 z" fill={it.c} />
            </svg>
          )}
          <span style={{ color: it.c }}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Small inline chips for use in tables and lists. */
export function ThreatChip({ size = 11 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="-10 -10 20 20"><path d="M0,-8 L8,0 L0,8 L-8,0 Z" fill={COL.threat} fillOpacity=".85" stroke="#ffd7dc" strokeWidth="1.3" /></svg>;
}
export function IntcpChip({ size = 11 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="-11 -12 22 22"><BatteryIcon s={0.82} /></svg>;
}
