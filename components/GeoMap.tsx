'use client';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { stateAt } from '@/lib/geometry';
import { region } from '@/lib/theatre';
import { KM_LAT, kmLon } from '@/lib/scenario';
import { ShieldIcon, BurstIcon, BatteryIcon, EngagementDefs, symbolPath, COL } from './symbols';

export type Sel =
  | { kind: 'threat'; id: string }
  | { kind: 'site'; id: string }
  | { kind: 'asset'; id: string }
  | null;

interface Props {
  sc: Scenario; sol: AllocationSolution | null; t: number;
  sel: Sel; onSel: (s: Sel) => void;
  addMode: boolean; onMapClick: (lat: number, lon: number) => void;
  layers: Record<string, boolean>;
  onCursor?: (c: { lat: number; lon: number } | null) => void;
}

const V = 1000;

/* Muted landmass palette: the map is a backdrop, tracks and rings are the
 * signal. India is very slightly lifted from its neighbours, no more. */
const NEIGHBOUR_FILL: Record<string, string> = {
  IND: '#0b1512', PAK: '#120f13', CHN: '#0f1017', NPL: '#0e1310',
  BTN: '#0e1310', BGD: '#0d1315', LKA: '#0e1310', MMR: '#0d1315', AFG: '#120f13',
};
const NEIGHBOUR_LINE: Record<string, string> = {
  IND: '#2f5943', PAK: '#4a2f38', CHN: '#33354f', NPL: '#2b4038',
  BTN: '#2b4038', BGD: '#284048', LKA: '#2b4038', MMR: '#284048', AFG: '#4a2f38',
};

