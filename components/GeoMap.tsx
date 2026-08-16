'use client';
// InterceptIQ
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { stateAt } from '@/lib/geometry';
import { region } from '@/lib/theatre';
import { THREATS } from '@/lib/systems';
import { batteryStatuses, type BatteryState } from '@/lib/alert';
import { useElementSize } from '@/lib/useElementSize';
import FxLayer from './FxLayer';
import { KM_LAT, kmLon } from '@/lib/scenario';
import {
  killTimes, shotPhase, interceptorAt, interceptorHeading,
  salvoSide, salvoLoft, flyoutPath,
} from '@/lib/flight';
import { ShieldIcon, BurstIcon, BatteryIcon, EngagementDefs, MissileBody, InterceptorBody, DroneIcon, launcherClassFor, symbolPath, COL } from './symbols';

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
  /** Enable the particle effects overlay (motor plumes, detonations). */
  fx?: boolean;
  playing?: boolean;
}

const V = 1000;

/** Real weapon name for a track, e.g. "JF-17 Thunder", falling back to the
 *  broad class if the id is ever unknown. This is the label the operator
 *  actually needs: what is attacking, not an internal callsign. */
function threatName(systemId: string, cls: string): string {
  return THREATS.find((x) => x.id === systemId)?.name ?? cls;
}

