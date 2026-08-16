'use client';
// InterceptIQ
import React, { useMemo } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';

/** Horizontal mission timeline: detection → decision → launch → intercept → impact. */
export default function Timeline({
  sc, sol, t, tMax, onSeek,
}: { sc: Scenario; sol: AllocationSolution | null; t: number; tMax: number; onSeek: (v: number) => void }) {
  const rows = useMemo(() => sc.threats.map((th) => {
    const res = sol?.perThreat.find((p) => p.threatId === th.id);
    const shots = (res?.shots ?? []).slice().sort((a, b) => a.option.tIntercept - b.option.tIntercept);
    return {
      th, res,
      detect: th.trajectory[0].t,
      decide: shots[0] ? Math.max(0, shots[0].option.tLaunch - 4) : null,
      launch: shots[0]?.option.tLaunch ?? null,
      intercept: shots[0]?.option.tIntercept ?? null,
      impact: th.impact.t,
      leaker: !!res?.leaker,
    };
  }), [sc, sol]);

  const pct = (v: number) => `${(v / tMax) * 100}%`;

  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 12px', borderBottom: '1px solid var(--line)' }}>
        <span className="lbl">Mission Timeline</span>
        <div style={{ display: 'flex', gap: 11, fontSize: 8.5, color: 'var(--dim2)' }}>
          <Legend c="var(--cy)" s="circle" t="DETECTED" />
          <Legend c="var(--vio)" s="diamond" t="DECISION" />
          <Legend c="var(--intcp)" s="tri" t="LAUNCH" />
          <Legend c="var(--burst)" s="circle" t="THREAT DESTROYED" />
          <Legend c="var(--threat)" s="cross" t="STRIKES ASSET" />
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--amb)' }}>T+{t.toFixed(1)}s / {tMax.toFixed(0)}s</span>
      </div>

      <div style={{ position: 'relative', padding: '7px 12px 3px', maxHeight: 118, overflowY: 'auto' }}>
        {rows.map((r) => (
          <div key={r.th.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{ width: 52, fontSize: 9.5, color: r.leaker ? 'var(--threat)' : 'var(--dim)', flexShrink: 0 }}>
              {r.th.callsign}
            </span>
            <div style={{ position: 'relative', flex: 1, height: 13, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 1 }}>
              {/* flight span */}
              <div style={{ position: 'absolute', left: pct(r.detect), width: pct(r.impact - r.detect), top: 5, height: 2, background: r.leaker ? 'rgba(244,63,94,.55)' : 'rgba(244,63,94,.28)' }} />
              {/* engagement span */}
              {r.launch !== null && r.intercept !== null && (
                <div style={{ position: 'absolute', left: pct(r.launch), width: pct(r.intercept - r.launch), top: 4, height: 4, background: 'rgba(77,163,255,.6)' }} />
              )}
              <Mark x={pct(r.detect)} c="var(--cy)" s="circle" />
              {r.decide !== null && <Mark x={pct(r.decide)} c="var(--vio)" s="diamond" />}
              {r.launch !== null && <Mark x={pct(r.launch)} c="var(--intcp)" s="tri" />}
              {r.intercept !== null && <Mark x={pct(r.intercept)} c="var(--burst)" s="circle" />}
              {(r.leaker || r.intercept === null) && <Mark x={pct(r.impact)} c="var(--threat)" s="cross" />}
              {/* playhead */}
              <div style={{ position: 'absolute', left: pct(Math.min(t, tMax)), top: -1, bottom: -1, width: 1, background: 'var(--amb)' }} />
            </div>
          </div>
        ))}
      </div>

      <input type="range" min={0} max={tMax} step={0.25} value={Math.min(t, tMax)}
        onChange={(e) => onSeek(+e.target.value)}
        style={{ width: 'calc(100% - 24px)', margin: '2px 12px 7px' }} />
    </div>
  );
}

function Mark({ x, c, s }: { x: string; c: string; s: string }) {
  const base: React.CSSProperties = { position: 'absolute', left: x, top: '50%', transform: 'translate(-50%,-50%)', width: 7, height: 7 };
  if (s === 'circle') return <div style={{ ...base, background: c, borderRadius: '50%' }} />;
  if (s === 'diamond') return <div style={{ ...base, background: c, transform: 'translate(-50%,-50%) rotate(45deg)' }} />;
  if (s === 'tri') return <div style={{ ...base, width: 0, height: 0, background: 'none', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `7px solid ${c}` }} />;
  return <div style={{ ...base, background: 'none' }}><svg width="8" height="8" viewBox="0 0 8 8"><path d="M0,0 L8,8 M8,0 L0,8" stroke={c} strokeWidth="1.6" /></svg></div>;
}

function Legend({ c, s, t }: { c: string; s: string; t: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}><Mark x="50%" c={c} s={s} /></span>
      {t}
    </span>
  );
}
