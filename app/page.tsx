'use client';
// InterceptIQ
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import GeoMap, { type Sel } from '@/components/GeoMap';
import Nav from '@/components/Nav';
import { Num, Pill } from '@/components/ui';
import { MapLegend, COL, ShieldIcon, BurstIcon, ThreatChip } from '@/components/symbols';
import { useMission } from '@/lib/store';
import { THEATRES } from '@/lib/theatre';
import { dms } from '@/lib/format';
import { batteryStatuses, airspaceViolated, networkAlert, STATE_COLOUR } from '@/lib/alert';
import CompareBar from '@/components/CompareBar';
import MissionSummary from '@/components/MissionSummary';
import CinematicIntro from '@/components/CinematicIntro';

/* Layer list, ordered by how often an operator actually toggles it. The
 * cartographic decoration (cities, graticule, altitude ticks) is off by
 * default: state boundaries alone are enough to locate anything on an Indian
 * map, and every city label was one more thing competing with the
 * interceptors and threat symbols for attention. */
const LAYERS = [
  ['engage', 'Interceptors'], ['tracks', 'Threat tracks'], ['predict', 'Predicted path'],
  ['rings', 'Range rings'], ['origins', 'Launch points'],
  ['states', 'State boundaries'], ['labels', 'Country names'],
  ['places', 'City names'], ['grid', 'Graticule'], ['altticks', 'Altitude ticks'],
] as const;

