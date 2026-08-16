'use client';
import React, { useEffect, useRef, useState } from 'react';

/** Smoothly counts to a new value instead of snapping. */
export function Num({
  value, decimals = 0, suffix = '', prefix = '', dur = 420, style,
}: { value: number; decimals?: number; suffix?: string; prefix?: string; dur?: number; style?: React.CSSProperties }) {
  const [d, setD] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const a = from.current, b = value;
    if (a === b) return;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setD(a + (b - a) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); from.current = value; };
  }, [value, dur]);
  return <span style={style}>{prefix}{d.toFixed(decimals)}{suffix}</span>;
}

export function Pill({ label, state }: { label: string; state: 'ok' | 'warn' | 'crit' | 'idle' }) {
  const c = state === 'ok' ? 'var(--grn)' : state === 'warn' ? 'var(--amb)' : state === 'crit' ? 'var(--red)' : 'var(--dim2)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', border: `1px solid ${c}33`, borderRadius: 2, background: `${c}0d` }}>
      <span className={state === 'crit' ? 'pulse' : ''} style={{ width: 5, height: 5, borderRadius: '50%', background: c, display: 'inline-block' }} />
      <span style={{ fontSize: 9, letterSpacing: '.1em', color: c }}>{label}</span>
    </div>
  );
}

export function Stat({ label, children, c }: { label: string; children: React.ReactNode; c?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 8.5, letterSpacing: '.1em', color: 'var(--dim2)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 15, color: c ?? 'var(--txt)', fontWeight: 600, marginTop: 1 }}>{children}</div>
    </div>
  );
}

export function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ marginBottom: 12, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 11px', borderBottom: '1px solid var(--line)' }}>
        <span className="lbl">{title}</span>{right}
      </div>
      <div style={{ padding: 11 }}>{children}</div>
    </div>
  );
}

/** Simplified NATO APP-6 style track symbol. Hostile = red, air track. */
export function ThreatSymbol({ cls, size = 13, color = 'var(--red)', filled = true }: { cls: string; size?: number; color?: string; filled?: boolean }) {
  const s = size;
  const fill = filled ? color : 'none';
  if (cls === 'CRUISE') {
    // arrow — air-breathing cruise profile
    return <svg width={s} height={s} viewBox="0 0 20 20"><path d="M10 1 L18 17 L10 13 L2 17 Z" fill={fill} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
  }
  if (cls === 'TBM') {
    // triangle — tactical ballistic
    return <svg width={s} height={s} viewBox="0 0 20 20"><path d="M10 2 L18.5 17.5 L1.5 17.5 Z" fill={fill} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
  }
  if (cls === 'MRBM') {
    // double chevron — medium-range ballistic
    return <svg width={s} height={s} viewBox="0 0 20 20"><path d="M10 1.5 L18.5 10 L10 18.5 L1.5 10 Z" fill={fill} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 6 L14 10 L10 14 L6 10 Z" fill="var(--bg)" opacity=".55" /></svg>;
  }
  // SRBM — diamond
  return <svg width={s} height={s} viewBox="0 0 20 20"><path d="M10 1.5 L18.5 10 L10 18.5 L1.5 10 Z" fill={fill} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

/** SVG-space version of the same symbology, for use inside the map. */
export function symbolPath(cls: string): string {
  switch (cls) {
    case 'CRUISE': return 'M0,-9 L8,8 L0,4 L-8,8 Z';
    case 'TBM':    return 'M0,-9 L8.5,8 L-8.5,8 Z';
    case 'MRBM':   return 'M0,-9 L9,0 L0,9 L-9,0 Z';
    default:       return 'M0,-8 L8,0 L0,8 L-8,0 Z'; // SRBM
  }
}

export function Bar({ v, max = 1, c = 'var(--grn)', h = 5 }: { v: number; max?: number; c?: string; h?: number }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', height: h + 2, borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, height: '100%', background: c, transition: 'width .45s cubic-bezier(.22,.61,.36,1)' }} />
    </div>
  );
}
