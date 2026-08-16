'use client';
// InterceptIQ
import React from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { COL, ShieldIcon } from './symbols';

import type { ModeResult } from '@/lib/compare';

/**
 * End-of-run debrief. Appears when the clock reaches the last impact time —
 * the moment a judge wants a single legible verdict, and the frame most
 * likely to be photographed.
 */
export default function MissionSummary({
  sc, sol, results, onReplay, onClose,
}: {
  sc: Scenario; sol: AllocationSolution;
  results: ModeResult[]; onReplay: () => void; onClose: () => void;
}) {
  const m = sol.metrics;
  const stopped = m.threatsTotal - m.leakers;
  const clean = m.leakers === 0;
  const pop = sc.assets.reduce((a, x) => a + x.population, 0);
  const none = results.find((r) => r.mode === 'none');
  const all = results.find((r) => r.mode === 'all');

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(4,9,16,.86)', zIndex: 60,
    }} onClick={onClose}>
      <div className="fadein" onClick={(e) => e.stopPropagation()} style={{
        width: 620, background: 'var(--panel)',
        border: `1px solid ${clean ? COL.burst : COL.threat}`,
        borderRadius: 4, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
          <svg width="26" height="26" viewBox="-14 -15 28 32">
            {clean ? <ShieldIcon s={1.1} /> : <ShieldIcon s={1.1} col={COL.threat} />}
          </svg>
          <div>
            <div style={{ fontSize: 17, color: clean ? COL.burst : COL.threat, letterSpacing: '.05em' }}>
              {clean ? 'ENGAGEMENT COMPLETE — ALL THREATS NEUTRALISED' : `${m.leakers} LEAKER${m.leakers > 1 ? 'S' : ''} — ASSET STRUCK`}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--dim2)', marginTop: 2 }}>
              {sc.id} · defending {sc.assets.map((a) => a.name).join(', ')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '16px 0' }}>
          <Cell label="Threats stopped" value={`${stopped}/${m.threatsTotal}`} c={clean ? COL.burst : COL.threat} />
          <Cell label="Interceptors used" value={`${m.interceptorsUsed}`} c={COL.intcp} />
          <Cell label="Sites committed" value={`${sol.selectedAreaIds.length}/${sc.areas.length}`} c="var(--amb)" />
          <Cell label="Population protected" value={`${(pop / 1e6).toFixed(1)}M`} c="var(--cy)" />
        </div>

        <div style={{ display: 'grid', gap: 5, fontSize: 10.5, color: 'var(--dim)' }}>
          <Row k="Weighted protection" v={`${(m.weightedProtection * 100).toFixed(1)}%`} />
          <Row k="Mean single-shot Pk" v={m.meanPk.toFixed(3)} />
          <Row k="Total decision time" v={`${m.solveMs} ms`} c="var(--cy)" />
          <Row k="Candidate subsets evaluated" v={`${m.subsetsEvaluated ?? 0}`} />
          <Row k="Minimality" v={sol.certified ? 'PROVEN by exhaustive search' : 'heuristic'}
            c={sol.certified ? COL.burst : 'var(--amb)'} />
        </div>

        {none && all && (
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)',
            fontSize: 10.5, color: 'var(--txt)', lineHeight: 1.7,
          }}>
            <b style={{ color: 'var(--amb)' }}>Counterfactual:</b> undefended, this attack strikes{' '}
            <b style={{ color: COL.threat }}>{none.assetsHit.join(' and ') || 'every target'}</b>.
            Using every available site achieves {(all.protection * 100).toFixed(1)}% protection from{' '}
            {all.sitesUsed} sites; the optimiser reaches {(m.weightedProtection * 100).toFixed(1)}% from{' '}
            <b style={{ color: COL.burst }}>{sol.selectedAreaIds.length}</b>.
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, marginTop: 16 }}>
          <button className="on" style={{ flex: 1, padding: '9px 0' }} onClick={onReplay}>↺ Replay</button>
          <button style={{ flex: 1, padding: '9px 0' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, c }: { label: string; value: string; c: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 3, padding: '8px 9px' }}>
      <div style={{ fontSize: 8, color: 'var(--dim2)', letterSpacing: '.09em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 19, color: c, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--dim2)' }}>{k}</span>
      <span style={{ color: c ?? 'var(--txt)' }}>{v}</span>
    </div>
  );
}
