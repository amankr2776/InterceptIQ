'use client';
// InterceptIQ
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { region, SECTORS } from '@/lib/theatre';
import type { NationalLaydown, NationalBattery } from '@/lib/national';
import { useElementSize } from '@/lib/useElementSize';

const V = 1000;
/** National window covering India + neighbours. */
const WIN = { w: 66.5, e: 97.5, s: 6.0, n: 37.5 };

const FILL: Record<string, string> = {
  IND: '#0d1a15', PAK: '#130f14', CHN: '#0f1017', NPL: '#0e1310',
  BTN: '#0e1310', BGD: '#0d1315', LKA: '#0e1310', MMR: '#0d1315', AFG: '#130f14',
};
const LINE: Record<string, string> = {
  IND: '#3a6b50', PAK: '#4a2f38', CHN: '#33354f', NPL: '#2b4038',
  BTN: '#2b4038', BGD: '#284048', LKA: '#2b4038', MMR: '#284048', AFG: '#4a2f38',
};

export type NatSel =
  | { kind: 'sector'; id: string }
  | { kind: 'battery'; id: string }
  | { kind: 'radar'; id: string }
  | null;

interface Props {
  lay: NationalLaydown;
  sel: NatSel;
  onSel: (s: NatSel) => void;
  hover: string | null;
  onHover: (id: string | null) => void;
  layers: Record<string, boolean>;
  onCursor?: (c: { lat: number; lon: number } | null) => void;
}

