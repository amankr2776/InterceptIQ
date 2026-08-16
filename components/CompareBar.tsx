'use client';
// InterceptIQ
import React from 'react';
import { MODES, type Mode, type ModeResult } from '@/lib/compare';
import { COL } from './symbols';
import { Bar } from './ui';

/**
 * Counterfactual selector + live comparison.
 * Switching mode re-solves the SAME scenario a different way, so a judge can
 * watch the identical attack play out undefended, defended naively, and
 * defended optimally.
 */
export default function CompareBar({
  mode, onMode, results, busy,
}: {
  mode: Mode; onMode: (m: Mode) => void;
  results: ModeResult[]; busy: boolean;
}) {
  const cur = results.find((r) => r.mode === mode);
  const best = results.find((r) => r.mode === 'minimal');
  const none = results.find((r) => r.mode === 'none');

  const colFor = (m: Mode) =>
    m === 'none' ? COL.threat : m === 'single' ? '#f59e0b'
    : m === 'minimal' ? COL.burst : COL.intcp;

  return (
    <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        <div style={{ padding: '7px 12px', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 132 }}>
          <div className="lbl" style={{ marginBottom: 1 }}>Compare</div>
          <div style={{ fontSize: 8, color: 'var(--dim2)', lineHeight: 1.3 }}>
            same attack,<br />different defence
          </div>
        </div>

        {MODES.map((m) => {
          const r = results.find((x) => x.mode === m.id);
          const on = mode === m.id;
          const c = colFor(m.id);
          return (
            <button key={m.id} onClick={() => onMode(m.id)} disabled={busy}
              title={m.blurb}
              style={{
                flex: 1, border: 'none', borderRadius: 0, textAlign: 'left',
                borderRight: '1px solid var(--line)',
                borderBottom: on ? `2px solid ${c}` : '2px solid transparent',
                background: on ? `${c}14` : 'transparent',
                padding: '6px 11px', textTransform: 'none', letterSpacing: 0,
              }}>
              <div style={{ fontSize: 10, color: on ? c : 'var(--txt)', letterSpacing: '.04em' }}>
                {m.label.toUpperCase()}
              </div>
              {r && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: r.leakers ? COL.threat : COL.burst }}>
                    {r.total - r.leakers}/{r.total}
                  </span>
                  <span style={{ fontSize: 8.5, color: 'var(--dim2)' }}>stopped</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--dim)' }}>
                    {r.sitesUsed} site{r.sitesUsed === 1 ? '' : 's'}
                  </span>
                </div>
              )}
              {r && <div style={{ marginTop: 3 }}><Bar v={r.protection} c={c} h={3} /></div>}
            </button>
          );
        })}
      </div>

      {/* verdict strip */}
      {cur && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '5px 12px',
          borderTop: '1px solid var(--line)', fontSize: 10,
          background: cur.leakers ? 'rgba(244,63,94,.07)' : 'rgba(52,211,153,.05)',
        }}>
          <span style={{ color: cur.leakers ? COL.threat : COL.burst, letterSpacing: '.05em' }}>
            {cur.leakers === 0
              ? '✓ ALL THREATS NEUTRALISED — no protected asset struck'
              : `✕ ${cur.leakers} LEAKER${cur.leakers > 1 ? 'S' : ''} — ${cur.assetsHit.join(', ')} STRUCK`}
          </span>
          <span style={{ color: 'var(--dim)' }}>
            {(cur.protection * 100).toFixed(1)}% weighted protection · {cur.rounds} rounds ·{' '}
            {cur.sitesUsed}/{cur.sitesAvailable} sites
          </span>
          {best && none && mode === 'minimal' && (
            <span style={{ marginLeft: 'auto', color: 'var(--amb)' }}>
              vs no defence: <b>{none.leakers} strikes prevented</b> · vs all-sites:{' '}
              <b>{(results.find((r) => r.mode === 'all')?.sitesUsed ?? 0) - best.sitesUsed} fewer sites</b>
            </span>
          )}
          {busy && <span style={{ marginLeft: 'auto', color: 'var(--amb)' }} className="pulse">re-solving…</span>}
        </div>
      )}
    </div>
  );
}
