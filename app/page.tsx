'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import GeoMap, { type Sel } from '@/components/GeoMap';
import Nav from '@/components/Nav';
import { Num, Pill } from '@/components/ui';
import { MapLegend, COL, ShieldIcon, BurstIcon, ThreatChip } from '@/components/symbols';
import { useMission } from '@/lib/store';
import { THEATRES } from '@/lib/theatre';
import { dms } from '@/lib/format';

export default function Overview() {
  const {
    sc, sol, t, setT, tMax, playing, setPlaying, rate, setRate,
    load, addThreat, toggleSite, flash,
  } = useMission();
  const [sel, setSel] = useState<Sel>(null);
  const [addMode, setAddMode] = useState(false);
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [layers] = useState<Record<string, boolean>>({
    tracks: true, predict: true, engage: true, rings: true,
    origins: true, altticks: true, grid: true, places: true, labels: true,
  });

  if (!sc || !sol) return <div style={{ padding: 30, color: 'var(--dim)' }}>INITIALISING…</div>;

  const m = sol.metrics;
  const theatre = THEATRES.find((x) => x.id === sc.theatreId);
  const allStopped = m.leakers === 0;

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr auto', height: '100vh', overflow: 'hidden' }}>
      <Nav right={
        <>
          <Pill label={playing ? 'SIM RUNNING' : 'SIM HOLD'} state={playing ? 'ok' : 'idle'} />
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

          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Theatre</div>
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
            <button style={{ fontSize: 9 }} onClick={() => { setT(0); setPlaying(false); }}>↺</button>
          </div>
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

          <div className="lbl" style={{ marginTop: 11, opacity: .75 }}>Judge controls</div>
          <button className={addMode ? 'on' : ''} style={{ width: '100%', marginTop: 4, fontSize: 8.5 }}
            onClick={() => setAddMode(!addMode)}>
            {addMode ? '◉ Click map…' : '+ Inject threat'}
          </button>
          {sc.areas.map((a) => (
            <button key={a.id} className={!a.active ? 'danger on' : ''}
              style={{ width: '100%', marginTop: 2, fontSize: 8, textAlign: 'left', padding: '3px 5px' }}
              onClick={() => toggleSite(a.id)}>
              {a.active ? '✕ kill ' : '↻ up '}{a.name.split(' ')[0]}
            </button>
          ))}
        </aside>

        <main style={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
          <GeoMap sc={sc} sol={sol} t={t} sel={sel} onSel={setSel} addMode={addMode}
            onMapClick={(lat, lon) => { addThreat(lat, lon); setAddMode(false); }}
            layers={layers} onCursor={setCursor} />

          {/* persistent legend — always visible */}
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <MapLegend />
          </div>

          <div style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(6,10,15,.92)', border: '1px solid var(--line)', borderRadius: 2, padding: '4px 8px', fontSize: 9, color: 'var(--dim)', pointerEvents: 'none' }}>
            {cursor ? `${dms(cursor.lat, true)}  ${dms(cursor.lon, false)}` : 'scroll to zoom · drag to pan · click any icon to inspect'}
          </div>
          <div style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(6,10,15,.9)', border: '1px solid var(--line)', borderRadius: 2, padding: '4px 8px', fontSize: 10, color: 'var(--amb)' }}>
            T+{t.toFixed(1)}s
          </div>

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
