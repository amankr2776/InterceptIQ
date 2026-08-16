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
