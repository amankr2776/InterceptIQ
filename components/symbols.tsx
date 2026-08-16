'use client';
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

/** Battery / launcher glyph. */
export function BatteryIcon({ s = 1, col = COL.intcp, dead = false }: { s?: number; col?: string; dead?: boolean }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x="-6" y="-4.5" width="12" height="9" fill="#040910" stroke={col} strokeWidth="1.5" />
      <path d="M-6,-4.5 L0,-10.5 L6,-4.5" fill="none" stroke={col} strokeWidth="1.5" />
      <circle r="1.7" fill={col} />
      {dead && <path d="M-9,-9 L9,9 M9,-9 L-9,9" stroke={COL.threat} strokeWidth="2" />}
    </g>
  );
}

/** Threat track symbol by class (simplified NATO-style). */
export function symbolPath(cls: string): string {
  switch (cls) {
    case 'CRUISE': return 'M0,-9 L8,8 L0,4 L-8,8 Z';
    case 'TBM': return 'M0,-9 L8.5,8 L-8.5,8 Z';
    case 'MRBM': return 'M0,-9 L9,0 L0,9 L-9,0 Z';
    default: return 'M0,-8 L8,0 L0,8 L-8,0 Z';
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
