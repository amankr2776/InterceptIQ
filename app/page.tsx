'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import GeoMap, { type Sel } from '@/components/GeoMap';
import Inspector from '@/components/Inspector';
import ProfileView from '@/components/ProfileView';
import Timeline from '@/components/Timeline';
import EventLog from '@/components/EventLog';
import { Num, Stat, ThreatSymbol, Pill } from '@/components/ui';
import { useMission } from '@/lib/store';
import { THEATRES } from '@/lib/theatre';
import { dms } from '@/lib/format';

const LAYERS = [
  ['tracks', 'Tracks'], ['predict', 'Predicted path'], ['engage', 'Engagements'],
  ['rings', 'Range rings'], ['origins', 'Launch points'], ['altticks', 'Alt ticks'],
  ['grid', 'Graticule'], ['places', 'Cities'], ['labels', 'Country names'],
] as const;

export default function MissionControl() {
  const {
    sc, sol, t, setT, tMax, playing, setPlaying, rate, setRate,
    minimise, setMinimise, load, toggleSite, addThreat, flash,
  } = useMission();
  const [sel, setSel] = useState<Sel>(null);
  const [addMode, setAddMode] = useState(false);
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [bottom, setBottom] = useState<'timeline' | 'profile' | 'log'>('timeline');
  const [dockH, setDockH] = useState(236);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    tracks: true, predict: true, engage: true, rings: true,
    origins: true, altticks: true, grid: true, places: true, labels: true,
  });
  const [panel, setPanel] = useState<'inspect' | 'plan'>('inspect');

  if (!sc || !sol) return <div style={{ padding: 30, color: 'var(--dim)' }}>INITIALISING…</div>;
  const m = sol.metrics;
  const theatre = THEATRES.find((x) => x.id === sc.theatreId);
  const theatreName = theatre ? theatre.name : 'Theatre';

  const curLat = cursor?.lat ?? null;
  const curLon = cursor?.lon ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', overflow: 'hidden' }}>
      {/* ============ TOP BAR ============ */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '7px 13px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--amb)', letterSpacing: '.06em' }}>CK115</div>
          <div style={{ fontSize: 8, color: 'var(--dim2)' }}>{theatreName.toUpperCase()}</div>
        </div>
        <div style={{ width: 1, height: 28, background: 'var(--line)' }} />
        <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
          <Stat label="Tracks"><Num value={m.threatsTotal} /></Stat>
          <Stat label="Engaged" c="var(--grn)"><Num value={m.threatsEngaged} /></Stat>
          <Stat label="Leakers" c={m.leakers ? 'var(--red)' : 'var(--dim2)'}><Num value={m.leakers} /></Stat>
          <Stat label="Sites tasked" c="var(--amb)">{sol.selectedAreaIds.length}/{sc.areas.length}</Stat>
          <Stat label="Rounds"><Num value={m.interceptorsUsed} /></Stat>
          <Stat label="Protection" c="var(--grn)"><Num value={m.weightedProtection * 100} decimals={1} suffix="%" /></Stat>
          <Stat label="Solve" c="var(--cy)"><Num value={m.solveMs} suffix="ms" /></Stat>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          <Link href="/national"><button>← National Map</button></Link>
          <Pill label={playing ? 'SIM RUNNING' : 'SIM HOLD'} state={playing ? 'ok' : 'idle'} />
          <Pill label={sol.certified ? 'MINIMAL: PROVEN' : 'MINIMAL: HEURISTIC'} state={sol.certified ? 'ok' : 'warn'} />
          <Pill label={`${sc.areas.filter((a) => a.active).length}/${sc.areas.length} SITES UP`}
            state={sc.areas.some((a) => !a.active) ? 'crit' : 'ok'} />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '164px 1fr 292px', minHeight: 0 }}>
        {/* ============ LEFT RAIL ============ */}
        <aside style={{ borderRight: '1px solid var(--line)', overflowY: 'auto', padding: 9, background: 'var(--panel)' }}>
          <div className="lbl">Theatre</div>
          <div style={{ display: 'grid', gap: 3, marginTop: 4 }}>
            {THEATRES.map((th) => (
              <button key={th.id} className={sc.theatreId === th.id ? 'on' : ''}
                style={{ textAlign: 'left', fontSize: 9, padding: '5px 6px', lineHeight: 1.3 }}
                onClick={() => { load(sc.tier === 'random' ? 'medium' : sc.tier, 42, th.id); setSel(null); }}>
                {th.name.replace(' Sector', '').replace(' Seaboard', '').replace(' Corridor', '').replace(' Peninsula', '')}
                <div style={{ fontSize: 7.5, color: 'var(--dim2)' }}>{th.sub}</div>
              </button>
            ))}
          </div>

          <div className="lbl" style={{ marginTop: 12 }}>Scenario</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
            {(['easy', 'medium', 'hard'] as const).map((x) => (
              <button key={x} className={sc.tier === x ? 'on' : ''} onClick={() => { load(x, 42, sc.theatreId); setSel(null); }}>{x}</button>
            ))}
            <button onClick={() => { load('random', undefined, sc.theatreId); setSel(null); }}>Rand</button>
          </div>

          <div className="lbl" style={{ marginTop: 12 }}>Playback</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button className={playing ? 'on' : ''} style={{ flex: 1 }} onClick={() => setPlaying(!playing)}>
              {playing ? '❚❚ Hold' : '▶ Run'}
            </button>
            <button onClick={() => { setT(0); setPlaying(false); }}>↺</button>
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {[1, 4, 10, 25].map((r) => (
              <button key={r} className={rate === r ? 'on' : ''} style={{ flex: 1, padding: '5px 0' }} onClick={() => setRate(r)}>{r}×</button>
            ))}
          </div>

          <div className="lbl" style={{ marginTop: 12 }}>Optimiser</div>
          <button className={minimise ? 'on' : ''} style={{ width: '100%', marginTop: 4 }} onClick={() => setMinimise(!minimise)}>
            {minimise ? '✓ Minimal subset' : 'Use all sites'}
          </button>

          <div className="lbl" style={{ marginTop: 12 }}>Inject</div>
          <button className={addMode ? 'on' : ''} style={{ width: '100%', marginTop: 4 }} onClick={() => setAddMode(!addMode)}>
            {addMode ? '◉ Click map…' : '+ New track'}
          </button>

          <div className="lbl" style={{ marginTop: 12 }}>Batteries</div>
          {sc.areas.map((a) => {
            const tasked = sol.selectedAreaIds.includes(a.id);
            return (
              <div key={a.id} style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                <button style={{ flex: 1, textAlign: 'left', fontSize: 9, padding: '5px 6px' }}
                  className={tasked ? 'on' : ''} onClick={() => setSel({ kind: 'site', id: a.id })}>
                  {!a.active ? '✕' : tasked ? '◉' : '○'} {a.name.replace('Site ', '')}
                </button>
                <button style={{ padding: '5px 6px', fontSize: 8.5 }}
                  className={!a.active ? 'danger on' : ''} onClick={() => toggleSite(a.id)}
                  title={a.active ? 'Destroy this site' : 'Restore'}>
                  {a.active ? 'KILL' : 'UP'}
                </button>
              </div>
            );
          })}

          <div className="lbl" style={{ marginTop: 12 }}>Layers</div>
          {LAYERS.map(([kk, label]) => (
            <button key={kk} className={layers[kk] ? 'on' : ''}
              style={{ width: '100%', marginTop: 3, textAlign: 'left', fontSize: 9, padding: '4px 6px' }}
              onClick={() => setLayers((s) => ({ ...s, [kk]: !s[kk] }))}>
              {layers[kk] ? '✓' : '·'} {label}
            </button>
          ))}

          <div className="lbl" style={{ marginTop: 12 }}>Symbology</div>
          {([['SRBM','Short-range BM'],['MRBM','Medium-range BM'],['TBM','Tactical BM'],['CRUISE','Cruise missile']] as const).map(([c,l]) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 8, color: 'var(--dim)' }}>
              <ThreatSymbol cls={c} size={11} /> <span style={{color:'var(--dim2)'}}>{l}</span>
            </div>
          ))}
        </aside>

        {/* ============ MAP + BOTTOM DOCK ============ */}
        <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <GeoMap sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} addMode={addMode}
              onMapClick={(lat, lon) => { addThreat(lat, lon); setAddMode(false); }}
              layers={layers} onCursor={setCursor} />

            {/* cursor readout */}
            <div style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(6,10,15,.92)', border: '1px solid var(--line)', borderRadius: 2, padding: '5px 9px', fontSize: 9.5, color: 'var(--dim)', pointerEvents: 'none' }}>
              {cursor && curLat !== null && curLon !== null ? (
                <>
                  <div style={{ color: 'var(--txt)' }}>{dms(curLat, true)}  {dms(curLon, false)}</div>
                  <div>{curLat.toFixed(4)}°, {curLon.toFixed(4)}°</div>
                </>
              ) : <div>{theatreName} · {sc.aoi.sizeKm} km span · move cursor for coordinates</div>}
            </div>

            <div style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(6,10,15,.9)', border: '1px solid var(--line)', borderRadius: 2, padding: '5px 9px', fontSize: 10, color: 'var(--amb)' }}>
              T+{t.toFixed(1)}s
            </div>

            {flash && (
              <div className="fadein" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,10,15,.96)', border: '1px solid var(--amb)', color: 'var(--amb)', padding: '8px 15px', borderRadius: 2, fontSize: 10.5, whiteSpace: 'nowrap' }}>
                {flash}
              </div>
            )}
          </div>

          {/* bottom dock */}
          <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)', height: dockH, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div onMouseDown={(e) => {
              const y0 = e.clientY, h0 = dockH;
              const mv = (ev: MouseEvent) => setDockH(Math.max(150, Math.min(600, h0 - (ev.clientY - y0))));
              const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
              window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
            }} style={{ height: 5, cursor: 'ns-resize', background: 'transparent', marginTop: -3, flexShrink: 0 }} />
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
              {(['timeline', 'profile', 'log'] as const).map((x) => (
                <button key={x} onClick={() => { setBottom(x); if (x === 'profile' && dockH < 330) setDockH(360); }}
                  style={{ border: 'none', borderRadius: 0, background: 'transparent', padding: '7px 15px',
                    borderBottom: bottom === x ? '2px solid var(--amb)' : '2px solid transparent',
                    color: bottom === x ? 'var(--amb)' : 'var(--dim)' }}>
                  {x === 'timeline' ? 'Mission Timeline' : x === 'profile' ? 'Vertical Profile' : 'Event Log'}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 11, gap: 9, fontSize: 9, color: 'var(--dim2)' }}>
                <span>scroll = zoom</span><span>drag = pan</span><span>click entity = inspect</span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {bottom === 'timeline' && <Timeline sc={sc} sol={sol} t={t} tMax={tMax} onSeek={(v) => { setPlaying(false); setT(v); }} />}
              {bottom === 'profile' && <ProfileView sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} />}
              {bottom === 'log' && <EventLog sc={sc} sol={sol} t={t} />}
            </div>
          </div>
        </main>

        {/* ============ RIGHT: INSPECTOR ============ */}
        <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
            {(['inspect', 'plan'] as const).map((x) => (
              <button key={x} onClick={() => setPanel(x)}
                style={{ flex: 1, border: 'none', borderRadius: 0, background: 'transparent', padding: '8px 0',
                  borderBottom: panel === x ? '2px solid var(--amb)' : '2px solid transparent',
                  color: panel === x ? 'var(--amb)' : 'var(--dim)' }}>
                {x === 'inspect' ? 'Inspector' : 'Fire Plan'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {panel === 'inspect'
              ? <Inspector sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} />
              : <FirePlan />}
          </div>
        </aside>
      </div>
    </div>
  );

  function FirePlan() {
    if (!sc || !sol) return null;
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: 10 }}>
        <div className="lbl" style={{ marginBottom: 5 }}>Selected launch areas</div>
        <div style={{ border: '1px solid var(--amb)', background: 'rgba(255,176,32,.05)', borderRadius: 2, padding: 8, marginBottom: 11 }}>
          <div style={{ fontSize: 12, color: 'var(--amb)' }}>
            {sol.selectedAreaIds.map((id) => sc.areas.find((a) => a.id === id)?.name.replace('Site ', '')).join(' · ')}
          </div>
          <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 3 }}>
            {sol.selectedAreaIds.length} of {sol.consideredAreaIds.length} candidate areas ·{' '}
            {sol.certified ? 'minimality proven by exhaustive search' : 'heuristic (uncertified)'}
          </div>
        </div>
        {sc.threats.map((th) => {
          const r = sol.perThreat.find((p) => p.threatId === th.id)!;
          return (
            <div key={th.id} data-track={th.id} role="button" tabIndex={0}
              style={{ marginBottom: 8, paddingBottom: 7, borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
              onClick={() => { setSel({ kind: 'threat', id: th.id }); setPanel('inspect'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                <span style={{ color: r.leaker ? 'var(--red)' : 'var(--txt)' }}>
                  <ThreatSymbol cls={th.cls} size={10} /> {th.callsign}
                </span>
                <span style={{ color: r.leaker ? 'var(--red)' : 'var(--grn)' }}>
                  {r.leaker ? 'LEAKER' : `${(r.cumulativePk * 100).toFixed(0)}%`}
                </span>
              </div>
              {r.shots.map((s, i) => {
                const a = sc.areas.find((x) => x.id === s.areaId)!;
                return (
                  <div key={i} style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>
                    ↳ {a.name.replace('Site ', '')} · Pk {s.option.pk.toFixed(3)} ·{' '}
                    {(s.option.interceptAltM / 1000).toFixed(1)}km · T+{s.option.tIntercept.toFixed(0)}s
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }
}
