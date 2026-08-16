'use client';
import React, { useState } from 'react';
import Nav from '@/components/Nav';
import { Bar } from '@/components/ui';
import { COL } from '@/components/symbols';
import { generateScenario } from '@/lib/scenario';
import { allocateMinimalSet } from '@/lib/allocator';
import { useMission } from '@/lib/store';

const STEPS = [
  {
    n: 1, title: 'Compute feasibility',
    q: 'Can each site physically reach each threat in time?',
    body: 'For every (site, threat) pair the solver walks the threat’s sampled trajectory and asks four questions: is the point inside the battery’s slant-range envelope, is it inside its engagement altitude band, can an interceptor launched after the system’s reaction delay physically fly there before the threat arrives, and does that happen before the threat strikes its protected asset. Pairs failing any test are marked infeasible and can never be assigned.',
    out: 'A feasible/infeasible flag and an engagement window for every pair.',
  },
  {
    n: 2, title: 'Build the cost matrix',
    q: 'How good is each possible shot?',
    body: 'Each feasible pair is scored with a kill-probability model, then weighted by the value of the asset that threat is aimed at. Rows of the matrix are individual interceptor rounds (one per missile on the rail, with reload cadence penalties); columns are live threats. Cost is the negative of (Pk × target value), so minimising total cost maximises expected value-weighted destruction. Infeasible pairs receive a prohibitive big-M cost.',
    out: 'An N-rounds × M-threats cost matrix.',
  },
  {
    n: 3, title: 'Solve the assignment exactly',
    q: 'Which round engages which threat?',
    body: 'A Jonker-Volgenant O(n³) rectangular assignment solver — the same algorithm as scipy.optimize.linear_sum_assignment — finds the provably optimal one-to-one matching. Many-to-many (several rounds on one threat) is handled by re-running the exact solver in salvo waves: after each wave, threats already above the Pk target drop out and remaining rounds are re-optimised against diminishing marginal returns. Exact per wave, not greedy.',
    out: 'An optimal fire plan for a given set of sites.',
  },
  {
    n: 4, title: 'Search for the minimal site subset',
    q: 'What is the smallest set of sites that still does the job?',
    body: 'The assignment solve above becomes the inner loop of a subset search. Define B as the protection achievable using every candidate site, and τ = B − tolerance as the acceptance bar. A subset is admissible if its protection reaches τ. The search enumerates subsets by increasing cardinality — all subsets of size 1, then size 2, and so on — and stops at the first size that contains an admissible subset.',
    out: 'The smallest sufficient set of launch areas.',
  },
  {
    n: 5, title: 'Certify minimality',
    q: 'How do we know nothing smaller works?',
    body: 'Because the search moves upward through cardinalities, when it accepts a subset of size k it has already explicitly evaluated and rejected every subset of every smaller size. That is a constructive proof by exhaustion, not a local optimum. Exhaustive certification is 2ⁿ assignment solves in the worst case, so it runs up to 12 candidate sites; above that the solver falls back to greedy backward elimination and reports its answer as HEURISTIC rather than claim a proof it did not perform.',
    out: 'A CERTIFIED or HEURISTIC flag, surfaced in the UI header.',
  },
];

