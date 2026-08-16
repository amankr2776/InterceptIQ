'use client';
// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
import React, { useEffect, useMemo, useRef } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { buildEventLog, eventColor, fmtT } from '@/lib/events';

/** Scrolling, timestamped C2 event feed — reveals events as sim time passes. */
export default function EventLog({ sc, sol, t }: { sc: Scenario; sol: AllocationSolution | null; t: number }) {
  const all = useMemo(() => buildEventLog(sc, sol), [sc, sol]);
  const shown = useMemo(() => all.filter((e) => e.t <= t).slice(-160), [all, t]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [shown.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
        <span className="lbl">Event Log</span>
        <span style={{ fontSize: 8.5, color: 'var(--dim2)' }}>{shown.length}/{all.length} · AUTOSCROLL</span>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: '5px 8px', fontSize: 10 }}>
        {shown.length === 0 && <div style={{ color: 'var(--dim2)', padding: 8 }}>Awaiting first track…</div>}
        {shown.map((e, i) => (
          <div key={i} className="fadein" style={{ display: 'flex', gap: 6, padding: '2.5px 0', borderBottom: '1px solid #0c1219', lineHeight: 1.45 }}>
            <span style={{ color: 'var(--dim2)', flexShrink: 0 }}>{fmtT(e.t)}</span>
            <span style={{ color: eventColor(e.kind), flexShrink: 0, width: 62, fontSize: 8.5, letterSpacing: '.05em', paddingTop: 1 }}>
              {e.kind}
            </span>
            <span style={{ color: e.kind === 'IMPACT' || e.kind === 'LEAKER' ? 'var(--red)' : 'var(--txt)' }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
