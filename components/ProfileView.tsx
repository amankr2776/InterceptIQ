'use client';
// InterceptIQ
import React, { useMemo } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import type { Sel } from './GeoMap';

const COLS = ['#38bdf8', '#ffb020', '#34d399', '#a78bfa', '#f43f5e', '#22d3ee', '#facc15', '#fb923c', '#4ade80'];

/**
 * Vertical engagement profile: downrange distance vs altitude.
 * Shows the ballistic arc, each site's engagement altitude band, and the
 * committed intercept points — the 3rd dimension the top-down map can't show.
 */
export default function ProfileView({ sc, sol, t, sel, onSel }: {
  sc: Scenario; sol: AllocationSolution | null; t: number; sel: Sel; onSel: (s: Sel) => void;
}) {
  const W = 1000, H = 300, PL = 56, PB = 28, PT = 16;

  const data = useMemo(() => sc.threats.map((th, i) => {
    const o = th.trajectory[0].l;
    const step = Math.max(1, Math.floor(th.trajectory.length / 160));
    const pts = th.trajectory.filter((_, j) => j % step === 0).map((s) => ({
      d: Math.hypot(s.l.x - o.x, s.l.y - o.y),
      a: s.p.alt / 1000, t: s.t,
    }));
    return { th, pts, col: COLS[i % COLS.length], total: th.rangeKm };
  }), [sc]);

  const maxD = Math.max(60, ...data.map((d) => d.total));
  const maxA = Math.max(20, ...sc.threats.map((x) => x.apogeeAlt / 1000)) * 1.08;
  const X = (d: number) => PL + (d / maxD) * (W - PL - 14);
  const Y = (a: number) => H - PB - (a / maxA) * (H - PB - PT);

  const selId = sel?.kind === 'threat' ? sel.id : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 11px', borderBottom: '1px solid var(--line)' }}>
        <span className="lbl">Vertical Profile — downrange × altitude</span>
        <span style={{ fontSize: 8.5, color: 'var(--dim2)' }}>shaded = interceptor engagement altitude bands</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
          {/* engagement altitude bands of SELECTED sites */}
          {sol?.selectedAreaIds.map((id, i) => {
            const a = sc.areas.find((x) => x.id === id)!;
            const y1 = Y(a.maxEngageAlt / 1000), y2 = Y(a.minEngageAlt / 1000);
            return (
              <g key={id}>
                <rect x={PL} y={y1} width={W - PL - 14} height={Math.max(1, y2 - y1)}
                  fill="#ffb020" fillOpacity=".045" stroke="#ffb020" strokeOpacity=".16" strokeDasharray="3 5" />
                <text x={W - 18} y={y1 + 10 + i * 11} fill="#8a7a52" fontSize="8.5" textAnchor="end">
                  {a.name.replace('Site ', '')} band
                </text>
              </g>
            );
          })}

          {/* axes */}
          {[0, .25, .5, .75, 1].map((f) => (
            <g key={f}>
              <line x1={PL} y1={Y(maxA * f)} x2={W - 14} y2={Y(maxA * f)} stroke="#162334" strokeWidth="1" />
              <text x={PL - 6} y={Y(maxA * f) + 3.5} fill="#3b4a5c" fontSize="9.5" textAnchor="end">{(maxA * f).toFixed(0)}km</text>
            </g>
          ))}
          {[0, .25, .5, .75, 1].map((f) => (
            <text key={f} x={X(maxD * f)} y={H - 8} fill="#3b4a5c" fontSize="9.5" textAnchor="middle">{(maxD * f).toFixed(0)} km</text>
          ))}
          <line x1={PL} y1={Y(0)} x2={W - 14} y2={Y(0)} stroke="#25455c" strokeWidth="1.2" />

          {data.map(({ th, pts, col }) => {
            const isSel = selId === th.id;
            const flown = pts.filter((p) => p.t <= t);
            const d = (arr: typeof pts) => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p.d)},${Y(p.a)}`).join('');
            return (
              <g key={th.id} style={{ cursor: 'pointer' }} onClick={() => onSel({ kind: 'threat', id: th.id })}>
                <path d={d(pts)} fill="none" stroke={col} strokeOpacity={isSel ? .35 : .18}
                  strokeWidth={isSel ? 2 : 1.2} strokeDasharray="4 4" />
                {flown.length > 1 && <path d={d(flown)} fill="none" stroke={col} strokeWidth={isSel ? 2.6 : 1.5} />}
                {flown.length > 0 && (
                  <circle cx={X(flown[flown.length - 1].d)} cy={Y(flown[flown.length - 1].a)}
                    r={isSel ? 4 : 2.8} fill={col} />
                )}
                <text x={X(pts[Math.floor(pts.length / 2)].d)} y={Y(pts[Math.floor(pts.length / 2)].a) - 6}
                  fill={col} fontSize="9" textAnchor="middle" opacity={isSel ? 1 : .55}>{th.callsign}</text>
              </g>
            );
          })}

          {/* committed intercepts */}
          {sol?.shots.map((s, i) => {
            const th = sc.threats.find((x) => x.id === s.threatId)!;
            const o = th.trajectory[0].l;
            const dd = Math.hypot(s.option.interceptLocal.x - o.x, s.option.interceptLocal.y - o.y);
            const aa = s.option.interceptAltM / 1000;
            const hit = t >= s.option.tIntercept;
            return (
              <g key={i}>
                <circle cx={X(dd)} cy={Y(aa)} r={hit ? 5.5 : 4} fill={hit ? '#34d399' : 'none'}
                  stroke="#34d399" strokeWidth="1.5" fillOpacity=".8" />
                {hit && <circle cx={X(dd)} cy={Y(aa)} r="9" fill="none" stroke="#34d399" strokeWidth="1" strokeOpacity=".4" />}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
