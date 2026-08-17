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

      {/* ================= HEADLINE =================
        * ONE hero number, not three competing at 26px. The result of the
        * optimisation — how many threats were stopped — is the single thing
        * a judge should read first, so it alone gets the hero size and a
        * status-coloured rule. Everything else steps down a level and sits
        * in a labelled group, so the row reads as a scoreboard rather than
        * a sentence of mixed-size fragments. */}
      <div style={{
        padding: 'var(--s4) var(--s5) var(--s3)',
        borderBottom: '1px solid var(--line)',
        background: 'linear-gradient(180deg, var(--panel2), var(--panel))',
      }} className="raised">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s5)', flexWrap: 'wrap' }}>

          {/* HERO — the outcome */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 'var(--s2)',
            paddingLeft: 'var(--s3)',
            borderLeft: `3px solid ${allStopped ? 'var(--burst)' : 'var(--threat)'}`,
          }}>
            <span className="tnum" style={{
              fontSize: 'var(--t-hero)', fontWeight: 700, lineHeight: 1,
              color: allStopped ? 'var(--burst)' : 'var(--threat)',
              letterSpacing: '-.02em',
            }}>
              <Num value={m.threatsEngaged} /><span style={{ color: 'var(--dim)', fontWeight: 400 }}>/{m.threatsTotal}</span>
            </span>
            <span style={{ fontSize: 'var(--t-small)', color: 'var(--txt2)', letterSpacing: '.04em' }}>
              {allStopped ? 'THREATS NEUTRALISED' : `ENGAGED · ${m.leakers} LEAKER${m.leakers > 1 ? 'S' : ''}`}
            </span>
          </div>

          {/* supporting statistics, visibly subordinate */}
          <HeroStat label="Sites used" v={`${sol.selectedAreaIds.length}`} sub={`of ${sc.areas.length}`} c="var(--intcp)" />
          <HeroStat label="Rounds" v={`${m.interceptorsUsed}`} sub="committed" c="var(--txt)" />
          <HeroStat label="Protection" v={`${(m.weightedProtection * 100).toFixed(0)}%`} sub="weighted" c="var(--burst)" />
          <HeroStat label="Solve time" v={`${m.solveMs}`} sub="ms" c="var(--amb)" />

          <Link href="/mission" style={{ marginLeft: 'auto' }}>
            <button className="on" style={{ padding: '11px 18px', fontSize: 'var(--t-small)' }}>
              Full mission detail →
            </button>
          </Link>
        </div>

        <div style={{
          fontSize: 'var(--t-micro)', color: 'var(--dim)', marginTop: 'var(--s3)',
          letterSpacing: '.05em', display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--dim2)' }}>DEFENDING</span>
          <span style={{ color: 'var(--txt2)' }}>{sc.assets.map((a) => a.name).join(' · ')}</span>
          <span style={{ color: 'var(--line2)' }}>│</span>
          <span style={{ color: 'var(--dim2)' }}>THEATRE</span>
          <span style={{ color: 'var(--txt2)' }}>{theatre?.name}</span>
          {sol.certified && (
            <>
              <span style={{ color: 'var(--line2)' }}>│</span>
              <span style={{ color: 'var(--burst)' }}>✓ MINIMAL SUBSET PROVEN BY EXHAUSTIVE SEARCH</span>
            </>
          )}
        </div>
      </div>

      <CompareBar mode={mode} onMode={setMode} results={results} busy={busy} />

      {/* ================= MAP ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '178px 1fr', minHeight: 0 }}>
        {/* Control rail. Widened from 150px so nothing has to be set at 8px
          * to fit; every control now sits at the 11px small size, which is
          * the smallest genuinely legible size on a projector. */}
        <aside style={{
          borderRight: '1px solid var(--line)', background: 'var(--panel)',
          padding: 'var(--s3)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 'var(--s4)',
        }}>
        <div>
          <div className="grouphead">Scenario</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s1)', marginTop: 'var(--s2)' }}>
            {(['easy', 'medium', 'hard'] as const).map((x) => (
              <button key={x} className={sc.tier === x ? 'on' : ''} style={{ padding: '6px 0' }}
                onClick={() => { load(x, 42, sc.theatreId); setSel(null); }}>{x}</button>
            ))}
            <button style={{ padding: '6px 0' }}
              onClick={() => { load('random', undefined, sc.theatreId); setSel(null); }}>rand</button>
          </div>
        </div>

        <div>
          <div className="grouphead">Simulation theatre</div>
          <div style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
            Click to switch scenario region
          </div>
          {/* 17 theatres would push every other control off the rail, so the
            * list scrolls inside a fixed height. The active one is scrolled
            * into view on change. */}
          <div style={{
            display: 'grid', gap: 2, marginTop: 'var(--s2)',
            maxHeight: 168, overflowY: 'auto', paddingRight: 2,
          }} className="fade-b">
            {THEATRES.map((th) => (
              <button key={th.id} className={sc.theatreId === th.id ? 'on' : ''}
                ref={sc.theatreId === th.id
                  ? (el) => el?.scrollIntoView({ block: 'nearest' })
                  : undefined}
                style={{ fontSize: 'var(--t-micro)', padding: '5px 7px', textAlign: 'left', lineHeight: 1.35 }}
                onClick={() => { load(sc.tier === 'random' ? 'medium' : sc.tier, 42, th.id); setSel(null); }}>
                {th.name.replace(/ (Sector|Seaboard|Corridor|Peninsula)/, '')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="grouphead">Playback</div>
          <div style={{ display: 'flex', gap: 'var(--s1)', marginTop: 'var(--s2)' }}>
            <button className={playing ? 'on' : ''} style={{ flex: 1 }} onClick={() => setPlaying(!playing)}>
              {playing ? '❚❚ Hold' : '▶ Run'}
            </button>
            <button title="Restart from T+0"
              onClick={() => { setT(0); setPlaying(false); setDismissed(false); }}>↺</button>
          </div>
          <button style={{ width: '100%', marginTop: 'var(--s1)', fontSize: 'var(--t-micro)' }}
            onClick={jumpToFirstEngagement} title="Skip to the first launch">
            ⏭ Jump to first engagement
          </button>
          <div style={{ display: 'flex', gap: 2, marginTop: 'var(--s1)' }}>
            {[1, 4, 10, 25].map((r) => (
              <button key={r} className={rate === r ? 'on' : ''}
                style={{ flex: 1, padding: '4px 0', fontSize: 'var(--t-micro)' }}
                onClick={() => setRate(r)}>{r}×</button>
            ))}
          </div>
          {/* --pct drives the amber fill on the restyled track */}
          <input type="range" min={0} max={tMax} step={0.5} value={Math.min(t, tMax)}
            onChange={(e) => { setPlaying(false); setT(+e.target.value); }}
            style={{ width: '100%', marginTop: 'var(--s2)',
              ['--pct' as string]: `${(Math.min(t, tMax) / (tMax || 1)) * 100}%` }} />
          <div style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)', textAlign: 'center' }}>
            T+{t.toFixed(0)}s
          </div>
        </div>

        <div>
          <div className="grouphead">Threat volume</div>
          <input type="range" min={2} max={14} step={1} value={sc.threats.length}
            onChange={(e) => load(sc.tier === 'random' ? 'medium' : sc.tier, 42, sc.theatreId, +e.target.value)}
            style={{ width: '100%', marginTop: 'var(--s2)',
              ['--pct' as string]: `${((sc.threats.length - 2) / 12) * 100}%` }} />
          <div style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)', textAlign: 'center' }}>
            {sc.threats.length} inbound · {(m.weightedProtection * 100).toFixed(0)}% held
          </div>
        </div>

        <div>
          <div className="grouphead">Map layers</div>
          <div style={{ display: 'grid', gap: 2, marginTop: 'var(--s2)' }}>
            {LAYERS.map(([k, l]) => (
              <button key={k} className={layers[k] ? 'on' : ''}
                style={{ width: '100%', textAlign: 'left', fontSize: 'var(--t-micro)', padding: '4px 7px' }}
                onClick={() => setLayers((v) => ({ ...v, [k]: !v[k] }))}>
                {layers[k] ? '✓' : '·'} {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="grouphead">Battery status</div>
          <button className={addMode ? 'on' : ''}
            style={{ width: '100%', marginTop: 'var(--s2)', fontSize: 'var(--t-micro)' }}
            onClick={() => setAddMode(!addMode)}>
            {addMode ? '◉ Click map…' : '+ Inject threat'}
          </button>
          {sc.areas.map((a) => {
            const st = statusOf(a.id);
            return (
              <div key={a.id} style={{ display: 'flex', gap: 'var(--s1)', marginTop: 3 }}>
                <div style={{
                  flex: 1, fontSize: 'var(--t-micro)', padding: '5px 7px', lineHeight: 1.5,
                  background: 'var(--panel2)',
                  border: '1px solid var(--line)', borderRadius: 'var(--r)',
                  borderLeft: `2px solid ${st ? STATE_COLOUR[st.state] : 'var(--line2)'}`,
                  minWidth: 0,
                }}>
                  <div style={{ color: 'var(--txt2)', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ color: st ? STATE_COLOUR[st.state] : 'var(--dim2)' }}>
                    {st?.state}{st?.countdownS != null && st.countdownS <= 30
                      ? ` ${st.countdownS.toFixed(0)}s` : ''} · {st?.roundsLeft ?? a.inventory} rds
                  </div>
                </div>
                <button className={!a.active ? 'danger on' : ''}
                  style={{ fontSize: 'var(--t-micro)', padding: '3px 6px' }}
                  onClick={() => toggleSite(a.id)}>{a.active ? '✕' : '↑'}</button>
              </div>
            );
          })}
        </div>
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
            <div className="fadein" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,10,15,.96)', border: '1px solid var(--amb)', color: 'var(--amb)', padding: '8px 15px', borderRadius: 'var(--r)', fontSize: 'var(--t-small)', whiteSpace: 'nowrap' }}>
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

/** Supporting statistic in the headline row — deliberately one full step
 *  below the hero number so the hierarchy is unambiguous. */
function HeroStat({ label, v, sub, c }:
  { label: string; v: string; sub: string; c: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="lbl" style={{ fontSize: 'var(--t-micro)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="tnum" style={{ fontSize: 'var(--t-stat)', fontWeight: 600, color: c, lineHeight: 1 }}>{v}</span>
        <span style={{ fontSize: 'var(--t-micro)', color: 'var(--dim)' }}>{sub}</span>
      </span>
    </div>
  );
}

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
        <div style={{ fontSize: 'var(--t-small)', color: col, letterSpacing: '.07em' }}>
          {n}. {title.toUpperCase()}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
}