/** Ground-track heading (deg, 0 = north) of a threat at time t, for icon rotation. */
function headingAt(th: { trajectory: { t: number; p: { lat: number; lon: number } }[] }, t: number) {
  const tr = th.trajectory;
  let i = tr.findIndex((s) => s.t >= t);
  if (i < 1) i = 1;
  if (i >= tr.length) i = tr.length - 1;
  const a = tr[i - 1].p, b = tr[i].p;
  const dLon = (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180);
  const dLat = b.lat - a.lat;
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

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

export default function GeoMap({ sc, sol, t, sel, onSel, addMode, onMapClick, layers, onCursor, fx = false, playing = false }: Props) {
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: wrapRef, size } = useElementSize<HTMLDivElement>();

  /* Build a viewBox matching the container's aspect ratio and fit the AOI
   * inside it with a small margin. A fixed square viewBox letterboxed into a
   * wide panel, shrinking everything and wasting horizontal space. */
  const aspect = size.w / size.h;
  const VW = aspect >= 1 ? V * aspect : V;
  const VH = aspect >= 1 ? V : V / aspect;
  const FIT = 0.94;
  // Scale to the SHORTER axis so the whole AOI stays visible, then centre it
  // in the longer axis. Sea/land tiles extend well beyond, so the extra width
  // shows real surrounding geography rather than blank space.
  const base = (Math.min(VW, VH) / V) * FIT;
  const offX = (VW - V * base) / 2;
  const offY = (VH - V * base) / 2;

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
    // internal admin boundaries, grouped by parent country so each can be
    // tinted to its national colour
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

  /** Client pixel -> viewBox units. */
  const toVB = useCallback((cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { ux: ((cx - r.left) / r.width) * VW, uy: ((cy - r.top) / r.height) * VH };
  }, [VW, VH]);

  const toLL = useCallback((cx: number, cy: number) => {
    const { ux, uy } = toVB(cx, cy);
    // undo pan/zoom, then the base fit transform
    const wx = ((ux - view.x) / view.z - offX) / base;
    const wy = ((uy - view.y) / view.z - offY) / base;
    return { lon: lon0 + (wx / V) * lonSpan, lat: lat0 + ((V - wy) / V) * latSpan };
  }, [toVB, view, offX, offY, base, lat0, lon0, latSpan, lonSpan]);

  /* lat/lon -> pixel inside the wrapper, matching exactly what the SVG draws.
   * The FX canvas is the same size as the wrapper, so effects register with
   * the vector geometry at any pan/zoom. */
  const projectPx = useCallback((lat: number, lon: number) => {
    if (!size.w || !size.h) return null;
    const vx = PX(lon), vy = PY(lat);
    const wx = (vx * base + offX) * view.z + view.x;   // viewBox units
    const wy = (vy * base + offY) * view.z + view.y;
    return { x: (wx / VW) * size.w, y: (wy / VH) * size.h };
  }, [PX, PY, base, offX, offY, view, VW, VH, size.w, size.h]);

  const live = useMemo(() => sc.threats.map((th) => {
    const active = t >= th.trajectory[0].t && t <= th.impact.t;
    const st = stateAt(th, Math.min(t, th.impact.t));
    const res = sol?.perThreat.find((p) => p.threatId === th.id);
    const first = res?.shots.slice().sort((a, b) => a.option.tIntercept - b.option.tIntercept)[0];
    const killed = !!first && t >= first.option.tIntercept;
    return { th, st, active, res, first, killed };
  }), [sc, sol, t]);

  /* When each threat actually dies — the earliest intercept among the shots
   * committed to it. Rounds arriving later are wasted and must be destructed
   * rather than drawn flying at a dead target. */
  const killT = useMemo(() => killTimes(sol), [sol]);

  const selArea = new Set(sol?.selectedAreaIds ?? []);
  /* Live readiness per battery — READY / ALERT / TRACKING / LOCKED / FIRING.
   * Drives colour, the alert ring and the status caption on the map. */
  const statusById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof batteryStatuses>[0]>();
    for (const st of batteryStatuses(sc, sol, t)) m.set(st.areaId, st);
    return m;
  }, [sc, sol, t]);
  const selT = sel?.kind === 'threat' ? sel.id : null;
  const selS = sel?.kind === 'site' ? sel.id : null;
  /* Inverse scale for glyphs: cancels pan-zoom AND the base fit so icons keep
   * a constant on-screen size. ICON is an extra multiplier to make vehicles
   * and launchers physically larger and readable. */
  const iz = 1 / (view.z * base);
  const ICON = 1.55;

  /**
   * LABEL DE-COLLISION
   * ==================
   * Batteries, defended assets and live tracks each carry a STACK of text
   * (name, readiness state, inventory), and at theatre scale several stacks
   * routinely land on top of one another — producing unreadable output like
   * "SPYDER Foxtrot" printed through "JAIPUR" and "8 RDY · 400km".
   *
   * Measured before this pass: 528 substantial label overlaps across 39
   * sampled frames.
   *
   * Each stack is modelled as a single box of its real height and pushed
   * vertically as a unit until it clears everything already placed. Greedy
   * and deterministic. Ordered by importance — attacker types first, then
   * assets, then batteries — so the labels that matter keep their natural
   * position and the rest give way.
   *
   * Returns id -> vertical offset in LOCAL (pre-scale) units.
   */
  const labelOffsets = useMemo(() => {
    const placed: { x: number; y0: number; y1: number }[] = [];
    const out = new Map<string, number>();
    const HW = 58;            // half-width in local units; names are wide

    /** `top`/`bot` are the stack's extent in local units around the anchor. */
    const put = (id: string, cxp: number, cyp: number, top: number, bot: number) => {
      // work in viewBox units so comparisons are scale-correct
      const x = cxp, h0 = top * iz, h1 = bot * iz, hw = HW * iz;
      let dy = 0;
      for (let k = 0; k < 18; k++) {
        dy = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 11 * iz;
        // PAD is breathing room: two stacks that merely touch still read as
        // one smear, so treat near-adjacency as a collision too.
        const PAD = 5 * iz;
        const a0 = cyp + h0 + dy - PAD, a1 = cyp + h1 + dy + PAD;
        const clash = placed.some((p) =>
          Math.abs(p.x - x) < hw * 2 && a0 < p.y1 && a1 > p.y0);
        if (!clash) break;
      }
      placed.push({ x, y0: cyp + h0 + dy, y1: cyp + h1 + dy });
      out.set(id, dy / iz);
    };

    // 1. live attacker labels — the headline information
    for (const { th, st, active, killed } of live) {
      if (!active || !st || killed) continue;
      put('t:' + th.id, PX(st.p.lon), PY(st.p.lat), -12 * ICON, 11 * ICON);
    }
    // 2. defended assets
    for (const a of sc.assets) {
      put('a:' + a.id, PX(a.centroid.lon), PY(a.centroid.lat), -25 * ICON, -13 * ICON);
    }
    // 3. batteries, whose stack can run from the state line above the icon
    //    down through the inventory line below it
    for (const a of sc.areas) {
      const s2 = statusById.get(a.id)?.state ?? 'READY';
      const reacting = s2 === 'ALERT' || s2 === 'TRACKING' || s2 === 'LOCKED' || s2 === 'FIRING';
      if (!(selArea.has(a.id) || selS === a.id || !a.active || reacting)) continue;
      // stack runs from the readiness caption (-27) down past the inventory line
      put("b:" + a.id, PX(a.centroid.lon), PY(a.centroid.lat), -42, 24 * ICON);
    }
    return out;
  }, [live, sc.areas, sc.assets, statusById, selArea, selS, PX, PY, iz, ICON]);


  // graticule at whole degrees
  const gridLines = useMemo(() => {
    const step = latSpan > 8 ? 2 : latSpan > 4 ? 1 : 0.5;
    const la: number[] = [], lo: number[] = [];
    for (let v = Math.ceil(lat0 / step) * step; v < lat0 + latSpan; v += step) la.push(+v.toFixed(2));
    for (let v = Math.ceil(lon0 / step) * step; v < lon0 + lonSpan; v += step) lo.push(+v.toFixed(2));
    return { la, lo };
  }, [lat0, lon0, latSpan, lonSpan]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
    <svg ref={svgRef} viewBox={`0 0 ${VW.toFixed(0)} ${VH.toFixed(0)}`} preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block', background: '#040910',
        cursor: addMode ? 'crosshair' : 'grab' }}
      onMouseDown={(e) => { if (!addMode) drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
      onMouseMove={(e) => {
        const p = toLL(e.clientX, e.clientY); onCursor?.(p);
        if (!drag.current) return;
        const r = svgRef.current!.getBoundingClientRect();
        if (Math.abs(e.clientX - drag.current.sx) + Math.abs(e.clientY - drag.current.sy) > 3) drag.current.moved = true;
        setView((v) => ({ ...v, x: drag.current!.vx + ((e.clientX - drag.current!.sx) / r.width) * VW,
                                 y: drag.current!.vy + ((e.clientY - drag.current!.sy) / r.height) * VH }));
      }}
      onMouseUp={() => { drag.current = null; }}
      onMouseLeave={() => { drag.current = null; onCursor?.(null); }}
      onWheel={(e) => {
        const { ux, uy } = toVB(e.clientX, e.clientY);
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

      <g transform={`translate(${view.x},${view.y}) scale(${view.z}) translate(${offX},${offY}) scale(${base})`}>
        <rect x={-V * 4} y={-V * 4} width={V * 9} height={V * 9} fill="url(#sea)" />

        {/* ---------- REAL COUNTRIES ---------- */}
        {geo.countries.map((c) => (
          <path key={c.iso} d={c.d} fill={NEIGHBOUR_FILL[c.iso] ?? '#0e1310'}
            stroke={NEIGHBOUR_LINE[c.iso] ?? '#2b4038'} strokeWidth={(c.iso === 'IND' ? 1.3 : .9) * iz}
            strokeOpacity={c.iso === 'IND' ? .8 : .45} />
        ))}
        {/* internal state / province boundaries */}
        {layers.states && geo.admin.map((a) => (
          <path key={a.iso} d={a.d} fill="none"
            stroke={NEIGHBOUR_LINE[a.iso] ?? '#2b4038'}
            strokeWidth={0.7 * iz} strokeOpacity={a.iso === 'IND' ? .55 : .3}
            strokeDasharray={`${2.5 * iz} ${2.5 * iz}`} />
        ))}
        <path d={geo.coast} fill="none" stroke="#2f7ea6" strokeWidth={1.2 * iz} strokeOpacity=".65" />

        {/* state / province names — only when zoomed in enough to be legible */}
        {layers.states && view.z >= 1.9 && region.admin1
          .filter((u) => u.a > 0.55)
          .map((u) => (
            <text key={u.iso + u.n} x={PX(u.c[0])} y={PY(u.c[1])}
              fill={NEIGHBOUR_LINE[u.iso] ?? '#2b4038'} fontSize={8.5 * iz}
              textAnchor="middle" opacity=".72" letterSpacing={.4 * iz}
              stroke="#040910" strokeWidth={2.2 * iz} paintOrder="stroke">
              {u.n.toUpperCase()}
            </text>
          ))}

        {/* country labels */}
        {layers.labels && region.countryLabels.map((c) => (
          <text key={c.iso} x={PX(c.c[0])} y={PY(c.c[1])}
            fill={NEIGHBOUR_LINE[c.iso] ?? '#3a5c48'}
            fontSize={17 * c.s * iz} textAnchor="middle"
            letterSpacing={2.6 * c.s * iz} opacity={c.iso === 'IND' ? .5 : .62}
            fontWeight={c.iso === 'IND' ? 700 : 500}
            stroke="#040910" strokeWidth={3 * iz} paintOrder="stroke">
            {c.n}
          </text>
        ))}

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
                <ShieldIcon s={(a.primary ? 1.25 : 1.05) * ICON} col={hit ? COL.threat : COL.asset} halo={a.primary} />
                <text y={-19 * ICON + (labelOffsets.get('a:' + a.id) ?? 0)}
                  fill={hit ? COL.threat : COL.asset} fontSize={(a.primary ? 13.5 : 12) * ICON}
                  textAnchor="middle" letterSpacing=".8" fontWeight={a.primary ? 700 : 600}
                  stroke="#040910" strokeWidth="3" paintOrder="stroke">
                  {a.name.toUpperCase()}
                </text>
                {on && (
                  <text y={27} fill="var(--dim2)" fontSize="7.5" textAnchor="middle"
                    stroke="#040910" strokeWidth="2.4" paintOrder="stroke">PROTECTED ASSET</text>
                )}
              </g>
            </g>
          );
        })}

        {/* ---------- BATTERIES (real systems) ---------- */}
        {sc.areas.map((a) => {
          const on = a.active, used = selArea.has(a.id), hi = selS === a.id;
          const st = statusById.get(a.id);
          const stName: BatteryState = st?.state ?? 'READY';
          // a battery that is reacting takes its readiness colour
          const active = stName === 'ALERT' || stName === 'TRACKING' ||
                         stName === 'LOCKED' || stName === 'FIRING';
          const stCol = stName === 'ALERT' ? '#ffb020'
            : stName === 'TRACKING' ? '#38bdf8'
            : stName === 'LOCKED' ? '#a78bfa'
            : stName === 'FIRING' ? COL.intcp : COL.intcp;
          const col = !on ? '#6b2f3d' : active ? stCol : used ? COL.intcp : '#3c5b74';
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
              {/* readiness ring — grows and brightens as the battery works up
                  through ALERT -> TRACKING -> LOCKED -> FIRING */}
              {on && active && (
                <g transform={`translate(${cx},${cy})`}>
                  <circle r={(stName === 'FIRING' ? 22 : stName === 'LOCKED' ? 19 : 16) * iz}
                    fill="none" stroke={col}
                    strokeWidth={(stName === 'LOCKED' || stName === 'FIRING' ? 1.7 : 1.2) * iz}
                    strokeOpacity=".9"
                    strokeDasharray={stName === 'TRACKING' ? `${4 * iz} ${4 * iz}` : `${3 * iz} ${3 * iz}`}
                    className={stName === 'LOCKED' ? 'pulse' : 'radar-ring'} />
                  {/* Readiness caption rides the same de-collision offset as
                    * the rest of this battery's label stack, otherwise it
                    * floats at a fixed height and lands on neighbouring
                    * asset names ("ALERT" through "AMRITSAR"). */}
                  <text y={(-40 + (labelOffsets.get('b:' + a.id) ?? 0)) * iz}
                    fill={col} fontSize={8.5 * iz} textAnchor="middle"
                    letterSpacing={.6 * iz}
                    stroke="#040910" strokeWidth={2.4 * iz} paintOrder="stroke">
                    {stName}{st?.countdownS != null && st.countdownS <= 30
                      ? ` ${st.countdownS.toFixed(0)}s` : ''}
                  </text>
                </g>
              )}
              <g transform={`translate(${cx},${cy}) scale(${iz})`}>
                {/* launcher size scales with the class of system */}
                <BatteryIcon
                  s={(a.maxSlantRange >= 150 ? 1.15 : a.maxSlantRange >= 60 ? 1.0 : 0.9) * ICON}
                  col={col} dead={!on} kind={launcherClassFor(a.maxSlantRange)} />
                {on && used && (
                  <circle r={a.maxSlantRange >= 150 ? 15 : 12} fill="none" stroke={col}
                    strokeWidth=".9" strokeOpacity=".5" strokeDasharray="2 3" />
                )}
                {/* Name on any committed/selected/offline battery. The
                  * inventory line is restricted to the one the user is
                  * actually inspecting or that is live-firing — printing
                  * "8 RDY · 400km" under every launcher collided with the
                  * threat labels and buried the engagement. */}
                {(used || hi || !on || active) && (
                  <text y={-15 * ICON + (labelOffsets.get('b:' + a.id) ?? 0)}
                    fill={col} fontSize={10 * ICON} textAnchor="middle" fontWeight="600"
                    stroke="#040910" strokeWidth="2.8" paintOrder="stroke">{a.name}</text>
                )}
                {(hi || !on || active) && (
                  <text y={21 * ICON} fill={on ? '#5d7d96' : '#8a4550'} fontSize={8.5 * ICON} textAnchor="middle"
                    stroke="#040910" strokeWidth="2.6" paintOrder="stroke">
                    {on ? `${a.inventory} RDY · ${a.maxSlantRange}km` : 'OFFLINE'}
                  </text>
                )}
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
              {sc.threats.length <= 6 && (
                <text y="21" fill="#a3505c" fontSize="8" textAnchor="middle">{th.origin.name}</text>
              )}
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
                    <g transform={`rotate(${headingAt(th, t)})`}>
                      {th.cls === 'DRONE'
                        ? <DroneIcon s={1.0 * ICON} />
                        : th.cls === 'AIRCRAFT'
                        ? <path d={symbolPath('AIRCRAFT')} transform={`scale(${1.15 * ICON})`}
                            fill={COL.threat} fillOpacity=".9" stroke="#ffd7dc" strokeWidth="1.1"
                            strokeLinejoin="round" />
                        : <MissileBody cls={th.cls} s={1.05 * ICON} />}
                    </g>
                    {/* ATTACKER TYPE is the headline — the real weapon name
                      * (JF-17, Shaheen-II, Babur, Shahpar-II) in full size.
                      * Telemetry moves to the second line and only appears
                      * when this track is selected, so eight simultaneous
                      * tracks do not print eight paragraphs over the map. */}
                    <text x={15 * ICON} y={-5 * ICON + (labelOffsets.get('t:' + th.id) ?? 0)}
                      fill="#ff8f9d" fontSize={12.5 * ICON}
                      fontWeight="700" letterSpacing=".4"
                      stroke="#040910" strokeWidth="3.2" paintOrder="stroke">
                      {threatName(th.systemId, th.cls)}
                    </text>
                    <text x={15 * ICON} y={6.5 * ICON + (labelOffsets.get('t:' + th.id) ?? 0)}
                      fill="#8a6268" fontSize={9 * ICON}
                      stroke="#040910" strokeWidth="2.4" paintOrder="stroke">
                      {isSel
                        ? `${th.callsign} · ${(st.p.alt / 1000).toFixed(0)}km · M${(st.speed / 340).toFixed(1)} → ${th.targetAssetName}`
                        : th.callsign}
                    </text>
                  </g>
                </g>
              )}
              {/* INTERCEPT BURST — threat destroyed in the air, at its own coordinates */}
              {killed && first && (
                <g filter="url(#glowSoft)"
                  transform={`translate(${PX(first.option.interceptPoint.lon)},${PY(first.option.interceptPoint.lat)}) scale(${iz})`}>
                  <BurstIcon s={1.1 * ICON} />
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
          /* Phase comes from the shared flight model, which terminates a round
           * the moment ITS TARGET dies rather than at its own nominal
           * intercept time. 18.8% of shots in a deep salvo arrive after the
           * threat is already destroyed; drawing those was what made
           * interceptors appear to fly off at nothing. */
          const ph = shotPhase(s, t, killT.get(s.threatId));
          if (ph.state === 'prelaunch' && !(t >= o.tLaunch - 25)) return null;
          if (ph.state === 'done') return null;
          const f = ph.f;
          const side = salvoSide(s), loft = salvoLoft(s);
          const x0 = PX(a.centroid.lon), y0 = PY(a.centroid.lat);
          const x1 = PX(o.interceptPoint.lon), y1 = PY(o.interceptPoint.lat);
          const A = { x: x0, y: y0 }, B = { x: x1, y: y1 };
          const done = ph.state !== 'flying' && ph.state !== 'prelaunch';
          // Highlight the battery in the seconds before it fires, so a viewer
          // scrubbing the timeline can see an engagement about to happen
          // rather than only catching the short fly-out window.
          const arming = t >= o.tLaunch - 25 && t < o.tLaunch;
          return (
            <g key={i}>
              {arming && (
                <g transform={`translate(${x0},${y0})`}>
                  <circle r={13 * iz} fill="none" stroke={COL.intcp} strokeWidth={1.4 * iz}
                    strokeOpacity=".85" strokeDasharray={`${3 * iz} ${3 * iz}`} className="pulse" />
                  <text y={-20 * iz} fill={COL.intcp} fontSize={9 * iz} textAnchor="middle"
                    stroke="#040910" strokeWidth={2.4 * iz} paintOrder="stroke">
                    FIRING IN {(o.tLaunch - t).toFixed(0)}s
                  </text>
                </g>
              )}
              {/* planned fly-out corridor — the lofted curve, not a chord */}
              <path d={flyoutPath(A, B, 1, loft, side)} fill="none" stroke={COL.intcp}
                strokeOpacity={done ? .1 : .24} strokeWidth={.9 * iz}
                strokeDasharray={`${3 * iz} ${5 * iz}`} />
              {/* interceptor in flight: solid blue, nose along its own velocity vector */}
              {ph.state === 'flying' && (() => {
                const p = interceptorAt(A, B, f, loft, side);
                // heading is the tangent to the flown curve, so the airframe
                // always points where it is actually going
                const hd = interceptorHeading(A, B, f, loft, side);
                return (
                  <>
                    <path className="intcp-line" d={flyoutPath(A, B, f, loft, side)}
                      fill="none" stroke={COL.intcp} strokeWidth={2.2 * iz} strokeOpacity=".97"
                      strokeDasharray={`${10 * iz} ${5 * iz}`} />
                    <g transform={`translate(${p.x},${p.y}) scale(${iz}) rotate(${
                      (hd * 180) / Math.PI + 90})`}>
                      <InterceptorBody s={0.95 * ICON} />
                    </g>
                  </>
                );
              })()}
              {/* A round whose target was killed by an earlier shot in the
                * salvo is destructed in place — it must not keep tracking an
                * aim point that no longer means anything. */}
              {ph.state === 'destruct' && (() => {
                const p = interceptorAt(A, B, f, loft, side);
                return (
                  <g transform={`translate(${p.x},${p.y}) scale(${iz})`} opacity=".85">
                    <circle r={4.5} fill="none" stroke="#7f9bb3" strokeWidth="1.3" />
                    <path d="M-6,-6 L6,6 M6,-6 L-6,6" stroke="#7f9bb3" strokeWidth="1.2" />
                    <text y={-11} fill="#7f9bb3" fontSize="7.5" textAnchor="middle">DESTRUCT</text>
                  </g>
                );
              })()}
              {/* aim point */}
              <circle cx={x1} cy={y1} r={2.6 * iz} fill="none" stroke={COL.intcp}
                strokeWidth={1.2 * iz} strokeOpacity=".55" />
            </g>
          );
        })}
      </g>

      {/* ---------- FIXED OVERLAYS ---------- */}
      <g transform={`translate(40,44)`}>
        <path d="M0,-14 L4.6,6.5 L0,2 L-4.6,6.5 Z" fill="#4a6076" />
        <text y="19" fill="#4a6076" fontSize="9" textAnchor="middle">N</text>
      </g>
      {(() => {
        const targetPx = 150;
        const rawKm = (targetPx / (kmToPx * view.z * base));
        const nice = [10, 20, 25, 50, 100, 150, 200, 250, 500].reduce((a, b) => Math.abs(b - rawKm) < Math.abs(a - rawKm) ? b : a, 10);
        const w = nice * kmToPx * view.z * base;
        return (
          <g transform={`translate(${VW - w - 30},${VH - 26})`}>
            <line x1="0" y1="0" x2={w} y2="0" stroke="#5d7186" strokeWidth="1.5" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#5d7186" strokeWidth="1.5" />
            <line x1={w} y1="-4" x2={w} y2="4" stroke="#5d7186" strokeWidth="1.5" />
            <text x={w / 2} y="-6" fill="#5d7186" fontSize="9.5" textAnchor="middle">{nice} km</text>
          </g>
        );
      })()}
      <text x={VW - 14} y="24" fill="#33546b" fontSize="11" textAnchor="end">ZOOM ×{view.z.toFixed(1)}</text>
      {Math.abs(view.z - 1) > 0.02 && (
        <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setView({ x: 0, y: 0, z: 1 }); }}>
          <rect x={VW - 96} y={34} width="82" height="20" fill="#0e141c" stroke="#25455c" rx="2" />
          <text x={VW - 55} y={48} fill="#8fa8bd" fontSize="10" textAnchor="middle">RESET VIEW</text>
        </g>
      )}
      {addMode && (
        <text x={VW / 2} y="28" fill="#ffb020" fontSize="16" textAnchor="middle" letterSpacing="2">
          SELECT AIMPOINT — CLICK MAP TO INJECT TRACK
        </text>
      )}
    </svg>
    {fx && size.w > 0 && (
      <FxLayer sc={sc} sol={sol} t={t} playing={playing}
        project={projectPx} width={Math.round(size.w)} height={Math.round(size.h)} />
    )}
    </div>
  );
}
