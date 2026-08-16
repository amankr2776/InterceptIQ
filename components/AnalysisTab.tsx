'use client';
// InterceptIQ
import React, { useMemo } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import { buildOptions } from '@/lib/allocator';
import { COL } from './symbols';
import { Bar } from './ui';

/**
 * ANALYSIS — the technical-depth proof surface.
 * Everything here is computed live from the current scenario and fire plan:
 * the full Pk solution space, the minimality search trace with its accept /
 * reject decisions, per-battery utilisation, and the threat-class breakdown.
 */

const heat = (v: number | null) => {
  if (v === null) return '#170d12';
  const stops = [[244, 63, 94], [255, 176, 32], [52, 211, 153]];
  const f = Math.max(0, Math.min(1, v / 0.7));
  const i = f < 0.5 ? 0 : 1, u = f < 0.5 ? f * 2 : (f - 0.5) * 2;
  const a = stops[i], b = stops[i + 1];
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * u)).join(',')})`;
};

export default function AnalysisTab({ sc, sol }: { sc: Scenario; sol: AllocationSolution }) {
  const table = useMemo(() => buildOptions(sc, 0).opts, [sc]);
  const trace = sol.subsetTrace ?? [];

  const bySize = useMemo(() => {
    const m = new Map<number, typeof trace>();
    for (const x of trace) { const l = m.get(x.size) ?? []; l.push(x); m.set(x.size, l); }
    return m;
  }, [trace]);
  const sizes = Array.from(bySize.keys()).sort((a, b) => a - b);
  const chosen = sol.selectedAreaIds.slice().sort().join(',');
  const nameOf = (id: string) => sc.areas.find((a) => a.id === id)?.name.replace(/ .*/, '') ?? id;

  // per-battery utilisation
  const util = sc.areas.map((a) => {
    const shots = sol.shots.filter((s) => s.areaId === a.id);
    const feasible = sc.threats.filter((t) => table.get(`${a.id}|${t.id}`)?.feasible).length;
    const pks = shots.map((s) => s.option.pk);
    return {
      a, fired: shots.length, feasible,
      meanPk: pks.length ? pks.reduce((x, y) => x + y, 0) / pks.length : 0,
      standoff: shots.length
        ? shots.reduce((x, s) => x + (s.option.standoffFromAssetKm ?? 0), 0) / shots.length : 0,
    };
  });

  // threat-class breakdown
  const byCls = useMemo(() => {
    const m = new Map<string, { n: number; stopped: number; pk: number[] }>();
    for (const t of sc.threats) {
      const r = sol.perThreat.find((p) => p.threatId === t.id);
      const e = m.get(t.cls) ?? { n: 0, stopped: 0, pk: [] };
      e.n++;
      if (r && !r.leaker) { e.stopped++; e.pk.push(r.cumulativePk); }
      m.set(t.cls, e);
    }
    return Array.from(m.entries());
  }, [sc, sol]);

  const feasCount = sc.areas.length * sc.threats.length;
  const feasReal = sc.areas.reduce((acc, a) =>
    acc + sc.threats.filter((t) => table.get(`${a.id}|${t.id}`)?.feasible).length, 0);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 14 }}>

      {/* ---------- headline metrics ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 9, marginBottom: 14 }}>
        <Metric label="Pairings evaluated" v={`${feasCount}`} sub={`${feasReal} feasible`} c="var(--cy)" />
        <Metric label="Subsets tested" v={`${sol.metrics.subsetsEvaluated ?? trace.length}`}
          sub={sol.certified ? 'exhaustive' : 'heuristic'} c="var(--vio)" />
        <Metric label="Decision time" v={`${sol.metrics.solveMs} ms`} sub="full re-solve" c="var(--amb)" />
        <Metric label="Mean single-shot Pk" v={sol.metrics.meanPk.toFixed(3)}
          sub={`${sol.metrics.interceptorsUsed} rounds`} c={COL.burst} />
        <Metric label="Weighted protection" v={`${(sol.metrics.weightedProtection * 100).toFixed(1)}%`}
          sub={`baseline ${((sol.baselineProtection ?? 0) * 100).toFixed(1)}%`} c={COL.burst} />
        <Metric label="Leakers" v={`${sol.metrics.leakers}`}
          sub={`of ${sol.metrics.threatsTotal} tracks`} c={sol.metrics.leakers ? COL.threat : 'var(--dim2)'} />
      </div>

      {/* ---------- Pk heatmap ---------- */}
      <Section title="Kill-probability solution space"
        note="Every battery × threat pairing the optimiser considered — not just the winners. Amber outline = committed.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--panel)', textAlign: 'left', padding: '4px 8px' }}>BATTERY</th>
                {sc.threats.map((t) => (
                  <th key={t.id} style={{ padding: '4px 3px', textAlign: 'center', minWidth: 52 }}>
                    <div style={{ color: 'var(--txt)' }}>{t.callsign.replace('TGT-', '')}</div>
                    <div style={{ fontSize: 7.5, color: 'var(--dim2)' }}>{t.cls}</div>
                  </th>
                ))}
                <th style={{ padding: '4px 6px', textAlign: 'center' }}>BEST</th>
              </tr>
            </thead>
            <tbody>
              {sc.areas.map((a) => {
                const vals = sc.threats.map((t) => {
                  const o = table.get(`${a.id}|${t.id}`);
                  return o?.feasible ? o.pk : null;
                });
                const best = Math.max(0, ...vals.filter((v): v is number => v !== null));
                return (
                  <tr key={a.id}>
                    <td style={{
                      position: 'sticky', left: 0, background: 'var(--panel)', padding: '3px 8px',
                      whiteSpace: 'nowrap',
                      color: sol.selectedAreaIds.includes(a.id) ? 'var(--amb)' : a.active ? 'var(--txt)' : COL.threat,
                    }}>{a.name}{!a.active && ' ✕'}</td>
                    {vals.map((v, j) => {
                      const t = sc.threats[j];
                      const committed = sol.shots.some((s) => s.areaId === a.id && s.threatId === t.id);
                      return (
                        <td key={j} style={{
                          textAlign: 'center', padding: '5px 3px',
                          background: v === null ? '#150b10'
                            : `${heat(v)}${Math.round(28 + v * 150).toString(16).padStart(2, '0')}`,
                          color: v === null ? '#5c3a40' : '#04070a',
                          fontWeight: committed ? 700 : 500,
                          border: committed ? '1.5px solid var(--amb)' : '1px solid #0d1620',
                        }}>{v === null ? '—' : v.toFixed(2)}</td>
                      );
                    })}
                    <td style={{ textAlign: 'center', color: 'var(--dim)', padding: '3px 6px' }}>
                      {best ? best.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 9, fontSize: 9, color: 'var(--dim2)' }}>
          <span>Pk 0.0</span>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{ width: 14, height: 8, background: heat((i / 19) * 0.7) }} />
          ))}
          <span>0.70+</span>
          <div style={{ width: 14, height: 8, background: '#150b10', marginLeft: 10, border: '1px solid #2a1820' }} />
          <span>geometrically infeasible</span>
        </div>
      </Section>

      {/* ---------- minimality trace ---------- */}
      <Section title="Minimality search trace"
        note={sol.certified
          ? 'Subsets enumerated by increasing size. The search stops at the first size containing an admissible subset, so every smaller one was tested and failed.'
          : 'Candidate count exceeded the exhaustive limit — greedy backward elimination was used and the result is NOT certified minimal.'}
        right={
          <span style={{ fontSize: 9, color: sol.certified ? COL.burst : 'var(--amb)' }}>
            {sol.certified ? '✓ PROVEN BY EXHAUSTION' : '⚠ HEURISTIC'}
          </span>
        }>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, marginBottom: 10, color: 'var(--dim2)' }}>
          <span>B = <b style={{ color: 'var(--txt)' }}>{((sol.baselineProtection ?? 0) * 100).toFixed(1)}%</b></span>
          <span>τ = <b style={{ color: 'var(--amb)' }}>{((sol.threshold ?? 0) * 100).toFixed(1)}%</b></span>
          <span>|S*| = <b style={{ color: 'var(--txt)' }}>{sol.selectedAreaIds.length}</b></span>
        </div>
        {sizes.map((k) => {
          const rows = bySize.get(k)!.slice().sort((a, b) => b.protection - a.protection);
          const anyOk = rows.some((r) => r.admissible);
          const stop = k === sol.selectedAreaIds.length;
          return (
            <div key={k} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, color: stop ? 'var(--amb)' : 'var(--dim)' }}>
                  |S| = {k} · {rows.length} subset{rows.length > 1 ? 's' : ''} tested
                </span>
                <span style={{ fontSize: 9, color: anyOk ? COL.burst : COL.threat }}>
                  {anyOk ? '✓ ADMISSIBLE FOUND — SEARCH STOPS' : '✗ NONE REACHED τ'}
                </span>
              </div>
              {rows.slice(0, 8).map((r, i) => {
                const isChosen = r.areaIds.slice().sort().join(',') === chosen && stop;
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'center', fontSize: 9.5, padding: '2px 5px',
                    background: isChosen ? 'rgba(255,176,32,.09)' : 'transparent',
                    border: `1px solid ${isChosen ? 'var(--amb)' : 'transparent'}`, borderRadius: 2,
                  }}>
                    <span style={{ width: 34, color: r.pruned ? 'var(--dim2)' : r.admissible ? COL.burst : COL.threat }}>
                      {r.pruned ? 'SKIP' : r.admissible ? 'PASS' : 'FAIL'}
                    </span>
                    <span style={{ width: 190, color: isChosen ? 'var(--amb)' : 'var(--dim)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {'{' + r.areaIds.map(nameOf).join(',') + '}'}
                    </span>
                    <div style={{ flex: 1, maxWidth: 240 }}>
                      <Bar v={r.protection} c={r.admissible ? (isChosen ? 'var(--amb)' : COL.burst) : COL.threat} h={4} />
                    </div>
                    <span style={{ width: 46, textAlign: 'right', color: 'var(--txt)' }}>
                      {(r.protection * 100).toFixed(1)}%
                    </span>
                    {isChosen && <span style={{ color: 'var(--amb)', fontSize: 9 }}>◉ SELECTED</span>}
                  </div>
                );
              })}
              {rows.length > 8 && (
                <div style={{ fontSize: 9, color: 'var(--dim2)', paddingLeft: 5 }}>
                  …and {rows.length - 8} more at this cardinality
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12 }}>
        {/* ---------- battery utilisation ---------- */}
        <Section title="Battery utilisation"
          note="Which layers of the network actually contributed, and how deep their shots were.">
          <table style={{ width: '100%', fontSize: 10 }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Battery</th><th>Fired</th><th>Reachable</th>
                <th>Mean Pk</th><th>Mean standoff</th><th style={{ width: '26%' }} /></tr>
            </thead>
            <tbody>
              {util.map((u) => (
                <tr key={u.a.id} style={{ borderTop: '1px solid var(--line)', opacity: u.a.active ? 1 : 0.45 }}>
                  <td style={{ color: sol.selectedAreaIds.includes(u.a.id) ? 'var(--amb)' : 'var(--txt)', padding: '3px 0' }}>
                    {u.a.name}
                  </td>
                  <td style={{ textAlign: 'center' }}>{u.fired}/{u.a.inventory}</td>
                  <td style={{ textAlign: 'center', color: 'var(--dim)' }}>{u.feasible}/{sc.threats.length}</td>
                  <td style={{ textAlign: 'center' }}>{u.meanPk ? u.meanPk.toFixed(2) : '—'}</td>
                  <td style={{ textAlign: 'center', color: COL.burst }}>
                    {u.standoff ? `${u.standoff.toFixed(0)} km` : '—'}
                  </td>
                  <td><Bar v={u.fired} max={Math.max(1, u.a.inventory)} c="var(--amb)" h={4} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* ---------- threat class breakdown ---------- */}
        <Section title="Performance by threat class"
          note="Each class stresses a different layer — ballistic tracks the long-range layer, cruise and UAV the point defence.">
          {byCls.map(([cls, e]) => {
            const rate = e.stopped / e.n;
            const mean = e.pk.length ? e.pk.reduce((a, b) => a + b, 0) / e.pk.length : 0;
            return (
              <div key={cls} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--txt)' }}>{cls}</span>
                  <span style={{ color: rate === 1 ? COL.burst : COL.threat }}>
                    {e.stopped}/{e.n} stopped
                  </span>
                </div>
                <Bar v={rate} c={rate === 1 ? COL.burst : COL.threat} h={5} />
                <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 2 }}>
                  mean cumulative Pk {(mean * 100).toFixed(1)}%
                </div>
              </div>
            );
          })}
        </Section>
      </div>

      {/* ---------- solver log ---------- */}
      <Section title="Solver trace" note="Raw decision log from the current solve.">
        <div style={{ maxHeight: 190, overflowY: 'auto' }}>
          {sol.log.map((l, i) => (
            <div key={i} style={{ fontSize: 9.5, color: 'var(--dim)', padding: '2.5px 0', borderBottom: '1px solid #0d141c' }}>
              <span style={{ color: 'var(--dim2)' }}>{String(i + 1).padStart(2, '0')} </span>{l}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Metric({ label, v, sub, c }: { label: string; v: string; sub: string; c: string }) {
  return (
    <div className="card" style={{ padding: '8px 10px' }}>
      <div style={{ fontSize: 7.5, color: 'var(--dim2)', letterSpacing: '.1em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 17, color: c, fontWeight: 700, marginTop: 2 }}>{v}</div>
      <div style={{ fontSize: 8, color: 'var(--dim2)' }}>{sub}</div>
    </div>
  );
}

function Section({ title, note, right, children }: {
  title: string; note?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 11px', borderBottom: '1px solid var(--line)' }}>
        <span className="lbl">{title}</span>{right}
      </div>
      <div style={{ padding: 11 }}>
        {note && <div style={{ fontSize: 9.5, color: 'var(--dim2)', marginBottom: 9, lineHeight: 1.55 }}>{note}</div>}
        {children}
      </div>
    </div>
  );
}
