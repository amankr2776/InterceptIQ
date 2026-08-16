'use client';
// InterceptIQ
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * CINEMATIC LANDING SEQUENCE
 * ==========================
 * A ~22 second scripted engagement rendered entirely in SVG + rAF — no video
 * file, no external assets, so it loads instantly and works offline.
 *
 * The choreography follows a real layered air-defence engagement:
 *   0.0s  quiet radar sweep over the frontier
 *   2.5s  hostile launch detected, tracks appear beyond the border
 *   5.0s  tracks cross into national airspace, batteries go to ALERT
 *   7.5s  fire solutions computed, S-400 and Akash lock
 *   9.0s  interceptors away — visible motor plumes, real closing geometry
 *  13.0s  intercepts: expanding shockwave + debris
 *  17.0s  a fighter runs in low; QRSAM point defence takes it
 *  20.0s  all clear, protected asset intact, title resolves
 *
 * Everything is deterministic maths, so the timeline is frame-accurate and
 * identical on every machine.
 */

const W = 1600, H = 900;

interface Track {
  id: string;
  kind: 'ballistic' | 'cruise' | 'jet';
  /** start / end in scene coordinates */
  x0: number; y0: number; x1: number; y1: number;
  /** arc height for ballistic lofting */
  loft: number;
  tAppear: number;
  tCross: number;
  tKill: number;
  killer: string;
  label: string;
}

const BATTERIES = [
  { id: 'S400',  x: 1180, y: 470, name: 'S-400 TRIUMF',  sub: '400 km · Mach 14', kind: 'heavy'  as const, tAlert: 5.0, tLock: 7.5, tFire: 9.0 },
  { id: 'AKASH', x: 900,  y: 640, name: 'AKASH',          sub: '45 km · Mach 3.5', kind: 'medium' as const, tAlert: 5.2, tLock: 7.8, tFire: 9.6 },
  { id: 'QRSAM', x: 1290, y: 700, name: 'QRSAM',          sub: '30 km · Mach 4.7', kind: 'light'  as const, tAlert: 5.4, tLock: 16.4, tFire: 17.2 },
];

const TRACKS: Track[] = [
  { id: 'T1', kind: 'ballistic', x0: 90,  y0: 300, x1: 1150, y1: 430, loft: 230, tAppear: 2.5, tCross: 5.0,  tKill: 13.0, killer: 'S400',  label: 'SRBM' },
  { id: 'T2', kind: 'ballistic', x0: 40,  y0: 470, x1: 980,  y1: 600, loft: 180, tAppear: 3.1, tCross: 5.4,  tKill: 13.9, killer: 'S400',  label: 'MRBM' },
  { id: 'T3', kind: 'cruise',    x0: 60,  y0: 660, x1: 890,  y1: 655, loft: 22,  tAppear: 3.7, tCross: 6.0,  tKill: 14.6, killer: 'AKASH', label: 'CRUISE' },
  { id: 'T4', kind: 'jet',       x0: 20,  y0: 760, x1: 1270, y1: 715, loft: 14,  tAppear: 15.2, tCross: 16.0, tKill: 19.2, killer: 'QRSAM', label: 'STRIKE AIRCRAFT' },
];

const DUR = 22.5;