export default function IndiaMap({ lay, sel, onSel, hover, onHover, layers, onCursor }: Props) {
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: wrapRef, size } = useElementSize<HTMLDivElement>();

  // Match the container aspect so the map fills the panel instead of
  // letterboxing into a square and rendering small.
  const aspect = size.w / size.h;
  const VW = aspect >= 1 ? V * aspect : V;
  const VH = aspect >= 1 ? V : V / aspect;
  const FIT = 0.96;
  const base = (Math.min(VW, VH) / V) * FIT;
  const offX = (VW - V * base) / 2;
  const offY = (VH - V * base) / 2;

  // equirectangular fit of WIN into a square viewbox
  const lonSpan = WIN.e - WIN.w;
  const latSpan = WIN.n - WIN.s;
  const PX = useCallback((lon: number) => ((lon - WIN.w) / lonSpan) * V, [lonSpan]);
  const PY = useCallback((lat: number) => V - ((lat - WIN.s) / latSpan) * V, [latSpan]);
  /** km -> px, using the mid-latitude scale (adequate for a national overview). */
  const midLat = (WIN.n + WIN.s) / 2;
  const kmToPx = (V / lonSpan) / (111.32 * Math.cos((midLat * Math.PI) / 180));

  const geo = useMemo(() => {
    const path = (segs: [number, number][][], close: boolean) =>
      segs.map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${PX(p[0]).toFixed(1)},${PY(p[1]).toFixed(1)}`).join('') + (close ? 'Z' : '')).join(' ');
    const admByIso = new Map<string, string[]>();
    for (const u of region.admin1) {
      const arr = admByIso.get(u.iso) ?? [];
      arr.push(path(u.r, true));
      admByIso.set(u.iso, arr);
    }
    return {
      countries: region.countries.map((c) => ({ ...c, d: path(c.rings, true) })),
      coast: path(region.coast, false),
      admin: Array.from(admByIso.entries()).map(([iso, ds]) => ({ iso, d: ds.join(' ') })),
    };
  }, [PX, PY]);

  const toVB = useCallback((cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { ux: ((cx - r.left) / r.width) * VW, uy: ((cy - r.top) / r.height) * VH };
  }, [VW, VH]);

  const toLL = useCallback((cx: number, cy: number) => {
    const { ux, uy } = toVB(cx, cy);
    const wx = ((ux - view.x) / view.z - offX) / base;
    const wy = ((uy - view.y) / view.z - offY) / base;
    return { lon: WIN.w + (wx / V) * lonSpan, lat: WIN.s + ((V - wy) / V) * latSpan };
  }, [toVB, view, offX, offY, base, lonSpan, latSpan]);

  const iz = 1 / (view.z * base);
  const ICON = 1.5;
  const selSector = sel?.kind === 'sector' ? sel.id : null;
  const selBat = sel?.kind === 'battery' ? sel.id : null;
  const selRadar = sel?.kind === 'radar' ? sel.id : null;

  const layerCol = (l: NationalBattery['layer']) =>
    l === 'BMD' ? '#a78bfa' : l === 'Long-range' ? '#ffb020'
    : l === 'Medium-range' ? '#34d399' : '#38bdf8';

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
    <svg ref={svgRef} viewBox={`0 0 ${VW.toFixed(0)} ${VH.toFixed(0)}`} preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block', background: '#040910', cursor: 'grab' }}
      onMouseDown={(e) => { drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
      onMouseMove={(e) => {
        onCursor?.(toLL(e.clientX, e.clientY));
        if (!drag.current) return;
        const r = svgRef.current!.getBoundingClientRect();
        if (Math.abs(e.clientX - drag.current.sx) + Math.abs(e.clientY - drag.current.sy) > 3) drag.current.moved = true;
        setView((v) => ({ ...v, x: drag.current!.vx + ((e.clientX - drag.current!.sx) / r.width) * VW,
                                 y: drag.current!.vy + ((e.clientY - drag.current!.sy) / r.height) * VH }));
      }}
      onMouseUp={() => { drag.current = null; }}
      onMouseLeave={() => { drag.current = null; onCursor?.(null); onHover(null); }}
      onWheel={(e) => {
        const { ux, uy } = toVB(e.clientX, e.clientY);
        const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        setView((v) => {
          const z = Math.max(0.85, Math.min(16, v.z * f));
          const s = z / v.z;
          return { z, x: ux - (ux - v.x) * s, y: uy - (uy - v.y) * s };
        });
      }}>

      <defs>
        <pattern id="nsea" width="34" height="34" patternUnits="userSpaceOnUse">
          <rect width="34" height="34" fill="#051220" />
          <path d="M0,17 q8.5,-4.5 17,0 t17,0" fill="none" stroke="#0a2033" strokeWidth=".7" />
        </pattern>
        <radialGradient id="ndome"><stop offset="62%" stopColor="#38bdf8" stopOpacity=".05" /><stop offset="100%" stopColor="#38bdf8" stopOpacity=".22" /></radialGradient>
        <radialGradient id="nradar"><stop offset="88%" stopColor="#a78bfa" stopOpacity="0" /><stop offset="100%" stopColor="#a78bfa" stopOpacity=".055" /></radialGradient>
      </defs>

      <g transform={`translate(${view.x},${view.y}) scale(${view.z}) translate(${offX},${offY}) scale(${base})`}>
        <rect x={-V * 4} y={-V * 4} width={V * 9} height={V * 9} fill="url(#nsea)" />

        {geo.countries.map((c) => (
          <path key={c.iso} d={c.d} fill={FILL[c.iso] ?? '#0e1310'} stroke={LINE[c.iso] ?? '#2b4038'}
            strokeWidth={(c.iso === 'IND' ? 1.5 : .9) * iz} strokeOpacity={c.iso === 'IND' ? .9 : .45} />
        ))}
        {layers.states && geo.admin.map((a) => (
          <path key={a.iso} d={a.d} fill="none" stroke={LINE[a.iso] ?? '#2b4038'}
            strokeWidth={0.65 * iz} strokeOpacity={a.iso === 'IND' ? .5 : .28}
            strokeDasharray={`${2.5 * iz} ${2.5 * iz}`} />
        ))}
        <path d={geo.coast} fill="none" stroke="#2f7ea6" strokeWidth={1 * iz} strokeOpacity=".55" />

        {layers.states && view.z >= 1.6 && region.admin1
          .filter((u) => u.a > 0.8)
          .map((u) => (
            <text key={u.iso + u.n} x={PX(u.c[0])} y={PY(u.c[1])}
              fill={LINE[u.iso] ?? '#2b4038'} fontSize={8 * iz} textAnchor="middle"
              opacity=".7" stroke="#040910" strokeWidth={2 * iz} paintOrder="stroke">
              {u.n.toUpperCase()}
            </text>
          ))}

        {layers.labels && region.countryLabels.map((c) => (
          <text key={c.iso} x={PX(c.c[0])} y={PY(c.c[1])} fill={LINE[c.iso] ?? '#3a5c48'}
            fontSize={15 * c.s * iz} textAnchor="middle" letterSpacing={2.4 * c.s * iz}
            opacity={c.iso === 'IND' ? .42 : .6} fontWeight={c.iso === 'IND' ? 700 : 500}
            stroke="#040910" strokeWidth={2.8 * iz} paintOrder="stroke">{c.n}</text>
        ))}

        {/* graticule */}
        {layers.grid && (() => {
          const step = latSpan / view.z > 16 ? 5 : latSpan / view.z > 7 ? 2 : 1;
          const out: React.ReactNode[] = [];
          for (let v = Math.ceil(WIN.s / step) * step; v < WIN.n; v += step) {
            out.push(<line key={'la' + v} x1={0} y1={PY(v)} x2={V} y2={PY(v)} stroke="#122032" strokeWidth={.6 * iz} />);
            out.push(<text key={'lat' + v} x={4 * iz} y={PY(v) - 3 * iz} fill="#2c4459" fontSize={8.5 * iz}>{v}°N</text>);
          }
          for (let v = Math.ceil(WIN.w / step) * step; v < WIN.e; v += step) {
            out.push(<line key={'lo' + v} x1={PX(v)} y1={0} x2={PX(v)} y2={V} stroke="#122032" strokeWidth={.6 * iz} />);
            out.push(<text key={'lot' + v} x={PX(v) + 3 * iz} y={V - 5 * iz} fill="#2c4459" fontSize={8.5 * iz}>{v}°E</text>);
          }
          return out;
        })()}

        {/* ---------- RADAR COVERAGE ---------- */}
        {layers.radar && lay.radars.map((r) => {
          const on = selRadar === r.id || hover === r.sectorId;
          return (
            <g key={r.id} style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'radar', id: r.id }); }}>
              <circle cx={PX(r.lon)} cy={PY(r.lat)} r={r.detectKm * kmToPx}
                fill={on ? 'url(#nradar)' : 'none'}
                stroke="#a78bfa" strokeOpacity={on ? .55 : .13} strokeWidth={(on ? 1.4 : .8) * iz}
                strokeDasharray={`${10 * iz} ${9 * iz}`} />
              <g transform={`translate(${PX(r.lon)},${PY(r.lat)}) scale(${iz})`}>
                <g transform={`scale(${ICON})`}>
                  <path d="M-6,5 L0,-7 L6,5 Z" fill="none" stroke="#a78bfa" strokeWidth="1.3" />
                  <path d="M-9,5 h18" stroke="#a78bfa" strokeWidth="1.3" />
                </g>
              </g>
            </g>
          );
        })}

        {/* ---------- SECTOR DOMES ---------- */}
        {SECTORS.map((s, si) => {
          const on = selSector === s.id || hover === s.id;
          // stagger vertical offset in dense clusters
          const dy = on ? -15 : [-15, -24, -33, -24][si % 4];
          return (
            <g key={s.id} style={{ cursor: 'pointer' }}
              onMouseEnter={() => onHover(s.id)} onMouseLeave={() => onHover(null)}
              onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'sector', id: s.id }); }}>
              <circle cx={PX(s.lon)} cy={PY(s.lat)} r={s.radiusKm * kmToPx} fill="url(#ndome)"
                stroke="#38bdf8" strokeOpacity={on ? .9 : .5} strokeWidth={(on ? 2 : 1.2) * iz}
                strokeDasharray={`${6 * iz} ${4 * iz}`} />
              <g transform={`translate(${PX(s.lon)},${PY(s.lat)}) scale(${iz})`}>
                <g transform={`scale(${ICON})`}>
                  <path d="M-8,0 h16 M0,-8 v16" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity=".9" />
                  <circle r="3" fill="none" stroke="#38bdf8" strokeWidth="1.3" />
                </g>
                <text y={dy * ICON} fill={on ? '#8fd8fb' : '#5ecbf9'} fontSize={(on ? 13 : 11) * ICON}
                  textAnchor="middle" letterSpacing=".7" fontWeight={on ? 700 : 600}
                  stroke="#040910" strokeWidth={3} paintOrder="stroke">
                  {s.name.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}

        {/* ---------- BATTERIES + ENGAGEMENT ENVELOPES ---------- */}
        {lay.batteries.map((b) => {
          const on = selBat === b.id;
          const sectorOn = hover === b.sectorId || selSector === b.sectorId;
          const col = !b.active ? '#6b2f3d' : layerCol(b.layer);
          const show = layers.envelopes && (on || sectorOn || !b.active);
          return (
            <g key={b.id} style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'battery', id: b.id }); }}>
              {show && (
                <circle cx={PX(b.lon)} cy={PY(b.lat)} r={b.spec.rangeKm[1] * kmToPx} fill="none"
                  stroke={col} strokeOpacity={on ? .6 : .26} strokeWidth={(on ? 1.5 : 1) * iz}
                  strokeDasharray={b.active ? '0' : `${4 * iz} ${6 * iz}`} />
              )}
              {layers.envelopes && !show && b.active && (
                <circle cx={PX(b.lon)} cy={PY(b.lat)} r={b.spec.rangeKm[1] * kmToPx} fill="none"
                  stroke={col} strokeOpacity=".08" strokeWidth={.7 * iz} strokeDasharray={`${2 * iz} ${9 * iz}`} />
              )}
              <g transform={`translate(${PX(b.lon)},${PY(b.lat)}) scale(${iz})`}>
                <g transform={`scale(${ICON})`}>
                  <rect x="-5.5" y="-4" width="11" height="8" fill="#040910" stroke={col} strokeWidth={on ? 1.8 : 1.3} />
                  <path d="M-5.5,-4 L0,-9 L5.5,-4" fill="none" stroke={col} strokeWidth={on ? 1.8 : 1.3} />
                  {!b.active && <path d="M-8,-8 L8,8 M8,-8 L-8,8" stroke="#f43f5e" strokeWidth="1.8" />}
                </g>
                {(on || sectorOn) && (
                  <text y={17 * ICON} fill={col} fontSize={10 * ICON} textAnchor="middle"
                    stroke="#040910" strokeWidth={2.4} paintOrder="stroke">{b.spec.name} {b.unit}</text>
                )}
              </g>
            </g>
          );
        })}
      </g>

      {/* fixed overlays */}
      <g transform={`translate(38,42)`}>
        <path d="M0,-13 L4.3,6 L0,1.8 L-4.3,6 Z" fill="#4a6076" />
        <text y="18" fill="#4a6076" fontSize="8.5" textAnchor="middle">N</text>
      </g>
      {(() => {
        const target = 150;
        const raw = target / (kmToPx * view.z * base);
        const nice = [50, 100, 200, 250, 500, 1000].reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a, 100);
        const w = nice * kmToPx * view.z * base;
        return (
          <g transform={`translate(${VW - w - 28},${VH - 24})`}>
            <line x1="0" y1="0" x2={w} y2="0" stroke="#5d7186" strokeWidth="1.4" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#5d7186" strokeWidth="1.4" />
            <line x1={w} y1="-4" x2={w} y2="4" stroke="#5d7186" strokeWidth="1.4" />
            <text x={w / 2} y="-6" fill="#5d7186" fontSize="9" textAnchor="middle">{nice} km</text>
          </g>
        );
      })()}
      <text x={VW - 14} y="22" fill="#33546b" fontSize="10.5" textAnchor="end">ZOOM ×{view.z.toFixed(1)}</text>
      {Math.abs(view.z - 1) > 0.02 && (
        <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setView({ x: 0, y: 0, z: 1 }); }}>
          <rect x={VW - 94} y={30} width="80" height="19" fill="#0e141c" stroke="#25455c" rx="2" />
          <text x={VW - 54} y={43} fill="#8fa8bd" fontSize="9.5" textAnchor="middle">RESET VIEW</text>
        </g>
      )}
    </svg>
    </div>
  );
}