export default function Overview() {
  const {
    sc, sol, t, setT, tMax, playing, setPlaying, rate, setRate,
    load, addThreat, toggleSite, flash,
    mode, setMode, results, busy, audio, setAudio, jumpToFirstEngagement,
  } = useMission();
  const [showSummary, setShowSummary] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  /* Cinematic intro runs once per session. sessionStorage rather than a plain
   * flag so a reload during a demo does not force the operator to sit through
   * it again, while a fresh tab still gets the full sequence. */
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem('iq_intro_seen')) setIntro(true);
  }, []);
  const endIntro = useCallback(() => {
    sessionStorage.setItem('iq_intro_seen', '1');
    setIntro(false);
  }, []);
  const [sel, setSel] = useState<Sel>(null);
  const [addMode, setAddMode] = useState(false);
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    tracks: true, predict: true, engage: true,
    /* Range rings OFF by default — one envelope per battery at once was the
     * single largest source of visual noise. Hover or click a site to see
     * just that one, or use the SHOW RANGE RINGS toggle over the map. */
    rings: false,
    origins: true, states: true, labels: true,
    // decoration — off by default so the engagement reads cleanly
    altticks: false, grid: false, places: false,
  });

  if (!sc || !sol) return <div style={{ padding: 30, color: 'var(--dim)' }}>INITIALISING…</div>;

  const m = sol.metrics;
  const theatre = THEATRES.find((x) => x.id === sc.theatreId);
  const allStopped = m.leakers === 0;
  const statuses = batteryStatuses(sc, sol, t);
  const lastImpact = Math.max(...sc.threats.map((x) => x.impact.t));
  const violators = airspaceViolated(sc, t);
  const netAlert = networkAlert(statuses);
  const statusOf = (id: string) => statuses.find((x) => x.areaId === id);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', height: '100vh', overflow: 'hidden' }}>
      {intro && <CinematicIntro onDone={endIntro} />}
      <Nav right={
        <>
          <button onClick={() => setIntro(true)} title="Replay the cinematic intro"
            style={{ padding: '5px 9px' }}>▶ INTRO</button>
          <button onClick={() => setAudio(!audio)}
            title={audio ? 'Mute audio cues' : 'Enable audio cues'}
            style={{ padding: '5px 9px' }} className={audio ? 'on' : ''}>
            {audio ? '♪ SFX ON' : '♪ SFX OFF'}
          </button>
          {/* TWO pills, not three. The network-alert state is already shown
            * by the battery colours, their readiness rings and the airspace
            * banner, so a third pill competed for attention without adding
            * information. The two kept are the ones a judge needs: is it
            * running, and is the answer proven optimal.
            * AD state is retained as a tooltip on the SIM pill. */}
          <span title={`Air-defence network state: ${netAlert}`} style={{ display: 'flex' }}>
            <Pill label={playing ? 'SIM RUNNING' : 'SIM HOLD'} state={playing ? 'ok' : 'idle'} />
          </span>
          <Pill label={sol.certified ? 'MINIMAL: PROVEN' : 'MINIMAL: HEURISTIC'} state={sol.certified ? 'ok' : 'warn'} />
        </>
      } />

      {/* ================= HEADLINE ================= */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--intcp)', letterSpacing: '-.01em' }}>
            <Num value={sol.selectedAreaIds.length} /> of {sc.areas.length}
          </span>
          <span style={{ fontSize: 15, color: 'var(--dim)' }}>interceptor sites selected</span>
          <Dot />
          <span style={{ fontSize: 26, fontWeight: 700, color: allStopped ? 'var(--burst)' : 'var(--threat)' }}>
            {allStopped ? 'all ' : ''}<Num value={m.threatsEngaged} /> of {m.threatsTotal}
          </span>
          <span style={{ fontSize: 15, color: 'var(--dim)' }}>
            threats {allStopped ? 'neutralised' : `engaged · ${m.leakers} leaker${m.leakers > 1 ? 's' : ''}`}
          </span>
          <Dot />
          <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--amb)' }}>
            <Num value={m.solveMs} suffix="ms" />
          </span>
          <span style={{ fontSize: 15, color: 'var(--dim)' }}>to solve</span>

          <Link href="/mission" style={{ marginLeft: 'auto' }}>
            <button className="on" style={{ padding: '10px 16px', fontSize: 11 }}>
              View Full Mission Detail →
            </button>
          </Link>
        </div>
        <div style={{ fontSize: 10, color: 'var(--dim2)', marginTop: 6 }}>
          Defending {sc.assets.map((a) => a.name).join(', ')} · {theatre?.name} ·{' '}
          {m.interceptorsUsed} interceptors committed · {(m.weightedProtection * 100).toFixed(1)}% weighted protection
          {sol.certified && ' · minimal site subset proven by exhaustive search'}
        </div>
      </div>

      <CompareBar mode={mode} onMode={setMode} results={results} busy={busy} />

      {/* ================= MAP ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', minHeight: 0 }}>
        {/* slim, de-emphasised controls */}
        <aside style={{ borderRight: '1px solid var(--line)', background: 'var(--panel)', padding: 9, overflowY: 'auto' }}>
          <div className="lbl" style={{ opacity: .75 }}>Scenario</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 4 }}>
            {(['easy', 'medium', 'hard'] as const).map((x) => (
              <button key={x} className={sc.tier === x ? 'on' : ''} style={{ fontSize: 9, padding: '5px 0' }}
                onClick={() => { load(x, 42, sc.theatreId); setSel(null); }}>{x}</button>
            ))}
            <button style={{ fontSize: 9, padding: '5px 0' }}
              onClick={() => { load('random', undefined, sc.theatreId); setSel(null); }}>rand</button>
          </div>

          {/* The theatre list previously had a one-word label, which did not
            * tell a first-time viewer that these rows are clickable region
            * selectors rather than a static legend. */}
          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Simulation theatre</div>
          <div style={{ fontSize: 8, color: 'var(--dim2)', marginTop: 1, lineHeight: 1.4 }}>
            Click to switch scenario region
          </div>
          <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
            {THEATRES.map((th) => (
              <button key={th.id} className={sc.theatreId === th.id ? 'on' : ''}
                style={{ fontSize: 8.5, padding: '4px 5px', textAlign: 'left' }}
                onClick={() => { load(sc.tier === 'random' ? 'medium' : sc.tier, 42, th.id); setSel(null); }}>
                {th.name.replace(/ (Sector|Seaboard|Corridor|Peninsula)/, '')}
              </button>
            ))}
          </div>

          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Playback</div>
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            <button className={playing ? 'on' : ''} style={{ flex: 1, fontSize: 9 }} onClick={() => setPlaying(!playing)}>
              {playing ? '❚❚' : '▶'} {playing ? 'Hold' : 'Run'}
            </button>
            <button style={{ fontSize: 9 }} onClick={() => { setT(0); setPlaying(false); setDismissed(false); }}>↺</button>
          </div>
          <button style={{ width: '100%', marginTop: 3, fontSize: 8.5 }}
            onClick={jumpToFirstEngagement} title="Skip to the first launch">
            ⏭ Jump to first engagement
          </button>
          <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
            {[1, 4, 10, 25].map((r) => (
              <button key={r} className={rate === r ? 'on' : ''} style={{ flex: 1, padding: '4px 0', fontSize: 8.5 }}
                onClick={() => setRate(r)}>{r}×</button>
            ))}
          </div>
          <input type="range" min={0} max={tMax} step={0.5} value={Math.min(t, tMax)}
            onChange={(e) => { setPlaying(false); setT(+e.target.value); }}
            style={{ width: '100%', marginTop: 7 }} />
          <div style={{ fontSize: 9, color: 'var(--dim2)', textAlign: 'center' }}>T+{t.toFixed(0)}s</div>

          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Threat volume</div>
          <input type="range" min={2} max={14} step={1} value={sc.threats.length}
            onChange={(e) => load(sc.tier === 'random' ? 'medium' : sc.tier, 42, sc.theatreId, +e.target.value)}
            style={{ width: '100%', marginTop: 4 }} />
          <div style={{ fontSize: 8, color: 'var(--dim2)', textAlign: 'center' }}>
            {sc.threats.length} inbound · {(m.weightedProtection * 100).toFixed(0)}% held
          </div>

          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Map layers</div>
          {LAYERS.map(([k, l]) => (
            <button key={k} className={layers[k] ? 'on' : ''}
              style={{ width: '100%', marginTop: 2, textAlign: 'left', fontSize: 8, padding: '3px 5px' }}
              onClick={() => setLayers((v) => ({ ...v, [k]: !v[k] }))}>
              {layers[k] ? '✓' : '·'} {l}
            </button>
          ))}

          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Battery status</div>
          <button className={addMode ? 'on' : ''} style={{ width: '100%', marginTop: 4, fontSize: 8.5 }}
            onClick={() => setAddMode(!addMode)}>
            {addMode ? '◉ Click map…' : '+ Inject threat'}
          </button>
          {sc.areas.map((a) => {
            const st = statusOf(a.id);
            return (
              <div key={a.id} style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                <div style={{
                  flex: 1, fontSize: 8, padding: '3px 5px', lineHeight: 1.3,
                  border: '1px solid var(--line)', borderRadius: 2,
                  borderLeft: `2px solid ${st ? STATE_COLOUR[st.state] : 'var(--line)'}`,
                }}>
                  <div style={{ color: 'var(--txt)' }}>{a.name}</div>
                  <div style={{ color: st ? STATE_COLOUR[st.state] : 'var(--dim2)' }}>
                    {st?.state}{st?.countdownS != null && st.countdownS <= 30
                      ? ` ${st.countdownS.toFixed(0)}s` : ''} · {st?.roundsLeft ?? a.inventory} rds
                  </div>
                </div>
                <button className={!a.active ? 'danger on' : ''}
                  style={{ fontSize: 7.5, padding: '3px 4px' }}
                  onClick={() => toggleSite(a.id)}>{a.active ? 'KILL' : 'UP'}</button>
              </div>
            );
          })}
        </aside>

        <main style={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
          <GeoMap sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} addMode={addMode}
            onMapClick={(lat, lon) => { addThreat(lat, lon); setAddMode(false); }}
            layers={layers} onCursor={setCursor} fx playing={playing} />

          {/* persistent legend — always visible */}
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <MapLegend />
          </div>

          {/* airspace violation banner — appears the moment a track crosses */}
          {/* Moved OUT of the centre of the map. Centred at top it sat
            * directly over the northern cluster (Srinagar / Leh / Pathankot)
            * and hid exactly the tracks it was announcing. It is now a
            * compact card stacked directly BELOW the persistent legend in
            * the top-left gutter, clear of the T+ clock and ring toggle on
            * the right, and pointer-transparent so it can never intercept a
            * click meant for an icon underneath. */}
          {violators.length > 0 && (
            <div className="fadein" style={{
              position: 'absolute', top: 42, left: 10, maxWidth: 250,
              background: 'rgba(24,8,12,.95)', border: '1px solid var(--threat)',
              borderRadius: 3, padding: '5px 10px',
              display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none',
            }}>
              <span className="pulse" style={{
                width: 7, height: 7, borderRadius: '50%', background: 'var(--threat)',
                flexShrink: 0,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--threat)', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>
                  AIRSPACE VIOLATION · {violators.length}
                </div>
                <div style={{
                  fontSize: 9, color: 'var(--dim)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {violators.map((v) => v.callsign).join(' · ')}
                </div>
              </div>
            </div>
          )}

          <div style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(6,10,15,.92)', border: '1px solid var(--line)', borderRadius: 2, padding: '4px 8px', fontSize: 9, color: 'var(--dim)', pointerEvents: 'none' }}>
            {cursor ? `${dms(cursor.lat, true)}  ${dms(cursor.lon, false)}` : 'scroll to zoom · drag to pan · click any icon to inspect'}
          </div>
          {/* On-demand coverage: rings are hidden by default, and the
            * presenter turns them all on only when explaining coverage area.
            * Hovering a single site still reveals just that one ring. */}
          <button
            onClick={() => setLayers((v) => ({ ...v, rings: !v.rings }))}
            title="Show every battery's engagement envelope at once"
            className={layers.rings ? 'on' : ''}
            style={{
              position: 'absolute', right: 10, top: 38, fontSize: 9,
              padding: '4px 9px', letterSpacing: '.06em',
            }}>
            {layers.rings ? '◉' : '○'} SHOW RANGE RINGS
          </button>
          <div style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(6,10,15,.9)', border: '1px solid var(--line)', borderRadius: 2, padding: '4px 8px', fontSize: 10, color: 'var(--amb)' }}>
            T+{t.toFixed(1)}s
          </div>

          {(showSummary || (t >= lastImpact && !dismissed && !playing)) && sol && (
            <MissionSummary sc={sc} sol={sol} results={results}
              onReplay={() => { setShowSummary(false); setDismissed(true); setT(0); setPlaying(true); }}
              onClose={() => { setShowSummary(false); setDismissed(true); }} />
          )}
          {flash && (
            <div className="fadein" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,10,15,.96)', border: '1px solid var(--amb)', color: 'var(--amb)', padding: '8px 15px', borderRadius: 2, fontSize: 10.5, whiteSpace: 'nowrap' }}>
              {flash}
            </div>
          )}
        </main>
      </div>

      {/* ================= HOW THIS WORKS ================= */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
        <Step n={1} title="Threats detected"
          body={`${m.threatsTotal} inbound tracks acquired and classified, each projected onto the protected asset it would strike.`}
          icon={<ThreatChip size={17} />} col={COL.threat} />
        <Arrow />
        <Step n={2} title="Optimal sites selected"
          body={`Hungarian assignment over every site–threat pair, then an exhaustive search for the smallest sufficient subset — ${sol.selectedAreaIds.length} of ${sc.areas.length} sites.`}
          icon={<svg width="17" height="17" viewBox="-11 -12 22 22"><rect x="-6" y="-4.5" width="12" height="9" fill="none" stroke={COL.intcp} strokeWidth="1.6" /><path d="M-6,-4.5 L0,-10.5 L6,-4.5" fill="none" stroke={COL.intcp} strokeWidth="1.6" /></svg>}
          col={COL.intcp} />
        <Arrow />
        <Step n={3} title={allStopped ? 'Threats intercepted' : 'Threats engaged'}
          body={allStopped
            ? `All ${m.threatsTotal} destroyed in flight before reaching any protected asset. Mean single-shot Pk ${m.meanPk.toFixed(2)}.`
            : `${m.threatsEngaged} engaged, ${m.leakers} leaker(s) — no battery can reach them in time.`}
          icon={<svg width="17" height="17" viewBox="-13 -13 26 26"><BurstIcon s={0.9} animate={false} /></svg>}
          col={allStopped ? COL.burst : COL.threat} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderLeft: '1px solid var(--line)' }}>
          <svg width="19" height="19" viewBox="-13 -14 26 30"><ShieldIcon s={0.95} /></svg>
          <div style={{ marginLeft: 9 }}>
            <div style={{ fontSize: 9, color: 'var(--asset)', letterSpacing: '.06em' }}>PROTECTED</div>
            <div style={{ fontSize: 10, color: 'var(--txt)' }}>
              {(sc.assets.reduce((a, x) => a + x.population, 0) / 1e6).toFixed(1)}M people
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Dot = () => <span style={{ color: 'var(--line2)', fontSize: 18 }}>·</span>;

function Arrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--line2)', fontSize: 17, padding: '0 2px' }}>→</div>
  );
}

function Step({ n, title, body, icon, col }: { n: number; title: string; body: string; icon: React.ReactNode; col: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', gap: 10, padding: '11px 14px', minWidth: 0 }}>
      <div style={{ flexShrink: 0, paddingTop: 1 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: col, letterSpacing: '.05em' }}>
          {n}. {title.toUpperCase()}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
}