/** Position along a lofted arc, 0..1. */
function arcAt(t: Track, u: number) {
  const x = t.x0 + (t.x1 - t.x0) * u;
  const y = t.y0 + (t.y1 - t.y0) * u - Math.sin(Math.PI * u) * t.loft;
  return { x, y };
}
function headingAt(t: Track, u: number) {
  const a = arcAt(t, Math.max(0, u - 0.01));
  const b = arcAt(t, Math.min(1, u + 0.01));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const step = (now: number) => {
      if (start.current === null) start.current = now;
      const el = (now - start.current) / 1000;
      setT(el);
      if (el < DUR) raf.current = requestAnimationFrame(step);
      else onDone();
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [onDone]);

  // deterministic star/terrain noise
  const grit = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ({
      x: ((i * 613) % 1597) + 3, y: ((i * 271) % 880) + 10, r: (i % 3) * 0.35 + 0.3,
    })), []
  );

  const phase =
    t < 2.5 ? 'SURVEILLANCE'
    : t < 5 ? 'HOSTILE LAUNCH DETECTED'
    : t < 7.5 ? 'AIRSPACE VIOLATION'
    : t < 9 ? 'FIRE SOLUTION COMPUTED'
    : t < 13 ? 'INTERCEPTORS AWAY'
    : t < 15.2 ? 'THREATS DESTROYED'
    : t < 19.2 ? 'LOW-ALTITUDE PENETRATOR'
    : 'AIRSPACE SECURE';

  const skip = () => { if (raf.current) cancelAnimationFrame(raf.current); onDone(); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#03060b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050c16" />
            <stop offset="55%" stopColor="#071320" />
            <stop offset="100%" stopColor="#04101a" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1a14" />
            <stop offset="100%" stopColor="#060f0c" />
          </linearGradient>
          <radialGradient id="flash">
            <stop offset="0%" stopColor="#fff8e0" stopOpacity="1" />
            <stop offset="35%" stopColor="#ffd27a" stopOpacity=".85" />
            <stop offset="70%" stopColor="#ff8a3c" stopOpacity=".35" />
            <stop offset="100%" stopColor="#ff5a2c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="domeG">
            <stop offset="60%" stopColor="#ffc247" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffc247" stopOpacity=".18" />
          </radialGradient>
          <filter id="soft"><feGaussianBlur stdDeviation="3" /></filter>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ---------- SKY / GROUND ---------- */}
        <rect width={W} height={H} fill="url(#sky)" />
        {grit.map((g, i) => (
          <circle key={i} cx={g.x} cy={g.y * 0.62} r={g.r} fill="#2a4258"
            opacity={0.25 + 0.3 * Math.abs(Math.sin(t * 0.7 + i))} />
        ))}
        <path d={`M0,${H * 0.62} ${Array.from({ length: 40 }, (_, i) =>
          `L${(i * W) / 39},${H * 0.62 - Math.sin(i * 0.7) * 16 - Math.cos(i * 1.9) * 9}`).join(' ')} L${W},${H} L0,${H} Z`}
          fill="url(#ground)" />
        <path d={`M0,${H * 0.62} ${Array.from({ length: 40 }, (_, i) =>
          `L${(i * W) / 39},${H * 0.62 - Math.sin(i * 0.7) * 16 - Math.cos(i * 1.9) * 9}`).join(' ')}`}
          fill="none" stroke="#1d4a3a" strokeWidth="1.6" opacity=".8" />

        {/* frontier */}
        <line x1={430} y1={H * 0.5} x2={360} y2={H} stroke="#8a3a48" strokeWidth="2"
          strokeDasharray="12 9" opacity=".55" />
        <text x={300} y={H - 26} fill="#8a3a48" fontSize="15" letterSpacing="3"
          fontFamily="ui-monospace, monospace" opacity=".7">FRONTIER</text>

        {/* radar sweep */}
        <g transform={`translate(1180,470)`} opacity={t < 5 ? 0.5 : 0.22}>
          {[130, 260, 400].map((r) => (
            <circle key={r} r={r} fill="none" stroke="#38bdf8" strokeWidth="1" opacity=".14" />
          ))}
          <g transform={`rotate(${(t * 62) % 360})`}>
            <path d="M0,0 L400,-42 A403,403 0 0 1 400,42 Z" fill="#38bdf8" opacity=".10" />
          </g>
        </g>

        {/* ---------- PROTECTED CITY ---------- */}
        <g transform={`translate(1400,${H * 0.62})`}>
          <circle r={135} fill="url(#domeG)" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={-70 + i * 18} y={-16 - (i % 3) * 22} width="12"
              height={16 + (i % 3) * 22} fill="#0d1f18" stroke="#2a6b52" strokeWidth="1" />
          ))}
          <text y={44} fill="#ffc247" fontSize="17" textAnchor="middle" letterSpacing="3"
            fontFamily="ui-monospace, monospace">PROTECTED ASSET</text>
        </g>

        {/* ---------- BATTERIES ---------- */}
        {BATTERIES.map((b) => {
          const alert = t >= b.tAlert;
          const lock = t >= b.tLock;
          const fired = t >= b.tFire;
          const col = !alert ? '#3c5b74' : lock ? '#a78bfa' : '#ffb020';
          const ring = 26 + (lock ? 10 * Math.abs(Math.sin(t * 5)) : alert ? 5 * Math.abs(Math.sin(t * 2.6)) : 0);
          const cans = b.kind === 'heavy' ? 4 : b.kind === 'medium' ? 3 : 2;
          const scale = b.kind === 'heavy' ? 1.5 : b.kind === 'medium' ? 1.25 : 1.05;
          return (
            <g key={b.id} transform={`translate(${b.x},${b.y})`}>
              {alert && (
                <circle r={ring} fill="none" stroke={col} strokeWidth="1.8"
                  strokeDasharray="5 5" opacity=".85" />
              )}
              <g transform={`scale(${scale})`}>
                {/* erect canisters */}
                <g transform="rotate(-14)">
                  {Array.from({ length: cans }, (_, i) => {
                    const x = (i - (cans - 1) / 2) * 4.6;
                    const spent = fired && i < 2;
                    return (
                      <g key={i}>
                        <rect x={x - 1.5} y={-22} width="3" height="22" rx="1"
                          fill="#0d1620" stroke={col} strokeWidth="1.1" />
                        {!spent && <rect x={x - 1.5} y={-22} width="3" height="4" fill={col} />}
                      </g>
                    );
                  })}
                </g>
                {/* chassis */}
                <path d="M-17,3 L17,3 L14,-5 L-15,-5 Z" fill="#0b131d" stroke={col} strokeWidth="1.5" />
                <path d="M-17,-5 L-11,-5 L-11,-11 L-15,-11 Z" fill="#0b131d" stroke={col} strokeWidth="1.2" />
                {[-13, -7, 7, 13].slice(0, cans === 2 ? 2 : 4).map((x, i) => (
                  <circle key={i} cx={x} cy="6" r="3" fill="#05090f" stroke={col} strokeWidth="1.2" />
                ))}
              </g>
              <text y={46} fill={col} fontSize="15" textAnchor="middle" fontWeight="700"
                letterSpacing="1.5" fontFamily="ui-monospace, monospace"
                stroke="#03060b" strokeWidth="4" paintOrder="stroke">{b.name}</text>
              <text y={63} fill="#5d7d96" fontSize="11.5" textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                stroke="#03060b" strokeWidth="3.5" paintOrder="stroke">{b.sub}</text>
              {alert && !fired && (
                <text y={-46} fill={col} fontSize="12" textAnchor="middle" letterSpacing="1.6"
                  fontFamily="ui-monospace, monospace">{lock ? 'LOCKED' : 'ALERT'}</text>
              )}
            </g>
          );
        })}

        {/* ---------- THREAT TRACKS ---------- */}
        {TRACKS.map((tr) => {
          if (t < tr.tAppear) return null;
          const dead = t >= tr.tKill;
          const u = Math.min(1, (t - tr.tAppear) / (tr.tKill - tr.tAppear));
          const p = arcAt(tr, u);
          const hd = headingAt(tr, u);
          const crossed = t >= tr.tCross;

          // flown trail
          const pts: string[] = [];
          for (let k = 0; k <= 34; k++) {
            const uu = (u * k) / 34;
            const q = arcAt(tr, uu);
            pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
          }
          // predicted remainder
          const fut: string[] = [];
          for (let k = 0; k <= 26; k++) {
            const uu = u + ((1 - u) * k) / 26;
            const q = arcAt(tr, uu);
            fut.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
          }

          return (
            <g key={tr.id}>
              <polyline points={pts.join(' ')} fill="none" stroke="#f43f5e"
                strokeWidth={dead ? 1.4 : 2.4} opacity={dead ? 0.16 : 0.72} />
              {!dead && (
                <polyline points={fut.join(' ')} fill="none" stroke="#f43f5e" strokeWidth="1.5"
                  strokeDasharray="9 8" opacity=".3" />
              )}
              {!dead && (
                <g transform={`translate(${p.x},${p.y}) rotate(${hd})`}>
                  {/* motor plume */}
                  <ellipse cx={-19} cy="0" rx="15" ry="3.4" fill="#ffb020" opacity=".5" />
                  <ellipse cx={-13} cy="0" rx="8" ry="2" fill="#fff0c9" opacity=".92" />
                  {tr.kind === 'jet' ? (
                    <>
                      <path d="M15,0 L-2,-3.4 L-13,-2.6 L-13,2.6 L-2,3.4 Z" fill="#26303f" stroke="#f43f5e" strokeWidth="1.4" />
                      <path d="M0,-2.4 L-9,-14 L-3,-14 L5,-2.4 Z" fill="#f43f5e" opacity=".8" />
                      <path d="M0,2.4 L-9,14 L-3,14 L5,2.4 Z" fill="#f43f5e" opacity=".8" />
                      <path d="M-11,-1.8 L-16,-8 L-12,-8 L-8,-1.8 Z" fill="#f43f5e" opacity=".7" />
                    </>
                  ) : tr.kind === 'cruise' ? (
                    <>
                      <path d="M14,0 L2,-3 L-12,-3 L-12,3 L2,3 Z" fill="#26303f" stroke="#f43f5e" strokeWidth="1.4" />
                      <path d="M-1,-3 L-5,-13 L-9,-3 Z M-1,3 L-5,13 L-9,3 Z" fill="#f43f5e" opacity=".75" />
                    </>
                  ) : (
                    <>
                      <path d="M17,0 L4,-4 L-12,-4 L-12,4 L4,4 Z" fill="#26303f" stroke="#f43f5e" strokeWidth="1.5" />
                      <path d="M17,0 L4,-4 L4,4 Z" fill="#f43f5e" />
                      <path d="M-8,-4 L-15,-11 L-10,-11 L-5,-4 Z M-8,4 L-15,11 L-10,11 L-5,4 Z" fill="#f43f5e" opacity=".8" />
                    </>
                  )}
                </g>
              )}
              {!dead && (
                <text x={p.x - 30} y={p.y - 22} fill="#ff9aa6" fontSize="12.5" letterSpacing="1"
                  textAnchor="end" fontFamily="ui-monospace, monospace"
                  stroke="#03060b" strokeWidth="3.5" paintOrder="stroke">
                  {tr.label}{crossed ? ' · INBOUND' : ''}
                </text>
              )}
            </g>
          );
        })}

        {/* ---------- INTERCEPTORS ---------- */}
        {TRACKS.map((tr) => {
          const bat = BATTERIES.find((b) => b.id === tr.killer)!;
          const launch = bat.tFire + (tr.id === 'T2' ? 0.7 : tr.id === 'T3' ? 1.1 : 0);
          if (t < launch || t > tr.tKill + 0.05) return null;
          const f = Math.min(1, (t - launch) / (tr.tKill - launch));
          const target = arcAt(tr, Math.min(1, (tr.tKill - tr.tAppear) / (tr.tKill - tr.tAppear)));
          const ix = bat.x + (target.x - bat.x) * f;
          const iy = bat.y + (target.y - bat.y) * f;
          const ang = (Math.atan2(target.y - bat.y, target.x - bat.x) * 180) / Math.PI;
          return (
            <g key={'i' + tr.id}>
              <line x1={bat.x} y1={bat.y} x2={ix} y2={iy} stroke="#4da3ff"
                strokeWidth="5" opacity=".22" />
              <line x1={bat.x} y1={bat.y} x2={ix} y2={iy} stroke="#7cc4ff"
                strokeWidth="2.6" opacity=".95" strokeDasharray="16 8" />
              <g transform={`translate(${ix},${iy}) rotate(${ang}) scale(1.5)`} filter="url(#glow)">
                <ellipse cx={-22} cy="0" rx="19" ry="4" fill="#4da3ff" opacity=".6" />
                <ellipse cx={-14} cy="0" rx="10" ry="2.4" fill="#eaf5ff" opacity=".98" />
                <path d="M14,0 L2,-3 L-11,-3 L-11,3 L2,3 Z" fill="#0a1c2e" stroke="#7cc4ff" strokeWidth="1.7" />
                <path d="M14,0 L2,-3 L2,3 Z" fill="#cfe8ff" />
                <path d="M-7,-3 L-13,-9 L-9,-9 L-4,-3 Z M-7,3 L-13,9 L-9,9 L-4,3 Z" fill="#7cc4ff" />
              </g>
            </g>
          );
        })}

        {/* ---------- INTERCEPT DETONATIONS ---------- */}
        {TRACKS.map((tr) => {
          const dt = t - tr.tKill;
          if (dt < 0 || dt > 2.6) return null;
          const p = arcAt(tr, 1);
          const r = 12 + dt * 130;
          const fade = Math.max(0, 1 - dt / 2.6);
          return (
            <g key={'k' + tr.id}>
              {dt < 0.5 && (
                <circle cx={p.x} cy={p.y} r={40 + dt * 120} fill="url(#flash)"
                  opacity={Math.max(0, 1 - dt / 0.5)} />
              )}
              <circle cx={p.x} cy={p.y} r={r} fill="none" stroke="#ffd27a"
                strokeWidth={4 * fade} opacity={fade * 0.85} />
              <circle cx={p.x} cy={p.y} r={r * 0.6} fill="none" stroke="#fff"
                strokeWidth={2 * fade} opacity={fade * 0.5} />
              {Array.from({ length: 14 }, (_, i) => {
                const a = (i / 14) * Math.PI * 2 + tr.tKill;
                const d = dt * (70 + (i % 5) * 26);
                return (
                  <circle key={i} cx={p.x + Math.cos(a) * d} cy={p.y + Math.sin(a) * d + dt * dt * 32}
                    r={Math.max(0.4, 2.6 * fade)} fill="#ffb020" opacity={fade} />
                );
              })}
            </g>
          );
        })}

        {/* ---------- HUD ---------- */}
        <g fontFamily="ui-monospace, monospace">
          <rect x="0" y="0" width={W} height="62" fill="#03060b" opacity=".82" />
          <line x1="0" y1="62" x2={W} y2="62" stroke="#1d3348" strokeWidth="1" />
          <text x="34" y="40" fill="#ffb020" fontSize="26" fontWeight="700" letterSpacing="3">
            InterceptIQ
          </text>
          <line x1={268} y1={16} x2={268} y2={46} stroke="#1d3348" strokeWidth="1" />
          <circle cx={292} cy={31} r="4.5" fill="#f43f5e" opacity={0.35 + 0.65 * Math.abs(Math.sin(t * 4))} />
          <text x="308" y="37" fill="#c5d2e0" fontSize="15" letterSpacing="2.5">{phase}</text>
          <text x={W - 34} y="38" fill="#5d7d96" fontSize="14" textAnchor="end" letterSpacing="1.6">
            T+{t.toFixed(1)}s
          </text>
        </g>

        {/* progress */}
        <rect x="0" y={H - 3} width={(t / DUR) * W} height="3" fill="#ffb020" opacity=".65" />

        {/* ---------- RESOLVE ---------- */}
        {t > 19.6 && (() => {
          const a = Math.min(1, (t - 19.6) / 1.6);
          return (
            <g opacity={a}>
              <rect width={W} height={H} fill="#03060b" opacity={0.9 * a} />
              <text x={W / 2} y={H / 2 - 54} fill="#ffb020" fontSize="72" textAnchor="middle"
                fontWeight="700" letterSpacing="10" fontFamily="ui-monospace, monospace">
                InterceptIQ
              </text>
              <text x={W / 2} y={H / 2 + 4} fill="#c5d2e0" fontSize="19" textAnchor="middle"
                letterSpacing="3.4" fontFamily="ui-monospace, monospace">
                OPTIMAL INTERCEPTOR LAUNCH-AREA ALLOCATION
              </text>
              <text x={W / 2} y={H / 2 + 44} fill="#5d7d96" fontSize="14.5" textAnchor="middle"
                letterSpacing="1.8" fontFamily="ui-monospace, monospace">
                4 THREATS ENGAGED · 0 LEAKERS · PROTECTED ASSET INTACT
              </text>
              <g transform={`translate(${W / 2},${H / 2 + 108})`}>
                <rect x="-118" y="-21" width="236" height="42" rx="3" fill="none"
                  stroke="#ffb020" strokeWidth="1.6" opacity={0.55 + 0.45 * Math.abs(Math.sin(t * 3))} />
                <text y="6" fill="#ffb020" fontSize="15" textAnchor="middle" letterSpacing="3"
                  fontFamily="ui-monospace, monospace">ENTER CONSOLE</text>
              </g>
            </g>
          );
        })()}
      </svg>

      <button onClick={skip} style={{
        position: 'absolute', right: 22, bottom: 22, padding: '10px 18px',
        background: 'rgba(6,12,20,.9)', border: '1px solid #2a4258', borderRadius: 3,
        color: '#8fa8bd', fontSize: 11.5, letterSpacing: '.14em', cursor: 'pointer',
        fontFamily: 'ui-monospace, monospace',
      }}>
        {t > 19.6 ? 'ENTER CONSOLE →' : 'SKIP INTRO →'}
      </button>
    </div>
  );
}
