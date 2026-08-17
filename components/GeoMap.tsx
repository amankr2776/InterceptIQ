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
import { ShieldIcon, BurstIcon, BatteryIcon, EngagementDefs, InterceptorBody, ThreatGlyph, launcherClassFor, COL } from './symbols';

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

/**
 * Per-class glyph scale. A swarm cluster and a bomber are naturally large;
 * a ballistic RV or a loitering munition is a small body and needs more
 * magnification to read as a distinct shape at theatre scale.
 */
function GLYPH_SCALE(cls: string): number {
  switch (cls) {
    case 'SWARM': return 1.5;
    case 'BOMBER': return 1.7;
    case 'STEALTH': return 1.8;
    case 'HELO': return 1.8;
    case 'HGV': return 1.9;
    case 'SUPCRUISE': return 1.9;
    case 'AIRCRAFT': return 1.8;
    case 'DRONE': return 1.9;
    default: return 1.8;      // ballistic bodies
  }
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
/* ---------------------------------------------------------------------
 * CARTOGRAPHIC PALETTE
 * ---------------------------------------------------------------------
 * The old palette gave every country a slightly different muddy tint
 * (#0b1512 green-brown for India, #120f13 for Pakistan, #0f1017 for China),
 * which read as grime rather than as a map: nine near-identical dark browns
 * with no relationship to each other or to the engagement colours drawn on
 * top.
 *
 * This is a two-tone scheme instead, and it carries meaning:
 *   DEFENDED TERRITORY  a cool slate-teal, very slightly lifted, because it
 *                       is the thing being protected and should feel "ours"
 *   EVERYTHING ELSE     a single neutral graphite, uniformly recessive
 *
 * Borders are one hue at two intensities. The result is that the ONLY warm
 * or saturated colour anywhere on the map is an engagement symbol, so the
 * eye goes to the fight rather than to the basemap.
 * ------------------------------------------------------------------- */
const IND_FILL = '#0c1620';
const OTH_FILL = '#0a0d12';
const IND_LINE = '#2d5f6b';
const OTH_LINE = '#232d3b';

const NEIGHBOUR_FILL: Record<string, string> = {
  IND: IND_FILL, PAK: OTH_FILL, CHN: OTH_FILL, NPL: OTH_FILL,
  BTN: OTH_FILL, BGD: OTH_FILL, LKA: OTH_FILL, MMR: OTH_FILL, AFG: OTH_FILL,
};
const NEIGHBOUR_LINE: Record<string, string> = {
  IND: IND_LINE, PAK: OTH_LINE, CHN: OTH_LINE, NPL: OTH_LINE,
  BTN: OTH_LINE, BGD: OTH_LINE, LKA: OTH_LINE, MMR: OTH_LINE, AFG: OTH_LINE,
};

export default function GeoMap({ sc, sol, t, sel, onSel, addMode, onMapClick, layers, onCursor, fx = false, playing = false }: Props) {
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  /* Site under the cursor. Drives the on-demand range ring and the detail
   * text, so neither has to be rendered for every battery at once. */
  const [hovSite, setHovSite] = useState<string | null>(null);
  /* Threat track under the cursor — reveals the full weapon name, which is
   * otherwise held back to keep the map readable. */
  const [hovThreat, setHovThreat] = useState<string | null>(null);
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
  /** Scratch: batteryId -> index of the one shot that owns the arming caption. */
  const armingLead = useRef(new Map<string, number>()).current;

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
        dy = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 15 * iz;
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

    /* 1. live attacker labels — the headline information.
     * Box height reflects what is ACTUALLY drawn: one line (track ID) by
     * default, two on hover, three when selected. Reserving three lines for
     * every track would push neighbours apart for text that is not there. */
    for (const { th, st, active, killed } of live) {
      if (!active || !st || killed) continue;
      const lines = selT === th.id ? 3 : hovThreat === th.id ? 2 : 1;
      put('t:' + th.id, PX(st.p.lon), PY(st.p.lat), -12 * ICON, (-1 + lines * 11) * ICON);
    }
    /* 2. defended assets — reserve the SHIELD GLYPH as well as its caption.
     * Previously only the text box was registered, so a battery label was
     * free to slide on top of the shield of the city it defends (measured:
     * "Akash Charlie" printing through the gold Delhi/Amritsar shield). The
     * shield spans roughly -19..+15 local units around the centre. */
    for (const a of sc.assets) {
      put('a:' + a.id, PX(a.centroid.lon), PY(a.centroid.lat), -27 * ICON, 15 * ICON);
    }
    // 3. batteries, whose stack can run from the state line above the icon
    //    down through the inventory line below it
    for (const a of sc.areas) {
      const s2 = statusById.get(a.id)?.state ?? 'READY';
      const reacting = s2 === 'ALERT' || s2 === 'TRACKING' || s2 === 'LOCKED' || s2 === 'FIRING';
      if (!(selArea.has(a.id) || selS === a.id || !a.active || reacting)) continue;
      /* Stack runs from the readiness caption above the icon down to the
       * inventory line — but the inventory line is only drawn when this site
       * is focused or offline, so the box shrinks accordingly. */
      const detail = selS === a.id || hovSite === a.id || !a.active;
      put("b:" + a.id, PX(a.centroid.lon), PY(a.centroid.lat),
        -48, (detail ? 24 : 4) * ICON);
    }
    return out;
  }, [live, sc.areas, sc.assets, statusById, selArea, selS, selT,
      hovSite, hovThreat, PX, PY, iz, ICON]);


  // graticule at whole degrees
  const gridLines = useMemo(() => {
    const step = latSpan > 8 ? 2 : latSpan > 4 ? 1 : 0.5;
    const la: number[] = [], lo: number[] = [];
    for (let v = Math.ceil(lat0 / step) * step; v < lat0 + latSpan; v += step) la.push(+v.toFixed(2));
    for (let v = Math.ceil(lon0 / step) * step; v < lon0 + lonSpan; v += step) lo.push(+v.toFixed(2));
    return { la, lo };
  }, [lat0, lon0, latSpan, lonSpan]);

  /**
   * Zoom by `f` while holding the point (ux,uy) — in viewBox units — fixed
   * under the cursor. The wheel passes the pointer position; the on-screen
   * buttons pass the centre of the view, which is what a user expects from a
   * +/- control (the middle of what they are looking at stays put).
   * Bounds match the wheel exactly, so both routes behave identically.
   */
  const zoomAbout = useCallback((f: number, ux: number, uy: number) => {
    setView((v) => {
      const z = Math.max(0.75, Math.min(14, v.z * f));
      const s = z / v.z;
      return { z, x: ux - (ux - v.x) * s, y: uy - (uy - v.y) * s };
    });
  }, []);
  const zoomStep = useCallback((f: number) => zoomAbout(f, VW / 2, VH / 2), [zoomAbout, VW, VH]);
  const atMin = view.z <= 0.7501, atMax = view.z >= 13.999;

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
        zoomAbout(e.deltaY < 0 ? 1.2 : 1 / 1.2, ux, uy);
      }}
      onClick={(e) => { if (addMode) { const p = toLL(e.clientX, e.clientY); onMapClick(p.lat, p.lon); } }}>

      <defs>
        {/* SEA — near-black with a barely-there swell. The old pattern used a
          * #0a2033 wave on #051220, bright enough that open water competed
          * with the tracks drawn over it. Water should be the quietest thing
          * on the chart. */}
        <pattern id="sea" width="46" height="46" patternUnits="userSpaceOnUse">
          <rect width="46" height="46" fill="#05090f" />
          <path d="M0,23 q11.5,-5 23,0 t23,0" fill="none" stroke="#0b1622" strokeWidth=".6" />
        </pattern>

        {/* LANDMASS DEPTH — a single soft vertical gradient laid over defended
          * territory. A flat fill reads as a cut-out sticker; a hint of
          * luminance falloff gives the country body without adding colour. */}
        <linearGradient id="landShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".030" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity=".008" />
          <stop offset="100%" stopColor="#000000" stopOpacity=".16" />
        </linearGradient>

        {/* COASTAL GLOW — a soft inner halo just inside the shoreline, the
          * cartographic convention that separates land from water without a
          * heavy stroke. */}
        <filter id="coastGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        <radialGradient id="dome">
          <stop offset="55%" stopColor="#ffc247" stopOpacity=".04" />
          <stop offset="100%" stopColor="#ffc247" stopOpacity=".15" />
        </radialGradient>
        <EngagementDefs />
        <filter id="gl"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>

        {/* Clip so the shading and glow stay inside the national outline. */}
        <clipPath id="indClip">
          {geo.countries.filter((c) => c.iso === 'IND').map((c) => (
            <path key={c.iso} d={c.d} />
          ))}
        </clipPath>
      </defs>

      <g transform={`translate(${view.x},${view.y}) scale(${view.z}) translate(${offX},${offY}) scale(${base})`}>
        <rect x={-V * 4} y={-V * 4} width={V * 9} height={V * 9} fill="url(#sea)" />

        {/* ---------- REAL COUNTRIES ----------
          * Neighbours first, then defended territory over the top, so India
          * always wins the z-order at shared frontiers. */}
        {geo.countries.filter((c) => c.iso !== 'IND').map((c) => (
          <path key={c.iso} d={c.d} fill={NEIGHBOUR_FILL[c.iso]}
            stroke={NEIGHBOUR_LINE[c.iso]} strokeWidth={.9 * iz} strokeOpacity={.45} />
        ))}
        {geo.countries.filter((c) => c.iso === 'IND').map((c) => (
          <path key={c.iso} d={c.d} fill={IND_FILL}
            stroke={IND_LINE} strokeWidth={1.4 * iz} strokeOpacity={.85} />
        ))}
        {/* soft luminance falloff across the defended landmass */}
        <g clipPath="url(#indClip)">
          <rect x={-V * 4} y={-V * 4} width={V * 9} height={V * 9} fill="url(#landShade)" />
        </g>
        {/* inner coastal halo — sits inside the outline, reads as depth */}
        <g clipPath="url(#indClip)" opacity=".5">
          {geo.countries.filter((c) => c.iso === 'IND').map((c) => (
            <path key={c.iso} d={c.d} fill="none" stroke="#4d97ad"
              strokeWidth={7 * iz} filter="url(#coastGlow)" />
          ))}
        </g>
        {/* internal state / province boundaries */}
        {layers.states && geo.admin.map((a) => (
          <path key={a.iso} d={a.d} fill="none"
            stroke={NEIGHBOUR_LINE[a.iso] ?? '#2b4038'}
            strokeWidth={0.7 * iz} strokeOpacity={a.iso === 'IND' ? .55 : .3}
            strokeDasharray={`${2.5 * iz} ${2.5 * iz}`} />
        ))}
        <path d={geo.coast} fill="none" stroke="#2c6b85" strokeWidth={1 * iz} strokeOpacity=".5" />

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
          /* RANGE RINGS ARE OFF BY DEFAULT.
           * Drawing an envelope for every battery at once buried the tracks
           * under concentric circles. A ring now appears only when the
           * presenter explicitly asks for it — either the global toggle, or
           * this one site being hovered or selected. */
          const focused = hi || hovSite === a.id;
          const showRing = layers.rings || focused;
          return (
            <g key={a.id} style={{ cursor: 'pointer' }}
              /* onMouseOver/Out rather than Enter/Leave: the launcher glyph
               * is composed of many child shapes, and Enter/Leave do not
               * bubble, so moving between children of the same battery
               * produced no event at all. */
              onMouseOver={() => setHovSite(a.id)}
              onMouseOut={() => setHovSite((h) => (h === a.id ? null : h))}
              onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'site', id: a.id }); }}>
              {showRing && (
                <circle cx={cx} cy={cy} r={a.maxSlantRange * kmToPx} fill="none"
                  stroke={col}
                  strokeOpacity={focused ? .6 : on ? (a.maxSlantRange > 150 ? .16 : .26) : .14}
                  strokeWidth={(focused ? 1.6 : 1) * iz}
                  strokeDasharray={used ? `${9 * iz} ${6 * iz}` : `${4 * iz} ${7 * iz}`} />
              )}
              {/* Hovering a site also states its reach in words, so the ring
                  does not have to be measured against the scale bar. */}
              {focused && (
                <text x={cx} y={cy - (a.maxSlantRange * kmToPx) - 6 * iz}
                  fill={col} fontSize={9.5 * iz} textAnchor="middle"
                  stroke="#040910" strokeWidth={2.6 * iz} paintOrder="stroke">
                  {a.maxSlantRange} km ENVELOPE
                </text>
              )}
              {/* Invisible hit target. The deployment polygon is only ~4x5 px
                * on screen and the launcher glyph lives in a sibling group,
                * so there was effectively nothing to hover: measured, the
                * element under the cursor at the battery's own centre was a
                * terrain path, not the battery. This disc gives the site a
                * reliable ~30 px grab area for the on-demand ring and stats. */}
              <circle cx={cx} cy={cy} r={15 * iz} fill="transparent" />
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
                  <text y={(-46 + (labelOffsets.get('b:' + a.id) ?? 0)) * iz}
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
                {/* Clear of the launcher glyph. The TEL's erect canisters
                  * reach ~24 units above centre; the label sat at -15 and so
                  * printed straight through them (measured 55 px^2 of overlap
                  * on "Akash Charlie"). -30 puts the baseline above the
                  * canister tips at every launcher size. */}
                {(used || hi || !on || active) && (
                  <text y={-21 * ICON + (labelOffsets.get('b:' + a.id) ?? 0)}
                    fill={col} fontSize={10 * ICON} textAnchor="middle" fontWeight="600"
                    stroke="#040910" strokeWidth="2.8" paintOrder="stroke">{a.name}</text>
                )}
                {/* Inventory and reach are DETAIL, not identity. They now
                  * appear only for the site being hovered or inspected (and
                  * for a dead battery, where OFFLINE is the whole point).
                  * The same figures are always available in the Inspector. */}
                {(focused || !on) && (
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
                  strokeOpacity={killed ? .14 : .42} strokeWidth={(isSel ? 2 : 1.1) * iz}
                  strokeLinecap="round" />
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
                <g style={{ cursor: 'pointer' }}
                  onMouseOver={() => setHovThreat(th.id)}
                  onMouseOut={() => setHovThreat((h) => (h === th.id ? null : h))}
                  onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSel({ kind: 'threat', id: th.id }); }}>
                  {isSel && <circle cx={PX(st.p.lon)} cy={PY(st.p.lat)} r={18 * iz} fill="none" stroke={COL.asset} strokeWidth={iz} strokeDasharray={`${3 * iz} ${3 * iz}`} />}
                  <g transform={`translate(${PX(st.p.lon)},${PY(st.p.lat)}) scale(${iz})`}>
                    <g transform={`rotate(${headingAt(th, t)})`}>
                      {/* One dispatcher for every class, so a glide vehicle,
                        * bomber, helicopter and swarm are each unmistakable. */}
                      {/* Threat airframes are drawn LARGER than the map's
                        * base icon scale. Measured at the old 1.08x, a
                        * silhouette rendered 6-16 px wide beside a 133 px
                        * label — the shape was unreadable, which defeats the
                        * point of having distinct shapes per class. Small,
                        * fast bodies get the biggest boost since they have
                        * the least area to read. */}
                      <ThreatGlyph cls={th.cls} s={GLYPH_SCALE(th.cls) * ICON} />
                    </g>
                    {/* ATTACKER TYPE is the headline — the real weapon name
                      * (JF-17, Shaheen-II, Babur, Shahpar-II) in full size.
                      * Telemetry moves to the second line and only appears
                      * when this track is selected, so eight simultaneous
                      * tracks do not print eight paragraphs over the map. */}
                    {/* TRACK ID ONLY by default. With eight simultaneous
                      * tracks, eight full weapon names ("J-20 Mighty Dragon")
                      * is more text than a viewer can parse in the first few
                      * seconds — and the silhouette already conveys the
                      * class. The full name appears on hover or selection,
                      * and always in the Fire Plan and Event Log. */}
                    <text x={15 * ICON} y={-5 * ICON + (labelOffsets.get('t:' + th.id) ?? 0)}
                      fill="#ff9aa6" fontSize={12.5 * ICON}
                      fontWeight="700" letterSpacing=".4"
                      stroke="#040910" strokeWidth="3.2" paintOrder="stroke">
                      {th.callsign}
                    </text>
                    {(isSel || hovThreat === th.id) && (
                      <text x={15 * ICON} y={6.5 * ICON + (labelOffsets.get('t:' + th.id) ?? 0)}
                        fill="#d9a6ae" fontSize={9.5 * ICON}
                        stroke="#040910" strokeWidth="2.4" paintOrder="stroke">
                        {threatName(th.systemId, th.cls)}
                      </text>
                    )}
                    {isSel && (
                      <text x={15 * ICON} y={17 * ICON + (labelOffsets.get('t:' + th.id) ?? 0)}
                        fill="#a8848c" fontSize={9 * ICON}
                        stroke="#040910" strokeWidth="2.4" paintOrder="stroke">
                        {(st.p.alt / 1000).toFixed(0)}km · M{(st.speed / 340).toFixed(1)} → {th.targetAssetName}
                      </text>
                    )}
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
        {/* First shot index per battery whose countdown is live, so the
            arming ring and its caption are drawn exactly once. */}
        {(() => { armingLead.clear();
          (sol?.shots ?? []).forEach((s, i) => {
            if (t >= s.option.tLaunch - 25 && t < s.option.tLaunch &&
                !armingLead.has(s.areaId)) armingLead.set(s.areaId, i);
          });
          return null; })()}
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
          /* Draw the arming countdown ONCE PER BATTERY, not once per shot.
           * A salvo commits several rounds from the same launcher with the
           * same tLaunch, and each was rendering its own "FIRING IN 10s" at
           * the identical pixel — measured as 36 overlapping label pairs in a
           * single frame, all of them self-inflicted duplicates. */
          const arming = t >= o.tLaunch - 25 && t < o.tLaunch &&
            armingLead.get(a.id) === i;
          return (
            <g key={i}>
              {arming && (
                <g transform={`translate(${x0},${y0})`}>
                  <circle r={13 * iz} fill="none" stroke={COL.intcp} strokeWidth={1.4 * iz}
                    strokeOpacity=".85" strokeDasharray={`${3 * iz} ${3 * iz}`} className="pulse" />
                  <text y={(-20 + (labelOffsets.get('b:' + a.id) ?? 0)) * iz}
                    fill={COL.intcp} fontSize={9 * iz} textAnchor="middle"
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
      {/* Zoom factor readout. Moved to the BOTTOM-right beside the scale bar:
        * at the top it sat underneath the T+ clock overlay (measured overlap
        * at x1495,y9 vs the clock at x1486,y10). The reset control it used to
        * sit above is now a button in the zoom cluster. */}
      {Math.abs(view.z - 1) > 0.02 && (
        <text x={VW - 14} y={VH - 62} fill="#33546b" fontSize="11" textAnchor="end">
          ZOOM ×{view.z.toFixed(1)}
        </text>
      )}
      {addMode && (
        <text x={VW / 2} y="28" fill="#ffb020" fontSize="16" textAnchor="middle" letterSpacing="2">
          SELECT AIMPOINT — CLICK MAP TO INJECT TRACK
        </text>
      )}
    </svg>

    {/* ---------- ZOOM CONTROLS ----------
      * Wheel-zoom is not discoverable and is unusable on a trackpad-less
      * demo machine or a touch screen, so the same transform is exposed as
      * explicit buttons. Placed bottom-right, above the scale bar, which the
      * layout probe confirmed is the only empty corner on both pages that
      * hosts this map (top-left holds the legend and violation banner,
      * top-right the clock and ring toggle, bottom-left the cursor readout).
      * Rendered as HTML rather than SVG so they stay a constant physical
      * size and get real focus/hover states for keyboard users. */}
    <div style={{
      position: 'absolute', right: 10, bottom: 62, display: 'flex',
      flexDirection: 'column', gap: 4, zIndex: 6,
    }}>
      {([
        ['+', 'Zoom in', () => zoomStep(1.4), atMax],
        ['−', 'Zoom out', () => zoomStep(1 / 1.4), atMin],
      ] as const).map(([glyph, label, fn, disabled]) => (
        <button key={label} type="button" title={`${label} (or scroll on the map)`}
          aria-label={label} disabled={disabled}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); fn(); }}
          style={{
            width: 30, height: 30, padding: 0, lineHeight: 1,
            fontSize: 17, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(6,10,15,.94)',
            border: '1px solid var(--line)', borderRadius: 3,
            color: disabled ? 'var(--dim2)' : 'var(--txt)',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.45 : 1,
          }}>{glyph}</button>
      ))}
      <button type="button" title="Reset zoom and recentre" aria-label="Reset view"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setView({ x: 0, y: 0, z: 1 }); }}
        disabled={Math.abs(view.z - 1) < 0.02 && !view.x && !view.y}
        style={{
          width: 30, height: 26, padding: 0, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,10,15,.94)',
          border: '1px solid var(--line)', borderRadius: 3,
          color: Math.abs(view.z - 1) < 0.02 && !view.x && !view.y ? 'var(--dim2)' : 'var(--amb)',
          cursor: 'pointer',
          opacity: Math.abs(view.z - 1) < 0.02 && !view.x && !view.y ? 0.45 : 1,
        }}>⌂</button>
    </div>

    {fx && size.w > 0 && (
      <FxLayer sc={sc} sol={sol} t={t} playing={playing}
        project={projectPx} width={Math.round(size.w)} height={Math.round(size.h)} />
    )}
    </div>
  );
}
