'use client';
// InterceptIQ
import React, { useState } from 'react';
import Nav from '@/components/Nav';
import Timeline from '@/components/Timeline';
import EventLog from '@/components/EventLog';
import Inspector from '@/components/Inspector';
import AnalysisTab from '@/components/AnalysisTab';
import GeoMap, { type Sel } from '@/components/GeoMap';
import { Pill, Bar } from '@/components/ui';
import { MapLegend, COL, ThreatChip, IntcpChip, ShieldIcon } from '@/components/symbols';
import { useMission } from '@/lib/store';
import { diagnoseSites } from '@/lib/diagnostics';
import { clock } from '@/lib/format';

type Tab = 'plan' | 'analysis' | 'timeline' | 'log' | 'inspector';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Fire Plan' },
  { id: 'analysis', label: 'Analysis' },
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

      {/* MISSION SUMMARY BAR
        * The scrub control used to sit alone in a 6px-tall strip with the
        * mission statistics squeezed to its right at 9.5px. Those numbers
        * are the context for everything below, so they now lead the bar as
        * labelled figures, with the scrub beneath them at full width. */}
      <div style={{
        padding: 'var(--s3) var(--s4)', borderBottom: '1px solid var(--line)',
        background: 'linear-gradient(180deg, var(--panel2), var(--panel))',
      }} className="raised">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s5)', flexWrap: 'wrap' }}>
          <MiniStat label="Sites" v={`${sol.selectedAreaIds.length}/${sc.areas.length}`} c="var(--intcp)" />
          <MiniStat label="Rounds" v={`${m.interceptorsUsed}`} c="var(--txt)" />
          <MiniStat label="Mean Pk" v={m.meanPk.toFixed(2)} c="var(--burst)" />
          <MiniStat label="Solve" v={`${m.solveMs}ms`} c="var(--amb)" />
          <div style={{ marginLeft: 'auto' }}><MapLegend compact /></div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center', marginTop: 'var(--s3)' }}>
          <span className="lbl" style={{ whiteSpace: 'nowrap' }}>T+{t.toFixed(1)}s</span>
          <input type="range" min={0} max={tMax} step={0.25} value={Math.min(t, tMax)}
            onChange={(e) => { setPlaying(false); setT(+e.target.value); }}
            style={{ flex: 1, ['--pct' as string]: `${(Math.min(t, tMax) / (tMax || 1)) * 100}%` }} />
        </div>
      </div>

      {/* tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--line)',
        background: 'var(--panel)', paddingLeft: 'var(--s2)',
      }}>
        {TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)}
            style={{
              border: 'none', borderRadius: 0, background: 'transparent',
              padding: '11px 18px', letterSpacing: '.09em',
              borderBottom: tab === x.id ? '2px solid var(--amb)' : '2px solid transparent',
              color: tab === x.id ? 'var(--amb)' : 'var(--dim)',
              fontSize: 'var(--t-small)',
            }}>{x.label}</button>
        ))}
      </div>

      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {tab === 'plan' && <FirePlan />}
        {tab === 'analysis' && <AnalysisTab sc={sc} sol={sol} />}
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
          <div style={{ fontSize: 'var(--t-body)', color: 'var(--txt2)', lineHeight: 1.7 }}>
            Each selected site is assigned to the targets it can intercept with highest kill
            probability (Pk). <b style={{ color: COL.intcp }}>Pk is the probability that the
            interceptor destroys the incoming threat</b> — higher is better for the defender.
          </div>
          <div style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)', marginTop: 6 }}>
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
                <span style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)' }}>
                  protected asset · {(asset.population / 1e6).toFixed(1)}M people · value {asset.value}/10
                </span>
              </div>

              <table style={{ width: '100%', fontSize: 'var(--t-small)' }}>
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
                  <div key={th.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, fontSize: 'var(--t-micro)' }}>
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
                <div style={{ fontSize: 'var(--t-small)', color: s.c, letterSpacing: '.06em' }}>
                  {i + 1}. {s.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)' }}>{s.desc}</div>
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
                <span style={{ fontSize: 'var(--t-small)' }}>{d.name}</span>
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
              style={{ width: '100%', textAlign: 'left', marginBottom: 3, padding: '6px 8px', fontSize: 'var(--t-micro)' }}>
              {th.callsign} <span style={{ color: 'var(--dim2)' }}>{th.cls} → {th.targetAssetName}</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <GeoMap sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} addMode={false}
            onMapClick={() => {}}
            /* Match the overview's decluttered defaults: rings on demand
             * (hover a site or use the toggle), no city names or graticule.
             * These were left at the old always-on values. */
            layers={{ tracks: true, predict: true, engage: true, rings: false, origins: false, altticks: false, grid: false, places: false, labels: true, states: true }} />
          <div style={{ position: 'absolute', top: 8, left: 8 }}><MapLegend compact /></div>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', minHeight: 0, overflow: 'hidden' }}>
          <Inspector sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} />
        </div>
      </div>
    );
  }
}

/** Compact labelled figure for the mission summary bar. */
function MiniStat({ label, v, c }: { label: string; v: string; c: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span className="lbl">{label}</span>
      <span className="tnum" style={{ fontSize: 'var(--t-sub)', fontWeight: 600, color: c, lineHeight: 1.1 }}>{v}</span>
    </div>
  );
}

function Mark({ c, s }: { c: string; s: string }) {
  const base: React.CSSProperties = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 8, height: 8 };
  if (s === 'circle') return <span style={{ ...base, background: c, borderRadius: '50%' }} />;
  if (s === 'diamond') return <span style={{ ...base, background: c, transform: 'translate(-50%,-50%) rotate(45deg)' }} />;
  if (s === 'tri') return <span style={{ ...base, width: 0, height: 0, borderLeft: '4.5px solid transparent', borderRight: '4.5px solid transparent', borderBottom: `8px solid ${c}` }} />;
  return <span style={base}><svg width="9" height="9" viewBox="0 0 9 9"><path d="M0,0 L9,9 M9,0 L0,9" stroke={c} strokeWidth="1.7" /></svg></span>;
}