export default function Methodology() {
  const { sol } = useMission();
  const [bench, setBench] = useState<{ label: string; nT: number; nA: number; ms: number; subsets: number }[] | null>(null);
  const [running, setRunning] = useState(false);

  const runBench = async () => {
    setRunning(true); setBench(null);
    await new Promise((r) => setTimeout(r, 40));
    const cfgs: [string, number, number][] = [
      ['Small', 3, 3], ['Typical', 5, 5], ['Large', 8, 7],
      ['Stress', 12, 8], ['Heavy', 15, 8], ['Max certified', 20, 10],
    ];
    const out = cfgs.map(([label, nT, nA]) => {
      const s = generateScenario({ tier: 'random', seed: 4242, nThreats: nT, nAreas: nA, theatreId: 'NW' });
      const t0 = performance.now();
      const r = allocateMinimalSet(s);
      return { label, nT, nA, ms: Math.round(performance.now() - t0), subsets: r.metrics.subsetsEvaluated ?? 0 };
    });
    setBench(out); setRunning(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', overflow: 'hidden' }}>
      <Nav />
      <div style={{ overflowY: 'auto', padding: '16px 20px 40px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>

          <h1 style={{ fontSize: 17, color: 'var(--txt)', letterSpacing: '.04em', margin: '0 0 4px', fontWeight: 600 }}>
            METHODOLOGY
          </h1>
          <p style={{ fontSize: 11, color: 'var(--dim)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 760 }}>
            How the system decides which interceptor sites to use and what each one shoots.
            Five stages, each one auditable in the UI.
          </p>

          {/* ---------- ALGORITHM STEPS ---------- */}
          {STEPS.map((s) => (
            <div key={s.n} className="card" style={{ marginBottom: 9, padding: 0, display: 'flex' }}>
              <div style={{
                width: 46, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: 13, borderRight: '1px solid var(--line)', background: 'rgba(255,176,32,.04)',
              }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--amb)' }}>{s.n}</span>
              </div>
              <div style={{ padding: '11px 14px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--txt)', letterSpacing: '.03em' }}>{s.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--amb)', marginTop: 2, fontStyle: 'italic' }}>{s.q}</div>
                <div style={{ fontSize: 10.5, color: 'var(--dim)', lineHeight: 1.7, marginTop: 6 }}>{s.body}</div>
                <div style={{ fontSize: 9.5, color: 'var(--dim2)', marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--line)' }}>
                  <b style={{ color: 'var(--cy)' }}>Output:</b> {s.out}
                </div>
              </div>
            </div>
          ))}

          {/* ---------- Pk CARD + REAL/SIM ---------- */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 12, marginTop: 18 }}>
            <div className="card" style={{ padding: 13, borderColor: 'var(--amb)' }}>
              <div style={{ fontSize: 10, color: 'var(--amb)', letterSpacing: '.09em', marginBottom: 8 }}>
                ENGINEERING MODEL — SIMPLIFIED FOR DEMONSTRATION
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 2, padding: 11, fontSize: 11.5, lineHeight: 2 }}>
                <div style={{ color: 'var(--amb)' }}>
                  P<sub>k</sub> = 0.92 · f<sub>range</sub> · f<sub>aspect</sub> · f<sub>margin</sub> · f<sub>class</sub>
                </div>
                <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>f<sub>range</sub> &nbsp;= 1 − 0.55·(r / r<sub>max</sub>)<sup>1.6</sup></div>
                <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>f<sub>aspect</sub> = 1.0 head-on → 0.15 tail-chase</div>
                <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>f<sub>margin</sub> = 1 − e<sup>−Δt / 22</sup></div>
                <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>f<sub>class</sub> &nbsp;= 0.72 (&gt;3 km/s) · 0.84 (&gt;2 km/s) · 0.93 · 0.96 cruise</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.7, marginTop: 9 }}>
                <b style={{ color: 'var(--txt)' }}>Reading it in one line:</b> kill probability starts
                at a ceiling and is multiplied down by four penalties — how far out the shot is
                relative to the battery&rsquo;s maximum range, the angle the interceptor meets the
                threat at, how much time remains before impact, and how fast the re-entry vehicle is.
                Every factor is bounded [0,1] and monotone, so any preference the optimiser expresses
                can be traced to a specific factor.
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--amb)', lineHeight: 1.65, marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                Real operational kill-probability data is classified. This model uses publicly
                documented intercept-geometry relationships — range, closing angle, interceptor
                speed, time margin — as a reasonable engineering approximation. It is sufficient to
                rank engagement options defensibly; absolute values should not be read as real
                system capability.
              </div>
            </div>

            <div className="card" style={{ padding: 13 }}>
              <div style={{ fontSize: 10, color: 'var(--cy)', letterSpacing: '.09em', marginBottom: 9 }}>
                WHAT&rsquo;S REAL vs SIMULATED
              </div>
              {[
                ['real', 'The optimisation algorithm', 'Hungarian / Jonker-Volgenant assignment and the exhaustive minimality search are genuine implementations, verified against a known-optimal case. Not simulated, not scripted.'],
                ['real', 'Geography', 'Natural Earth borders, coastlines and cities for India and its neighbours. Real coordinates and populations.'],
                ['real', 'Weapon-system specifications', 'S-400, PAD, AAD, MR-SAM/Barak-8, Akash, SPYDER, QRSAM, S-125 — range, altitude, speed, guidance, radar and warhead figures from published open sources, each cited in-app.'],
                ['sim', 'Site positions and unit names', 'Every battery location, radar site and unit designator is illustrative. No real installation is represented.'],
                ['sim', 'Target trajectories', 'Synthetically generated from published threat-class envelopes. The PS ships no dataset — scenarios are produced by a seeded generator.'],
                ['sim', 'Kill probability', 'The engineering model above, not validated lethality data.'],
                ['none', 'Not modelled at all', 'Sensor coverage gaps, track quality, radar horizon, ECM, debris, fratricide, terrain masking, weather.'],
              ].map(([k, title, body]) => {
                const c = k === 'real' ? COL.burst : k === 'sim' ? 'var(--amb)' : 'var(--threat)';
                const tag = k === 'real' ? 'REAL' : k === 'sim' ? 'ILLUSTRATIVE' : 'NOT MODELLED';
                return (
                  <div key={title as string} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 7.5, color: c, border: `1px solid ${c}44`, background: `${c}0d`,
                      padding: '2px 4px', borderRadius: 2, height: 'fit-content', width: 74,
                      textAlign: 'center', flexShrink: 0, letterSpacing: '.05em',
                    }}>{tag}</span>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--txt)' }}>{title}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--dim)', lineHeight: 1.55 }}>{body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------- BENCHMARK ---------- */}
          <div className="card" style={{ padding: 13, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--vio)', letterSpacing: '.09em' }}>
                SCALABILITY — SOLVE TIME vs SCENARIO SIZE
              </div>
              <button onClick={runBench} disabled={running}>
                {running ? 'Running…' : '▶ Run benchmark now'}
              </button>
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--dim2)', marginBottom: 9, lineHeight: 1.55 }}>
              Measured live in your browser when you press the button — not pre-recorded numbers.
              Current live scenario solved in <b style={{ color: 'var(--cy)' }}>{sol?.metrics.solveMs ?? '—'} ms</b>
              {sol?.metrics.subsetsEvaluated ? ` after evaluating ${sol.metrics.subsetsEvaluated} candidate subsets.` : '.'}
            </div>
            {!bench && !running && (
              <div style={{ fontSize: 10, color: 'var(--dim2)', padding: 16, textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 2 }}>
                Press &ldquo;Run benchmark now&rdquo; to measure on this machine.
              </div>
            )}
            {running && <div className="pulse" style={{ fontSize: 10, color: 'var(--amb)', padding: 16, textAlign: 'center' }}>Solving six scenarios…</div>}
            {bench && (
              <table style={{ width: '100%', fontSize: 10.5 }}>
                <thead><tr><th>Scenario</th><th>Threats</th><th>Candidate sites</th><th>Subsets evaluated</th><th>Solve time</th><th style={{ width: '34%' }}></th></tr></thead>
                <tbody>
                  {bench.map((b) => (
                    <tr key={b.label} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ color: 'var(--txt)' }}>{b.label}</td>
                      <td>{b.nT}</td><td>{b.nA}</td><td>{b.subsets}</td>
                      <td style={{ color: b.ms < 200 ? COL.burst : b.ms < 1000 ? 'var(--amb)' : COL.threat }}>{b.ms} ms</td>
                      <td><Bar v={b.ms} max={Math.max(...bench.map((x) => x.ms))}
                        c={b.ms < 200 ? COL.burst : b.ms < 1000 ? 'var(--amb)' : COL.threat} h={5} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ fontSize: 9.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.55 }}>
              Live re-optimisation — a battery going offline, or a new threat injected — re-runs this
              same path from the current simulation time. The interactive latency a user experiences
              is the number in the solve column.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
