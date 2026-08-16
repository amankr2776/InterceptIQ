'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import IndiaMap, { type NatSel } from '@/components/IndiaMap';
import { Num, Stat, Pill, Bar } from '@/components/ui';
import { buildNationalLaydown, sectorStats, type NationalBattery } from '@/lib/national';
import { SECTORS, THEATRES } from '@/lib/theatre';
import { INTERCEPTORS } from '@/lib/systems';
import { dms } from '@/lib/format';
import { useMission } from '@/lib/store';
import Nav from '@/components/Nav';

const LAYER_TOGGLES = [
  ['envelopes', 'Engagement envelopes'],
  ['radar', 'Radar coverage'],
  ['grid', 'Graticule'],
  ['labels', 'Country names'],
] as const;

const layerCol = (l: NationalBattery['layer']) =>
  l === 'BMD' ? 'var(--vio)' : l === 'Long-range' ? 'var(--amb)'
  : l === 'Medium-range' ? 'var(--grn)' : 'var(--cy)';

export default function National() {
  const base = useMemo(() => buildNationalLaydown(), []);
  const [dead, setDead] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<NatSel>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    envelopes: true, radar: true, grid: true, labels: true,
  });
  const { load } = useMission();

  const lay = useMemo(() => ({
    radars: base.radars,
    batteries: base.batteries.map((b) => ({ ...b, active: !dead.has(b.id) })),
  }), [base, dead]);

  const nat = useMemo(() => {
    const act = lay.batteries.filter((b) => b.active);
    return {
      batteries: lay.batteries.length,
      active: act.length,
      offline: lay.batteries.length - act.length,
      rounds: act.reduce((a, b) => a + b.rounds, 0),
      radars: lay.radars.length,
      sectors: SECTORS.length,
      pop: SECTORS.reduce((a, s) => a + s.pop, 0),
      types: new Set(act.map((b) => b.systemId)).size,
    };
  }, [lay]);

  const selSectorId =
    sel?.kind === 'sector' ? sel.id
    : sel?.kind === 'battery' ? lay.batteries.find((b) => b.id === sel.id)?.sectorId ?? null
    : sel?.kind === 'radar' ? lay.radars.find((r) => r.id === sel.id)?.sectorId ?? null
    : null;

  const toggleDead = (id: string) =>
    setDead((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', height: '100vh', overflow: 'hidden' }}>
      <Nav right={
        <>
          <Pill label="NETWORK: LINKED" state="ok" />
          <Pill label={nat.offline ? `${nat.offline} BTY DOWN` : 'ALL BTY UP'} state={nat.offline ? 'crit' : 'ok'} />
        </>
      } />

      {/* ---------- STATS ---------- */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '7px 13px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
          <Stat label="Sectors"><Num value={nat.sectors} /></Stat>
          <Stat label="Batteries" c="var(--amb)"><Num value={nat.active} />/{nat.batteries}</Stat>
          <Stat label="Offline" c={nat.offline ? 'var(--red)' : 'var(--dim2)'}><Num value={nat.offline} /></Stat>
          <Stat label="Rounds ready"><Num value={nat.rounds} /></Stat>
          <Stat label="Radars" c="var(--vio)"><Num value={nat.radars} /></Stat>
          <Stat label="System types" c="var(--grn)"><Num value={nat.types} /></Stat>
          <Stat label="Population covered" c="var(--cy)"><Num value={nat.pop / 1e6} decimals={1} suffix="M" /></Stat>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '186px 1fr 320px', minHeight: 0 }}>
        {/* ---------- LEFT: SECTOR LIST ---------- */}
        <aside style={{ borderRight: '1px solid var(--line)', overflowY: 'auto', padding: 9, background: 'var(--panel)' }}>
          <div className="lbl">Defended Sectors</div>
          <div style={{ fontSize: 8.5, color: 'var(--dim2)', margin: '4px 0 6px', lineHeight: 1.5 }}>
            Click a sector on the map or here to inspect its air-defence laydown.
          </div>
          {SECTORS.map((s) => {
            const st = sectorStats(lay, s.id);
            const on = selSectorId === s.id;
            return (
              <button key={s.id}
                onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
                onClick={() => setSel({ kind: 'sector', id: s.id })}
                className={on ? 'on' : ''}
                style={{ width: '100%', textAlign: 'left', marginBottom: 3, padding: '6px 7px', lineHeight: 1.35 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10 }}>{s.name}</span>
                  <span style={{ fontSize: 8, color: st.offline ? 'var(--red)' : 'var(--dim2)' }}>
                    {st.batteries - st.offline}/{st.batteries}
                  </span>
                </div>
                <div style={{ fontSize: 7.5, color: 'var(--dim2)', textTransform: 'none', letterSpacing: 0 }}>
                  {st.maxRangeKm} km · {(st.maxAltM / 1000).toFixed(0)} km alt · {st.rounds} rds
                </div>
              </button>
            );
          })}

          <div className="lbl" style={{ marginTop: 12 }}>Layers</div>
          {LAYER_TOGGLES.map(([k, l]) => (
            <button key={k} className={layers[k] ? 'on' : ''}
              style={{ width: '100%', marginTop: 3, textAlign: 'left', fontSize: 9, padding: '4px 6px' }}
              onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
              {layers[k] ? '✓' : '·'} {l}
            </button>
          ))}

          <div className="lbl" style={{ marginTop: 12 }}>Defence Layers</div>
          {(['BMD', 'Long-range', 'Medium-range', 'Point defence'] as const).map((l) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 8.5, color: 'var(--dim)' }}>
              <span style={{ width: 9, height: 9, border: `1.5px solid ${layerCol(l)}`, display: 'inline-block' }} />
              {l}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 8.5, color: 'var(--dim)' }}>
            <svg width="11" height="11" viewBox="-8 -8 16 16"><path d="M-6,5 L0,-7 L6,5 Z M-9,5 h18" fill="none" stroke="var(--vio)" strokeWidth="1.6" /></svg>
            Radar
          </div>

          <div className="lbl" style={{ marginTop: 12 }}>Inventory</div>
          {INTERCEPTORS.map((sp) => {
            const n = lay.batteries.filter((b) => b.systemId === sp.id && b.active).length;
            if (!n) return null;
            return (
              <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', padding: '1.5px 0' }}>
                <span>{sp.name}</span><span style={{ color: 'var(--txt)' }}>×{n}</span>
              </div>
            );
          })}
        </aside>

        {/* ---------- MAP ---------- */}
        <main style={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
          <IndiaMap lay={lay} sel={sel} onSel={setSel} hover={hover} onHover={setHover}
            layers={layers} onCursor={setCursor} />
          <div style={{ position: 'absolute', left: 10, bottom: 10, background: 'rgba(6,10,15,.92)', border: '1px solid var(--line)', borderRadius: 2, padding: '5px 9px', fontSize: 9.5, color: 'var(--dim)', pointerEvents: 'none' }}>
            {cursor ? (
              <>
                <div style={{ color: 'var(--txt)' }}>{dms(cursor.lat, true)}  {dms(cursor.lon, false)}</div>
                <div>{cursor.lat.toFixed(4)}°, {cursor.lon.toFixed(4)}°</div>
              </>
            ) : <div>Republic of India — national air-defence overview · scroll to zoom, drag to pan</div>}
          </div>
        </main>

        {/* ---------- RIGHT: DETAIL ---------- */}
        <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', overflowY: 'auto' }}>
          <Detail />
        </aside>
      </div>
    </div>
  );

  function Detail() {
    if (!sel) {
      return (
        <div style={{ padding: 14 }}>
          <div className="lbl" style={{ marginBottom: 7 }}>National Overview</div>
          <div style={{ fontSize: 10.5, color: 'var(--dim)', lineHeight: 1.7 }}>
            Select a <b style={{ color: 'var(--cy)' }}>defended sector</b>, an{' '}
            <b style={{ color: 'var(--amb)' }}>interceptor battery</b> or a{' '}
            <b style={{ color: 'var(--vio)' }}>radar</b> on the map to see its full specification,
            location and coverage.
          </div>
          <div className="lbl" style={{ marginTop: 15, marginBottom: 6 }}>Force disposition</div>
          {(['BMD', 'Long-range', 'Medium-range', 'Point defence'] as const).map((l) => {
            const n = lay.batteries.filter((b) => b.layer === l && b.active).length;
            return (
              <div key={l} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginBottom: 2 }}>
                  <span style={{ color: layerCol(l) }}>{l}</span>
                  <span style={{ color: 'var(--txt)' }}>{n} batteries</span>
                </div>
                <Bar v={n} max={lay.batteries.length} c={layerCol(l)} h={4} />
              </div>
            );
          })}
          <div className="lbl" style={{ marginTop: 15, marginBottom: 6 }}>Note</div>
          <div style={{ fontSize: 9, color: 'var(--dim2)', lineHeight: 1.6 }}>
            System types and their specifications are real and sourced from public
            open-source reporting. Every battery position, radar site and unit designator
            shown here is <b style={{ color: 'var(--dim)' }}>fictional</b> — no real
            installation is represented.
          </div>
        </div>
      );
    }

    /* ---- SECTOR ---- */
    if (sel.kind === 'sector') {
      const s = SECTORS.find((x) => x.id === sel.id)!;
      const st = sectorStats(lay, s.id);
      const bats = lay.batteries.filter((b) => b.sectorId === s.id);
      const rads = lay.radars.filter((r) => r.sectorId === s.id);
      const th = THEATRES.find((t) => t.sectors.includes(s.id));
      return (
        <Wrap title={s.name} tag={s.id} sub="DEFENDED SECTOR" col="var(--cy)">
          <Grp title="Location & Value">
            <KV k="Latitude" v={dms(s.lat, true)} />
            <KV k="Longitude" v={dms(s.lon, false)} />
            <KV k="Decimal" v={`${s.lat.toFixed(4)}°, ${s.lon.toFixed(4)}°`} />
            <KV k="Population" v={s.pop.toLocaleString()} c="var(--cy)" />
            <KV k="Designation" v={s.kind} />
            <KV k="Defended radius" v={`${s.radiusKm} km`} />
            <KV k="Asset value" v={`${s.value} / 10`} c="var(--cy)" />
          </Grp>
          <Grp title="Coverage">
            <KV k="Batteries" v={`${st.batteries - st.offline} active / ${st.batteries}`} c={st.offline ? 'var(--red)' : 'var(--grn)'} />
            <KV k="Rounds at readiness" v={`${st.rounds}`} />
            <KV k="Max engagement range" v={`${st.maxRangeKm} km`} c="var(--amb)" />
            <KV k="Max engagement altitude" v={`${(st.maxAltM / 1000).toFixed(0)} km`} />
            <KV k="Radar detection" v={`${st.radarKm} km`} c="var(--vio)" />
            <KV k="Layers present" v={st.layers.join(', ') || '—'} />
          </Grp>
          <Grp title={`Batteries (${bats.length})`}>
            {bats.map((b) => (
              <div key={b.id} onClick={() => setSel({ kind: 'battery', id: b.id })}
                style={{ cursor: 'pointer', border: '1px solid var(--line)', borderRadius: 2, padding: '5px 6px', marginBottom: 4, opacity: b.active ? 1 : .5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: layerCol(b.layer) }}>{b.spec.name} {b.unit}</span>
                  <span style={{ color: b.active ? 'var(--dim)' : 'var(--red)', fontSize: 8.5 }}>
                    {b.active ? `${b.rounds} RDY` : 'OFFLINE'}
                  </span>
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 2 }}>
                  {b.layer} · {b.spec.rangeKm[1]} km · Mach {b.spec.mach} · {b.standoffKm} km @ {b.bearingFromSector}°
                </div>
              </div>
            ))}
          </Grp>
          <Grp title={`Radar (${rads.length})`}>
            {rads.map((r) => (
              <div key={r.id} onClick={() => setSel({ kind: 'radar', id: r.id })}
                style={{ cursor: 'pointer', fontSize: 9.5, color: 'var(--dim)', padding: '3px 0' }}>
                <span style={{ color: 'var(--vio)' }}>{r.type}</span> · {r.detectKm} km · {r.band}
              </div>
            ))}
          </Grp>
          {th && (
            <Grp title="Run live engagement">
              <div style={{ fontSize: 9.5, color: 'var(--dim)', marginBottom: 6, lineHeight: 1.5 }}>
                This sector is part of the <b style={{ color: 'var(--txt)' }}>{th.name}</b> theatre.
                Load it in the live engagement console to run an attack scenario and optimise allocation.
              </div>
              <Link href="/">
                <button className="on" style={{ width: '100%' }}
                  onClick={() => load('medium', 42, th.id)}>
                  ▶ Open {th.name}
                </button>
              </Link>
            </Grp>
          )}
        </Wrap>
      );
    }

    /* ---- BATTERY ---- */
    if (sel.kind === 'battery') {
      const b = lay.batteries.find((x) => x.id === sel.id)!;
      const sp = b.spec;
      return (
        <Wrap title={`${sp.name} ${b.unit}`} tag={b.id} sub={b.active ? b.layer.toUpperCase() : 'OFFLINE'}
          col={b.active ? layerCol(b.layer) : 'var(--red)'}>
          <Grp title="Weapon System — published data">
            <KV k="System" v={sp.fullName} c={layerCol(b.layer)} />
            <KV k="Origin" v={sp.origin} />
            <KV k="Role" v={sp.role} />
            <KV k="Engagement range" v={`${sp.rangeKm[0]} – ${sp.rangeKm[1]} km`} c="var(--amb)" />
            <KV k="Engagement altitude" v={`${sp.altM[0]} – ${sp.altM[1].toLocaleString()} m`} />
            <KV k="Interceptor speed" v={`Mach ${sp.mach} (~${sp.speedMs} m/s)`} />
            <KV k="Guidance" v={sp.guidance} />
            {sp.warheadKg !== null && <KV k="Warhead" v={`${sp.warheadKg} kg`} />}
            <KV k="Simultaneous engagements" v={`${sp.simTargets}`} />
            <KV k="Reload" v={`${sp.reloadS} s`} />
            <KV k="Reaction time" v={`${sp.reactionS} s`} />
            <KV k="Service status" v={sp.status} c="var(--cy)" />
            <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 4, lineHeight: 1.5 }}>
              Source: {sp.source}{sp.note ? ` · ${sp.note}` : ''}
            </div>
          </Grp>
          <Grp title="Associated Radar">
            <KV k="Radar" v={sp.radar} c="var(--vio)" />
            <KV k="Detection range" v={`${sp.radarDetectKm} km`} />
            <KV k="Fire-control range" v={`${sp.radarTrackKm} km`} />
          </Grp>
          <Grp title="Deployment">
            <KV k="Sector" v={b.sectorName} c="var(--cy)" />
            <KV k="Latitude" v={dms(b.lat, true)} />
            <KV k="Longitude" v={dms(b.lon, false)} />
            <KV k="Decimal" v={`${b.lat.toFixed(4)}°, ${b.lon.toFixed(4)}°`} />
            <KV k="Stand-off from sector" v={`${b.standoffKm} km @ ${b.bearingFromSector}°`} />
            <KV k="Rounds at readiness" v={`${b.rounds}`} />
            <KV k="Status" v={b.active ? 'OPERATIONAL' : 'OFFLINE'} c={b.active ? 'var(--grn)' : 'var(--red)'} />
            <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 4, lineHeight: 1.5 }}>
              Position and unit designator are fictional; the system type and its
              specifications are real.
            </div>
          </Grp>
          <button className={b.active ? '' : 'danger on'} style={{ width: '100%', marginTop: 10 }}
            onClick={() => toggleDead(b.id)}>
            {b.active ? '✕ Mark battery offline' : '↻ Restore battery'}
          </button>
        </Wrap>
      );
    }

    /* ---- RADAR ---- */
    const r = lay.radars.find((x) => x.id === sel.id)!;
    const sec = SECTORS.find((x) => x.id === r.sectorId)!;
    return (
      <Wrap title={r.type} tag={r.id} sub="SURVEILLANCE RADAR" col="var(--vio)">
        <Grp title="Radar">
          <KV k="Designation" v={r.name} c="var(--vio)" />
          <KV k="Type" v={r.type} />
          <KV k="Band / array" v={r.band} />
          <KV k="Role" v={r.role} />
          <KV k="Detection range" v={`${r.detectKm} km`} c="var(--vio)" />
        </Grp>
        <Grp title="Siting">
          <KV k="Sector" v={sec.name} c="var(--cy)" />
          <KV k="Latitude" v={dms(r.lat, true)} />
          <KV k="Longitude" v={dms(r.lon, false)} />
          <KV k="Decimal" v={`${r.lat.toFixed(4)}°, ${r.lon.toFixed(4)}°`} />
          <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 4, lineHeight: 1.5 }}>
            Radar type is drawn from the real system fielded in this sector. The site
            position is fictional.
          </div>
        </Grp>
      </Wrap>
    );
  }
}

function Wrap({ title, tag, sub, col, children }: { title: string; tag: string; sub: string; col: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 11px 20px' }}>
      <div style={{ fontSize: 13.5, color: col, letterSpacing: '.04em' }}>{title}</div>
      <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 2 }}>{tag} · {sub}</div>
      {children}
    </div>
  );
}
function Grp({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="lbl" style={{ marginBottom: 5, paddingBottom: 3, borderBottom: '1px solid var(--line)' }}>{title}</div>
      {children}
    </div>
  );
}
function KV({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9.8, padding: '1.5px 0' }}>
      <span style={{ color: 'var(--dim2)', flexShrink: 0 }}>{k}</span>
      <span style={{ color: c ?? 'var(--txt)', textAlign: 'right' }}>{v}</span>
    </div>
  );
}
