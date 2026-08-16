'use client';
// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
import React, { useState } from 'react';
import Nav from '@/components/Nav';
import Timeline from '@/components/Timeline';
import EventLog from '@/components/EventLog';
import Inspector from '@/components/Inspector';
import GeoMap, { type Sel } from '@/components/GeoMap';
import { Pill, Bar } from '@/components/ui';
import { MapLegend, COL, ThreatChip, IntcpChip, ShieldIcon } from '@/components/symbols';
import { useMission } from '@/lib/store';
import { diagnoseSites } from '@/lib/diagnostics';
import { clock } from '@/lib/format';

type Tab = 'plan' | 'timeline' | 'log' | 'inspector';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Fire Plan' },
  { id: 'timeline', label: 'Mission Timeline' },
  { id: 'log', label: 'Event Log' },
  { id: 'inspector', label: 'Site Inspector' },
];

export default function MissionDetail() {
  const { sc, sol, t, setT, tMax, playing, setPlaying, rate, setRate } = useMission();
  const [tab, setTab] = useState<Tab>('plan');   // Fire Plan is the headline answer
  const [sel, setSel] = useState<Sel>(null);

  if (!sc || !sol) return <div style={{ padding: 30, color: 'var(--dim)' }}>INITIALISING…</div>;
  const m = sol.metrics;

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto auto 1fr', height: '100vh', overflow: 'hidden' }}>
      <Nav right={
        <>
          <span style={{ fontSize: 10, color: 'var(--dim)' }}>T+{t.toFixed(1)}s</span>
          <button className={playing ? 'on' : ''} onClick={() => setPlaying(!playing)}>
            {playing ? '❚❚ Hold' : '▶ Run'}
          </button>
          {[1, 4, 10].map((r) => (
            <button key={r} className={rate === r ? 'on' : ''} style={{ padding: '5px 8px' }}
              onClick={() => setRate(r)}>{r}×</button>
          ))}
          <Pill label={m.leakers ? `${m.leakers} LEAKER` : 'ALL NEUTRALISED'} state={m.leakers ? 'crit' : 'ok'} />
        </>
      } />

      {/* scrub bar */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input type="range" min={0} max={tMax} step={0.25} value={Math.min(t, tMax)}
          onChange={(e) => { setPlaying(false); setT(+e.target.value); }} style={{ flex: 1 }} />
        <span style={{ fontSize: 9.5, color: 'var(--dim2)', whiteSpace: 'nowrap' }}>
          {sol.selectedAreaIds.length}/{sc.areas.length} sites · {m.interceptorsUsed} rounds · {m.solveMs}ms
        </span>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        {TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)}
            style={{
              border: 'none', borderRadius: 0, background: 'transparent', padding: '9px 17px',
              borderBottom: tab === x.id ? '2px solid var(--amb)' : '2px solid transparent',
              color: tab === x.id ? 'var(--amb)' : 'var(--dim)', fontSize: 10.5,
            }}>{x.label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 12 }}>
          <MapLegend compact />
        </div>
      </div>

      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {tab === 'plan' && <FirePlan />}
        {tab === 'timeline' && <TimelineTab />}
        {tab === 'log' && <div style={{ height: '100%' }}><EventLog sc={sc} sol={sol} t={t} /></div>}
        {tab === 'inspector' && <InspectorTab />}
      </div>
    </div>
  );

  /* ===================== FIRE PLAN ===================== */
  function FirePlan() {
    if (!sc || !sol) return null;
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: 14 }}>
        <div className="card" style={{ padding: 10, marginBottom: 13, borderLeft: `2px solid ${COL.intcp}` }}>
          <div style={{ fontSize: 11, color: 'var(--txt)', lineHeight: 1.6 }}>
            Each selected site is assigned to the targets it can intercept with highest kill
            probability (Pk). <b style={{ color: COL.intcp }}>Pk is the probability that the
            interceptor destroys the incoming threat</b> — higher is better for the defender.
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--dim2)', marginTop: 5 }}>
            Selected subset: <b style={{ color: 'var(--amb)' }}>
              {sol.selectedAreaIds.map((id) => sc.areas.find((a) => a.id === id)?.name).join(' · ')}
            </b> — {sol.selectedAreaIds.length} of {sol.consideredAreaIds.length} candidate sites
            {sol.certified && ', minimality proven by exhaustive search'}
          </div>
        </div>

        {sc.assets.map((asset) => {
          const rows = sc.threats.filter((th) => th.targetAssetId === asset.id);
          if (!rows.length) return null;
          return (
            <div key={asset.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <svg width="17" height="17" viewBox="-13 -14 26 30"><ShieldIcon s={0.92} /></svg>
                <span style={{ fontSize: 12, color: COL.asset, letterSpacing: '.05em' }}>
                  {asset.name.toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: 'var(--dim2)' }}>
                  protected asset · {(asset.population / 1e6).toFixed(1)}M people · value {asset.value}/10
                </span>
              </div>

              <table style={{ width: '100%', fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: 26 }}></th><th>Incoming threat</th>
                    <th style={{ width: 26 }}></th><th>Interceptor site</th>
                    <th>Launch</th><th>Flight</th><th>Destroys at</th><th>Altitude</th>
                    <th>From asset</th><th>Pk</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((th) => {
                    const r = sol.perThreat.find((p) => p.threatId === th.id)!;
                    if (r.leaker) {
                      return (
                        <tr key={th.id} style={{ borderTop: '1px solid var(--line)' }}>
                          <td><ThreatChip /></td>
                          <td style={{ color: COL.threat }}>{th.callsign} <span style={{ color: 'var(--dim2)' }}>{th.cls}</span></td>
                          <td colSpan={8} style={{ color: COL.threat }}>
                            LEAKER — no site can reach it before it strikes {asset.name}
                          </td>
                        </tr>
                      );
                    }
                    return r.shots.map((s, i) => {
                      const a = sc.areas.find((x) => x.id === s.areaId)!;
                      return (
                        <tr key={th.id + i} style={{ borderTop: i === 0 ? '1px solid var(--line)' : 'none' }}>
                          <td>{i === 0 && <ThreatChip />}</td>
                          <td style={{ color: i === 0 ? 'var(--txt)' : 'var(--dim2)' }}>
                            {i === 0 ? <>{th.callsign} <span style={{ color: 'var(--dim2)' }}>{th.cls}</span></> : `↳ round ${i + 1}`}
                          </td>
                          <td><IntcpChip /></td>
                          <td style={{ color: COL.intcp }}>{a.name}</td>
                          <td style={{ color: 'var(--dim)' }}>{clock(s.option.tLaunch)}</td>
                          <td style={{ color: COL.intcp }}>{(s.option.tIntercept - s.option.tLaunch).toFixed(0)}s</td>
                          <td style={{ color: 'var(--dim)' }}>{clock(s.option.tIntercept)}</td>
                          <td>{(s.option.interceptAltM / 1000).toFixed(1)} km</td>
                          <td style={{ color: COL.burst }}>
                            {s.option.standoffFromAssetKm ?? '—'} km
                          </td>
                          <td style={{ color: 'var(--txt)' }}>{(s.option.pk * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>

              {rows.map((th) => {
                const r = sol.perThreat.find((p) => p.threatId === th.id)!;
                if (r.leaker) return null;
                return (
                  <div key={th.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 9.5 }}>
                    <span style={{ width: 62, color: 'var(--dim2)' }}>{th.callsign}</span>
                    <div style={{ flex: 1, maxWidth: 320 }}><Bar v={r.cumulativePk} c={COL.burst} h={4} /></div>
                    <span style={{ color: COL.burst }}>
                      {(r.cumulativePk * 100).toFixed(1)}% cumulative probability of destroying this threat
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  /* ===================== TIMELINE ===================== */
  function TimelineTab() {
    if (!sc || !sol) return null;
    const stages = [
      { c: 'var(--cy)', s: 'circle', label: 'Detected', desc: 'track acquired by radar' },
      { c: 'var(--vio)', s: 'diamond', label: 'Decision', desc: 'firing solution computed' },
      { c: COL.intcp, s: 'tri', label: 'Launch', desc: 'interceptor away' },
      { c: COL.burst, s: 'circle', label: 'Intercept', desc: 'threat destroyed in air' },
      { c: COL.threat, s: 'cross', label: 'Impact if missed', desc: 'threat reaches asset' },
    ];
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 0, padding: '10px 14px 8px', borderBottom: '1px solid var(--line)' }}>
          {stages.map((s, i) => (
            <div key={s.label} style={{ flex: 1, display: 'flex', gap: 7, alignItems: 'flex-start', paddingRight: 10 }}>
              <span style={{ position: 'relative', width: 9, height: 9, marginTop: 2, flexShrink: 0 }}>
                <Mark c={s.c} s={s.s} />
              </span>
              <div>
                <div style={{ fontSize: 10, color: s.c, letterSpacing: '.05em' }}>
                  {i + 1}. {s.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--dim2)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Timeline sc={sc} sol={sol} t={t} tMax={tMax} onSeek={(v) => { setPlaying(false); setT(v); }} />
        </div>
      </div>
    );
  }

  /* ===================== SITE INSPECTOR (standalone) ===================== */
  function InspectorTab() {
    if (!sc || !sol) return null;
    const diag = diagnoseSites(sc, sol);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '212px 1fr 320px', height: '100%', minHeight: 0 }}>
        <div style={{ borderRight: '1px solid var(--line)', overflowY: 'auto', padding: 9 }}>
          <div className="lbl" style={{ marginBottom: 6 }}>Interceptor sites</div>
          {diag.map((d) => (
            <button key={d.areaId}
              className={sel?.kind === 'site' && sel.id === d.areaId ? 'on' : ''}
              onClick={() => setSel({ kind: 'site', id: d.areaId })}
              style={{ width: '100%', textAlign: 'left', marginBottom: 3, padding: '6px 7px', lineHeight: 1.35 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9.5 }}>{d.name}</span>
                <span style={{ fontSize: 7.5, color: d.state === 'TASKED' ? 'var(--amb)' : d.state === 'OFFLINE' ? 'var(--threat)' : 'var(--dim2)' }}>
                  {d.state}
                </span>
              </div>
              <div style={{ fontSize: 7.5, color: 'var(--dim2)', textTransform: 'none', letterSpacing: 0 }}>
                {d.feasibleTargets}/{d.totalTargets} reachable · best Pk {d.bestPk.toFixed(2)}
              </div>
            </button>
          ))}
          <div className="lbl" style={{ marginTop: 12, marginBottom: 6 }}>Threats</div>
          {sc.threats.map((th) => (
            <button key={th.id}
              className={sel?.kind === 'threat' && sel.id === th.id ? 'on' : ''}
              onClick={() => setSel({ kind: 'threat', id: th.id })}
              style={{ width: '100%', textAlign: 'left', marginBottom: 3, padding: '5px 7px', fontSize: 9 }}>
              {th.callsign} <span style={{ color: 'var(--dim2)' }}>{th.cls} → {th.targetAssetName}</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <GeoMap sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} addMode={false}
            onMapClick={() => {}} layers={{ tracks: true, predict: true, engage: true, rings: true, origins: false, altticks: true, grid: true, places: true, labels: true, states: true }} />
          <div style={{ position: 'absolute', top: 8, left: 8 }}><MapLegend compact /></div>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', minHeight: 0, overflow: 'hidden' }}>
          <Inspector sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} />
        </div>
      </div>
    );
  }
}

function Mark({ c, s }: { c: string; s: string }) {
  const base: React.CSSProperties = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 8, height: 8 };
  if (s === 'circle') return <span style={{ ...base, background: c, borderRadius: '50%' }} />;
  if (s === 'diamond') return <span style={{ ...base, background: c, transform: 'translate(-50%,-50%) rotate(45deg)' }} />;
  if (s === 'tri') return <span style={{ ...base, width: 0, height: 0, borderLeft: '4.5px solid transparent', borderRight: '4.5px solid transparent', borderBottom: `8px solid ${c}` }} />;
  return <span style={base}><svg width="9" height="9" viewBox="0 0 9 9"><path d="M0,0 L9,9 M9,0 L0,9" stroke={c} strokeWidth="1.7" /></svg></span>;
}