export default function GeoMap({ sc, sol, t, sel, onSel, addMode, onMapClick, layers, onCursor }: Props) {
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /* --------- projection: AOI window in lat/lon -> 0..V viewbox --------- */
  const { lat0, lon0, sizeKm } = sc.aoi;
  const latSpan = sizeKm / KM_LAT;
  const lonSpan = sizeKm / kmLon(lat0);
  const PX = useCallback((lon: number) => ((lon - lon0) / lonSpan) * V, [lon0, lonSpan]);
  const PY = useCallback((lat: number) => V - ((lat - lat0) / latSpan) * V, [lat0, latSpan]);
  const kmToPx = V / sizeKm;

  const geo = useMemo(() => {
    const path = (segs: [number, number][][], close: boolean) =>
      segs.map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${PX(p[0]).toFixed(1)},${PY(p[1]).toFixed(1)}`).join('') + (close ? 'Z' : '')).join(' ');
    return {
      countries: region.countries.map((c) => ({ ...c, d: path(c.rings, true) })),
      coast: path(region.coast, false),
    };
  }, [PX, PY]);

  const toLL = useCallback((cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sz = Math.min(r.width, r.height);
    const ox = r.left + (r.width - sz) / 2, oy = r.top + (r.height - sz) / 2;
    const ux = ((cx - ox) / sz) * V, uy = ((cy - oy) / sz) * V;
    const wx = (ux - view.x) / view.z, wy = (uy - view.y) / view.z;
    return { lon: lon0 + (wx / V) * lonSpan, lat: lat0 + ((V - wy) / V) * latSpan };
  }, [view, lat0, lon0, latSpan, lonSpan]);

  const live = useMemo(() => sc.threats.map((th) => {
    const active = t >= th.trajectory[0].t && t <= th.impact.t;
    const st = stateAt(th, Math.min(t, th.impact.t));
    const res = sol?.perThreat.find((p) => p.threatId === th.id);
    const first = res?.shots.slice().sort((a, b) => a.option.tIntercept - b.option.tIntercept)[0];
    const killed = !!first && t >= first.option.tIntercept;
    return { th, st, active, res, first, killed };
  }), [sc, sol, t]);

  const selArea = new Set(sol?.selectedAreaIds ?? []);
  const selT = sel?.kind === 'threat' ? sel.id : null;
  const selS = sel?.kind === 'site' ? sel.id : null;
  const iz = 1 / view.z;

  // graticule at whole degrees
  const gridLines = useMemo(() => {
    const step = latSpan > 8 ? 2 : latSpan > 4 ? 1 : 0.5;
    const la: number[] = [], lo: number[] = [];
    for (let v = Math.ceil(lat0 / step) * step; v < lat0 + latSpan; v += step) la.push(+v.toFixed(2));
    for (let v = Math.ceil(lon0 / step) * step; v < lon0 + lonSpan; v += step) lo.push(+v.toFixed(2));
    return { la, lo };
  }, [lat0, lon0, latSpan, lonSpan]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${V} ${V}`} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block', background: '#040910',
        cursor: addMode ? 'crosshair' : 'grab' }}
      onMouseDown={(e) => { if (!addMode) drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
      onMouseMove={(e) => {
        const p = toLL(e.clientX, e.clientY); onCursor?.(p);
        if (!drag.current) return;
        const r = svgRef.current!.getBoundingClientRect();
        const sz = Math.min(r.width, r.height);
        if (Math.abs(e.clientX - drag.current.sx) + Math.abs(e.clientY - drag.current.sy) > 3) drag.current.moved = true;
        setView((v) => ({ ...v, x: drag.current!.vx + ((e.clientX - drag.current!.sx) / sz) * V,
                                 y: drag.current!.vy + ((e.clientY - drag.current!.sy) / sz) * V }));
      }}
      onMouseUp={() => { drag.current = null; }}
      onMouseLeave={() => { drag.current = null; onCursor?.(null); }}
      onWheel={(e) => {
        const r = svgRef.current!.getBoundingClientRect();
        const sz = Math.min(r.width, r.height);
        const ox = r.left + (r.width - sz) / 2, oy = r.top + (r.height - sz) / 2;
        const ux = ((e.clientX - ox) / sz) * V, uy = ((e.clientY - oy) / sz) * V;
        const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        setView((v) => {
          const z = Math.max(0.75, Math.min(14, v.z * f));
          const s = z / v.z;
          return { z, x: ux - (ux - v.x) * s, y: uy - (uy - v.y) * s };
        });
      }}
      onClick={(e) => { if (addMode) { const p = toLL(e.clientX, e.clientY); onMapClick(p.lat, p.lon); } }}>

      <defs>
        <pattern id="sea" width="34" height="34" patternUnits="userSpaceOnUse">
          <rect width="34" height="34" fill="#051220" />
          <path d="M0,17 q8.5,-4.5 17,0 t17,0" fill="none" stroke="#0a2033" strokeWidth=".7" />
        </pattern>
        <radialGradient id="dome"><stop offset="55%" stopColor="#ffc247" stopOpacity=".045" /><stop offset="100%" stopColor="#ffc247" stopOpacity=".17" /></radialGradient>
        <EngagementDefs />
        <filter id="gl"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      <g transform={`translate(${view.x},${view.y}) scale(${view.z})`}>
        <rect x={-V * 2} y={-V * 2} width={V * 5} height={V * 5} fill="url(#sea)" />

        {/* ---------- REAL COUNTRIES ---------- */}
        {geo.countries.map((c) => (
          <path key={c.iso} d={c.d} fill={NEIGHBOUR_FILL[c.iso] ?? '#0e1310'}
            stroke={NEIGHBOUR_LINE[c.iso] ?? '#2b4038'} strokeWidth={(c.iso === 'IND' ? 1.3 : .9) * iz}
            strokeOpacity={c.iso === 'IND' ? .8 : .45} />
        ))}
        <path d={geo.coast} fill="none" stroke="#2f7ea6" strokeWidth={1.2 * iz} strokeOpacity=".65" />

        {/* country labels */}
        {layers.labels && geo.countries.map((c) => {
          const big = c.rings.reduce((a, b) => (a.length > b.length ? a : b), c.rings[0] ?? []);
          if (!big?.length) return null;
          const cx = big.reduce((s, p) => s + p[0], 0) / big.length;
          const cy = big.reduce((s, p) => s + p[1], 0) / big.length;
          return (
            <text key={c.iso} x={PX(cx)} y={PY(cy)} fill={NEIGHBOUR_LINE[c.iso]} fontSize={15 * iz}
              textAnchor="middle" letterSpacing={2 * iz} opacity=".38">{c.name.toUpperCase()}</text>
          );
        })}

        {/* real cities */}
        {layers.places && region.cities.map((p) => (
          <g key={p.n + p.x}>
            <circle cx={PX(p.x)} cy={PY(p.y)} r={(p.pop > 5e6 ? 2.6 : 1.7) * iz} fill="none" stroke="#5d7186" strokeWidth={.9 * iz} />
            <circle cx={PX(p.x)} cy={PY(p.y)} r={.8 * iz} fill="#5d7186" />
            {p.pop > 2.4e6 && (
              <text x={PX(p.x) + 5 * iz} y={PY(p.y) + 3 * iz} fill="#59728a" fontSize={9 * iz}>{p.n}</text>
            )}
          </g>
        ))}

        {/* ---------- GRATICULE ---------- */}
        {layers.grid && (
          <g>
            {gridLines.la.map((v) => (
              <g key={'la' + v}>
                <line x1={0} y1={PY(v)} x2={V} y2={PY(v)} stroke="#132234" strokeWidth={.7 * iz} />
                <text x={4 * iz} y={PY(v) - 3 * iz} fill="#2f4a60" fontSize={9 * iz}>{v.toFixed(1)}°N</text>
              </g>
            ))}
            {gridLines.lo.map((v) => (
              <g key={'lo' + v}>
                <line x1={PX(v)} y1={0} x2={PX(v)} y2={V} stroke="#132234" strokeWidth={.7 * iz} />
                <text x={PX(v) + 3 * iz} y={V - 5 * iz} fill="#2f4a60" fontSize={9 * iz}>{v.toFixed(1)}°E</text>
              </g>
            ))}
          </g>
        )}

        {/* ---------- DEFENDED SECTORS (real cities) ---------- */}
        {sc.assets.map((a) => {
          const on = sel?.kind === 'asset' && sel.id === a.id;
          const cx = PX(a.centroid.lon), cy = PY(a.centroid.lat);
          const hit = sol?.perThreat.some((r) => r.leaker &&
            sc.threats.find((x) => x.id === r.threatId)?.targetAssetId === a.id);
          return (
            <g key={a.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'asset', id: a.id }); }}>
              <circle cx={cx} cy={cy} r={a.radiusKm * kmToPx} fill="url(#dome)"
                stroke={hit ? COL.threat : COL.asset}
                strokeOpacity={on ? .9 : .5} strokeWidth={(on ? 1.9 : 1.3) * iz}
                strokeDasharray={`${7 * iz} ${5 * iz}`} />
              <g transform={`translate(${cx},${cy}) scale(${iz})`}>
                <ShieldIcon s={a.primary ? 1.15 : 0.95} col={hit ? COL.threat : COL.asset} halo={a.primary} />
                <text y={-19} fill={hit ? COL.threat : COL.asset} fontSize={a.primary ? 12.5 : 11}
                  textAnchor="middle" letterSpacing=".8" fontWeight={a.primary ? 700 : 600}
                  stroke="#040910" strokeWidth="3" paintOrder="stroke">
                  {a.name.toUpperCase()}
                </text>
                {(on || a.primary) && (
                  <text y={27} fill="var(--dim2)" fontSize="8" textAnchor="middle">PROTECTED ASSET</text>
                )}
              </g>
            </g>
          );
        })}

        {/* ---------- BATTERIES (real systems) ---------- */}
        {sc.areas.map((a) => {
          const on = a.active, used = selArea.has(a.id), hi = selS === a.id;
          const col = !on ? '#6b2f3d' : used ? '#ffb020' : '#436078';
          const cx = PX(a.centroid.lon), cy = PY(a.centroid.lat);
          const showRing = layers.rings && (used || hi || !on);
          return (
            <g key={a.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'site', id: a.id }); }}>
              {showRing && (
                <circle cx={cx} cy={cy} r={a.maxSlantRange * kmToPx} fill="none"
                  stroke={col} strokeOpacity={hi ? .55 : on ? (a.maxSlantRange > 150 ? .16 : .28) : .14}
                  strokeWidth={(hi ? 1.5 : 1) * iz}
                  strokeDasharray={used ? `${9 * iz} ${6 * iz}` : `${4 * iz} ${7 * iz}`} />
              )}
              {layers.rings && on && !used && !hi && (
                <circle cx={cx} cy={cy} r={a.maxSlantRange * kmToPx} fill="none" stroke={col}
                  strokeOpacity=".1" strokeWidth={.8 * iz} strokeDasharray={`${2 * iz} ${11 * iz}`} />
              )}
              <polygon points={a.polygon.map((p) => `${PX(p.lon)},${PY(p.lat)}`).join(' ')}
                fill={on ? (used ? 'rgba(255,176,32,.22)' : 'rgba(67,96,120,.2)') : 'rgba(107,47,61,.28)'}
                stroke={col} strokeWidth={(hi ? 2.2 : 1.4) * iz} />
              <g transform={`translate(${cx},${cy}) scale(${iz})`}>
                <BatteryIcon s={1.05} col={col} dead={!on} />
                <text y="-14" fill={col} fontSize="10" textAnchor="middle" fontWeight="600"
                  stroke="#040910" strokeWidth="2.6" paintOrder="stroke">{a.name}</text>
                <text y="20" fill={on ? '#5d7d96' : '#8a4550'} fontSize="8.5" textAnchor="middle"
                  stroke="#040910" strokeWidth="2.4" paintOrder="stroke">
                  {on ? `${a.inventory} RDY · ${a.maxSlantRange}km` : 'OFFLINE'}
                </text>
              </g>
            </g>
          );
        })}

        {/* ---------- ATTACKER LAUNCH POINTS ---------- */}
        {layers.origins && sc.threats.map((th) => (
          <g key={th.id} opacity=".8">
            <g transform={`translate(${PX(th.origin.p.lon)},${PY(th.origin.p.lat)}) scale(${iz})`}>
              <path d="M-6,6 L0,-7 L6,6 Z" fill="none" stroke="#f43f5e" strokeWidth="1.4" />
              <circle r="10" fill="none" stroke="#f43f5e" strokeWidth=".8" strokeDasharray="2 3" />
              <text y="21" fill="#a3505c" fontSize="8.5" textAnchor="middle">{th.origin.name}</text>
            </g>
          </g>
        ))}

        {/* ---------- INCOMING THREAT TRACKS (red, dashed, toward asset) ---------- */}
        {live.map(({ th, st, active, killed, first }) => {
          const past = th.trajectory.filter((s) => s.t <= t);
          const future = th.trajectory.filter((s) => s.t >= t);
          const isSel = selT === th.id;
          const P = (s: typeof past[0]) => `${PX(s.p.lon)},${PY(s.p.lat)}`;
          return (
            <g key={th.id}>
              {/* flown path — solid-ish red, fades once the threat is dead */}
              {layers.tracks && past.length > 1 && (
                <polyline points={past.map(P).join(' ')} fill="none" stroke={COL.threat}
                  strokeOpacity={killed ? .22 : .7} strokeWidth={(isSel ? 2.4 : 1.4) * iz} />
              )}
              {/* PREDICTED path to the protected asset — dashed + marching + arrowhead.
                  Direction of travel is unambiguous: it terminates at the asset. */}
              {layers.predict && !killed && future.length > 1 && (
                <polyline className="threat-line" points={future.map(P).join(' ')} fill="none"
                  stroke={COL.threat} strokeOpacity={isSel ? .85 : .5}
                  strokeWidth={(isSel ? 2 : 1.4) * iz}
                  strokeDasharray={`${7 * iz} ${5 * iz}`} markerEnd="url(#arrowThreat)" />
              )}
              {layers.altticks && isSel && th.trajectory.filter((_, i) => i % 18 === 0).map((s, i) => (
                <g key={i}>
                  <circle cx={PX(s.p.lon)} cy={PY(s.p.lat)} r={1.5 * iz} fill={COL.asset} fillOpacity=".75" />
                  <text x={PX(s.p.lon) + 4 * iz} y={PY(s.p.lat) - 3 * iz} fill="#8a7a52" fontSize={7.5 * iz}>
                    {(s.p.alt / 1000).toFixed(0)}
                  </text>
                </g>
              ))}
              {/* where it would strike if unengaged */}
              {!killed && layers.predict && (
                <g opacity=".9" transform={`translate(${PX(th.impact.p.lon)},${PY(th.impact.p.lat)}) scale(${iz})`}>
                  <circle r="6" fill="none" stroke={COL.threat} strokeWidth="1.4" strokeDasharray="3 2" />
                  <path d="M-9,0 h18 M0,-9 v18" stroke={COL.threat} strokeWidth="1" strokeOpacity=".6" />
                  {isSel && <text y="-12" fill={COL.threat} fontSize="8" textAnchor="middle">IMPACT IF UNENGAGED</text>}
                </g>
              )}
              {/* live track symbol */}
              {active && st && !killed && (
                <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'threat', id: th.id }); }}>
                  {isSel && <circle cx={PX(st.p.lon)} cy={PY(st.p.lat)} r={18 * iz} fill="none" stroke={COL.asset} strokeWidth={iz} strokeDasharray={`${3 * iz} ${3 * iz}`} />}
                  <g transform={`translate(${PX(st.p.lon)},${PY(st.p.lat)}) scale(${iz})`}>
                    <path d={symbolPath(th.cls)} fill={COL.threat} fillOpacity=".9" stroke="#ffd7dc" strokeWidth="1.3" strokeLinejoin="round" />
                    <text x="13" y="-5" fill="#ffb3ba" fontSize="10.5">{th.callsign}</text>
                    <text x="13" y="6" fill="#8a6268" fontSize="8.5">
                      {th.cls} · {(st.p.alt / 1000).toFixed(0)}km · →{th.targetAssetName}
                    </text>
                  </g>
                </g>
              )}
              {/* INTERCEPT BURST — threat destroyed in the air, at its own coordinates */}
              {killed && first && (
                <g filter="url(#glowSoft)"
                  transform={`translate(${PX(first.option.interceptPoint.lon)},${PY(first.option.interceptPoint.lat)}) scale(${iz})`}>
                  <BurstIcon s={1.1} />
                  {isSel && (
                    <text y="-17" fill={COL.burst} fontSize="8.5" textAnchor="middle">
                      DESTROYED {first.option.standoffFromAssetKm ?? '—'} km FROM ASSET
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* ---------- OUTGOING INTERCEPTOR RESPONSE (blue, solid, from battery) ---------- */}
        {layers.engage && sol?.shots.map((s, i) => {
          const a = sc.areas.find((x) => x.id === s.areaId)!;
          const o = s.option;
          if (t < o.tLaunch) return null;
          const f = Math.min(1, (t - o.tLaunch) / Math.max(.1, o.tIntercept - o.tLaunch));
          const x0 = PX(a.centroid.lon), y0 = PY(a.centroid.lat);
          const x1 = PX(o.interceptPoint.lon), y1 = PY(o.interceptPoint.lat);
          const done = t >= o.tIntercept;
          return (
            <g key={i}>
              {/* planned fly-out corridor */}
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={COL.intcp}
                strokeOpacity={done ? .12 : .28} strokeWidth={.9 * iz}
                strokeDasharray={`${3 * iz} ${5 * iz}`} />
              {/* interceptor in flight: solid blue, arrowhead leading, moving OUTWARD */}
              {!done && (
                <>
                  <line className="intcp-line" x1={x0} y1={y0}
                    x2={x0 + (x1 - x0) * f} y2={y0 + (y1 - y0) * f}
                    stroke={COL.intcp} strokeWidth={2.2 * iz} strokeOpacity=".97"
                    strokeDasharray={`${10 * iz} ${5 * iz}`} markerEnd="url(#arrowIntcp)" />
                  <circle cx={x0 + (x1 - x0) * f} cy={y0 + (y1 - y0) * f} r={3.2 * iz} fill="#dbeeff" />
                </>
              )}
              {/* aim point */}
              <circle cx={x1} cy={y1} r={2.6 * iz} fill="none" stroke={COL.intcp}
                strokeWidth={1.2 * iz} strokeOpacity=".55" />
            </g>
          );
        })}
      </g>

      {/* ---------- FIXED OVERLAYS ---------- */}
      <g transform="translate(36,40)">
        <path d="M0,-14 L4.6,6.5 L0,2 L-4.6,6.5 Z" fill="#4a6076" />
        <text y="19" fill="#4a6076" fontSize="9" textAnchor="middle">N</text>
      </g>
      {(() => {
        const targetPx = 150;
        const rawKm = (targetPx / (kmToPx * view.z));
        const nice = [10, 20, 25, 50, 100, 150, 200, 250, 500].reduce((a, b) => Math.abs(b - rawKm) < Math.abs(a - rawKm) ? b : a, 10);
        const w = nice * kmToPx * view.z;
        return (
          <g transform={`translate(${V - w - 26},${V - 24})`}>
            <line x1="0" y1="0" x2={w} y2="0" stroke="#5d7186" strokeWidth="1.5" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#5d7186" strokeWidth="1.5" />
            <line x1={w} y1="-4" x2={w} y2="4" stroke="#5d7186" strokeWidth="1.5" />
            <text x={w / 2} y="-6" fill="#5d7186" fontSize="9.5" textAnchor="middle">{nice} km</text>
          </g>
        );
      })()}
      <text x={V - 12} y="22" fill="#33546b" fontSize="10" textAnchor="end">ZOOM ×{view.z.toFixed(1)}</text>
      {Math.abs(view.z - 1) > 0.02 && (
        <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setView({ x: 0, y: 0, z: 1 }); }}>
          <rect x={V - 92} y={32} width="80" height="19" fill="#0e141c" stroke="#25455c" rx="2" />
          <text x={V - 52} y={45} fill="#8fa8bd" fontSize="9.5" textAnchor="middle">RESET VIEW</text>
        </g>
      )}
      {addMode && (
        <text x={V / 2} y="26" fill="#ffb020" fontSize="15" textAnchor="middle" letterSpacing="2">
          SELECT AIMPOINT — CLICK MAP TO INJECT TRACK
        </text>
      )}
    </svg>
  );
}
