'use client';
// InterceptIQ
import React from 'react';
import { COL, symbolPath as sp } from './symbols';

export const symbolPath = sp;

/** Inline threat-class badge (HTML space). Red = incoming threat, always. */
export function ThreatSymbol({ cls, size = 13, color = COL.threat, filled = true }:
  { cls: string; size?: number; color?: string; filled?: boolean }) {
  const fill = filled ? color : 'none';
  const common = { fill, stroke: color, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  if (cls === 'AIRCRAFT') {
    return (
      <svg width={size} height={size} viewBox="-13 -13 26 26">
        <path d="M0,-10 L3,-3 L11,3 L11,5 L3,2 L3,7 L6,10 L6,11 L0,9.5 L-6,11 L-6,10 L-3,7 L-3,2 L-11,5 L-11,3 L-3,-3 Z"
          {...common} />
      </svg>
    );
  }
  if (cls === 'DRONE') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <path d="M1 9.4 L19 9.4 L19 11 L1 11 Z" {...common} />
        <path d="M10 2 L12 6 L12 15 L8 15 L8 6 Z" {...common} />
      </svg>
    );
  }
  if (cls === 'CRUISE') {
    return <svg width={size} height={size} viewBox="0 0 20 20"><path d="M10 1 L18 17 L10 13 L2 17 Z" {...common} /></svg>;
  }
  if (cls === 'TBM') {
    return <svg width={size} height={size} viewBox="0 0 20 20"><path d="M10 2 L18.5 17.5 L1.5 17.5 Z" {...common} /></svg>;
  }
  if (cls === 'MRBM') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <path d="M10 1.5 L18.5 10 L10 18.5 L1.5 10 Z" {...common} />
        <path d="M10 6 L14 10 L10 14 L6 10 Z" fill="var(--bg)" opacity=".55" />
      </svg>
    );
  }
  return <svg width={size} height={size} viewBox="0 0 20 20"><path d="M10 1.5 L18.5 10 L10 18.5 L1.5 10 Z" {...common} /></svg>;
}
