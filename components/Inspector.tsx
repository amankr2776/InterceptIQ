'use client';
// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
import React, { useMemo } from 'react';
import type { AllocationSolution, Scenario } from '@/lib/types';
import type { Sel } from './GeoMap';
import { stateAt } from '@/lib/geometry';
import { buildOptions } from '@/lib/allocator';
import { dms, clock, compass, radiusOfCurvature } from '@/lib/format';
import { INTERCEPTORS, THREATS } from '@/lib/systems';
import { diagnoseSites } from '@/lib/diagnostics';
import { SECTORS } from '@/lib/theatre';
import { Bar } from './ui';
import { COL } from './symbols';

export default function Inspector({ sc, sol, t, sel, onSel }: {
  sc: Scenario; sol: AllocationSolution | null; t: number; sel: Sel; onSel: (s: Sel) => void;
}) {
  const table = useMemo(() => buildOptions(sc, 0).opts, [sc]);

  if (!sel) {
    return (
      <Empty>
        <div style={{ color: 'var(--dim)', fontSize: 10.5, lineHeight: 1.7 }}>
          Select any <b style={{ color: 'var(--red)' }}>track</b>, <b style={{ color: 'var(--amb)' }}>launch site</b> or{' '}
          <b style={{ color: 'var(--cy)' }}>defended sector</b> on the map to inspect full geodetic and engagement detail.
        </div>
        <div style={{ marginTop: 12, fontSize: 9.5, color: 'var(--dim2)', lineHeight: 1.8 }}>
          <div>· scroll to zoom · drag to pan</div>
          <div>· click a site twice to destroy it</div>
        </div>
      </Empty>
    );
  }

  /* ================= THREAT ================= */
  if (sel.kind === 'threat') {
    const th = sc.threats.find((x) => x.id === sel.id);
    if (!th) return <Empty>Track lost.</Empty>;
    const st = stateAt(th, Math.min(t, th.impact.t));
    const res = sol?.perThreat.find((p) => p.threatId === th.id);
    const active = t >= th.trajectory[0].t && t <= th.impact.t;

    const idx = th.trajectory.findIndex((s) => s.t >= t);
    const tri = idx > 0 && idx < th.trajectory.length - 1
      ? [th.trajectory[idx - 1].l, th.trajectory[idx].l, th.trajectory[idx + 1].l] : null;
    const R = tri ? radiusOfCurvature(tri) : null;

    const cur = st ? { lat: st.p.lat, lon: st.p.lon } : null;
    const spec = THREATS.find((x) => x.id === th.systemId);

    // flight-path angle
    const fpa = tri ? (Math.atan2(tri[2].z - tri[0].z, Math.hypot(tri[2].x - tri[0].x, tri[2].y - tri[0].y)) * 180) / Math.PI : null;

    return (
      <Wrap title={th.callsign} tag={spec ? spec.name : th.cls} col="var(--red)" onClose={() => onSel(null)}
        sub={active ? 'TRACKING' : t > th.impact.t ? 'TERMINATED' : 'PRE-LAUNCH'}>
        {spec && (
          <Grp title="Threat System — published data">
            <KV k="System" v={spec.name} c="var(--red)" />
            <KV k="Category" v={spec.category} />
            <KV k="Published range" v={`${spec.rangeKm[0]}–${spec.rangeKm[1]} km`} />
            <KV k="Published apogee" v={`${spec.apogeeKm[0]}–${spec.apogeeKm[1]} km`} />
            <KV k="Peak speed" v={`Mach ${spec.mach} (~${spec.terminalSpeedMs} m/s)`} />
            <KV k="Warhead" v={`${spec.warheadKg} kg`} />
            <KV k="Guidance" v={spec.guidance} />
            {spec.cepM !== null && <KV k="CEP (published)" v={`${spec.cepM} m`} />}
            <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 4, lineHeight: 1.5 }}>
              Source: {spec.source}{spec.note ? ` · ${spec.note}` : ''}
            </div>
          </Grp>
        )}
        <Grp title="Current State">
          {st && cur ? (
            <>
              <KV k="Latitude" v={dms(cur.lat, true)} mono />
              <KV k="Longitude" v={dms(cur.lon, false)} mono />
              <KV k="Decimal" v={`${cur.lat.toFixed(5)}°, ${cur.lon.toFixed(5)}°`} />
              <KV k="Altitude" v={`${(st.l.z * 1000).toFixed(0)} m  (${st.l.z.toFixed(2)} km)`} c="var(--cy)" />
              <KV k="Velocity" v={`${st.speed.toFixed(0)} m/s  (Mach ${(st.speed / 340).toFixed(1)})`} c="var(--cy)" />
              <KV k="Flight-path angle" v={fpa !== null ? `${fpa.toFixed(1)}°  ${fpa < 0 ? 'descending' : 'ascending'}` : '—'} />
              <KV k="Radius of curvature" v={R === null ? '—' : R === Infinity ? '∞ (ballistic straight)' : `${R.toFixed(1)} km`} c="var(--vio)" />
            </>
          ) : <KV k="State" v="outside track window" />}
        </Grp>

        <Grp title="Aimed At — Protected Asset">
          <KV k="Target asset" v={th.targetAssetName} c={COL.asset} />
          <KV k="Strikes at" v={clock(th.impact.t)} c={COL.threat} />
          <KV k="Time to impact" v={t < th.impact.t ? `${(th.impact.t - t).toFixed(1)} s` : 'elapsed'}
            c={th.impact.t - t < 30 ? COL.threat : 'var(--amb)'} />
        </Grp>

        <Grp title="Threat Profile">
          <KV k="Classification" v={th.cls} c="var(--red)" />
          <KV k="Threat value" v={`${th.rvValue} / 10`} />
          <KV k="Apogee" v={`${(th.apogeeAlt / 1000).toFixed(1)} km`} />
          <KV k="Ground range" v={`${th.rangeKm.toFixed(1)} km`} />
          <KV k="Heading" v={`${th.bearingDeg.toFixed(0)}° ${compass(th.bearingDeg)}`} />
          <KV k="Time of flight" v={`${(th.impact.t - th.trajectory[0].t).toFixed(0)} s`} />
        </Grp>

        <Grp title="Launch Point (attacker)">
          <KV k="Designator" v={th.origin.name} c="var(--red)" />
          <KV k="Latitude" v={dms(th.origin.p.lat, true)} mono />
          <KV k="Longitude" v={dms(th.origin.p.lon, false)} mono />
          <KV k="Launch time" v={clock(th.trajectory[0].t)} />
        </Grp>

        <Grp title="Predicted Impact">
          <KV k="Latitude" v={dms(th.impact.p.lat, true)} mono />
          <KV k="Longitude" v={dms(th.impact.p.lon, false)} mono />
          <KV k="Impact time" v={clock(th.impact.t)} c="var(--red)" />
          <KV k="Time to impact" v={t < th.impact.t ? `${(th.impact.t - t).toFixed(1)} s` : 'elapsed'}
            c={th.impact.t - t < 30 ? 'var(--red)' : 'var(--amb)'} />
        </Grp>

        <Grp title="Defensive Response — interceptors assigned to destroy this threat">
          {res && !res.leaker ? (
            <>
              <div style={{ fontSize: 9, color: 'var(--dim2)', lineHeight: 1.5, marginBottom: 4 }}>
                Probability our interceptors destroy this incoming threat before it reaches{' '}
                {th.targetAssetName}.
              </div>
              <KV k="Cumulative kill probability" v={`${(res.cumulativePk * 100).toFixed(1)}%`} c={COL.burst} />
              <div style={{ margin: '4px 0 7px' }}><Bar v={res.cumulativePk} c="var(--grn)" /></div>
              {res.shots.map((s, i) => {
                const a = sc.areas.find((x) => x.id === s.areaId)!;
                return (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 2, padding: '5px 6px', marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: COL.intcp }}>Round {s.salvoIndex + 1} · {a.name}</span>
                      <span style={{ color: 'var(--txt)' }}>Pk {(s.option.pk * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 3, lineHeight: 1.55 }}>
                      <b style={{ color: COL.intcp }}>{a.name}</b> launches {clock(s.option.tLaunch)} →{' '}
                      <b style={{ color: COL.burst }}>destroys {th.callsign}</b> {clock(s.option.tIntercept)}<br />
                      Destroyed at {(s.option.interceptAltM / 1000).toFixed(1)} km altitude
                      {s.option.standoffFromAssetKm !== undefined && <>, <b style={{ color: COL.burst }}>{s.option.standoffFromAssetKm} km from {th.targetAssetName}</b></>}<br />
                      Interceptor flies {s.option.slantRangeKm.toFixed(1)} km in{' '}
                      {(s.option.tIntercept - s.option.tLaunch).toFixed(1)}s · aspect {s.option.aspectAngleDeg.toFixed(0)}° · closing {s.option.closingSpeed} m/s<br />
                      {s.option.timeMarginS.toFixed(1)} s to spare before the threat would have struck
                      {s.option.windowOpenS !== undefined && <> · firing window {s.option.windowOpenS.toFixed(0)}–{s.option.windowCloseS?.toFixed(0)}s</>}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div style={{ color: COL.threat, fontSize: 10.5, lineHeight: 1.5 }}>
              LEAKER — no battery can reach this threat before it strikes {th.targetAssetName}.
            </div>
          )}
        </Grp>

        <Grp title="Firing Solutions — can each site destroy this threat?">
          {sc.areas.map((a) => {
            const o = table.get(`${a.id}|${th.id}`);
            const ok = o?.feasible;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, padding: '2px 0' }}>
                <span style={{ width: 52, color: 'var(--dim)' }}>{a.name.replace('Site ', '')}</span>
                <div style={{ flex: 1 }}><Bar v={ok ? o!.pk : 0} c={ok ? 'var(--grn)' : 'var(--red)'} h={3} /></div>
                <span style={{ width: 84, textAlign: 'right', color: ok ? 'var(--txt)' : '#7a4a52', fontSize: 9 }}>
                  {ok ? `Pk ${o!.pk.toFixed(3)}` : o?.reason ?? '—'}
                </span>
              </div>
            );
          })}
        </Grp>
      </Wrap>
    );
  }

  /* ================= SITE ================= */
  if (sel.kind === 'site') {
    const a = sc.areas.find((x) => x.id === sel.id);
    if (!a || !sol) return <Empty>Not found.</Empty>;
    const d = diagnoseSites(sc, sol).find((x) => x.areaId === a.id)!;
    const shots = sol.shots.filter((s) => s.areaId === a.id);
    const spec = INTERCEPTORS.find((x) => x.id === a.systemId);
    return (
      <Wrap title={a.name} tag={a.id} col={d.state === 'TASKED' ? 'var(--amb)' : d.state === 'OFFLINE' ? 'var(--red)' : 'var(--dim)'}
        sub={d.state} onClose={() => onSel(null)}>
        <Grp title="Why this state">
          <div style={{ fontSize: 10, color: 'var(--txt)', lineHeight: 1.6 }}>{d.reason}</div>
        </Grp>
        {spec && (
          <Grp title="Weapon System — published data">
            <KV k="System" v={spec.fullName} c="var(--amb)" />
            <KV k="Origin" v={spec.origin} />
            <KV k="Role" v={spec.role} />
            <KV k="Engagement range" v={`${spec.rangeKm[0]} – ${spec.rangeKm[1]} km`} c="var(--amb)" />
            <KV k="Engagement altitude" v={`${spec.altM[0]} – ${spec.altM[1].toLocaleString()} m`} />
            <KV k="Interceptor speed" v={`Mach ${spec.mach} (~${spec.speedMs} m/s)`} />
            <KV k="Guidance" v={spec.guidance} />
            {spec.warheadKg !== null && <KV k="Warhead" v={`${spec.warheadKg} kg`} />}
            <KV k="Radar" v={spec.radar} />
            <KV k="Simultaneous engagements" v={`${spec.simTargets}`} />
            <KV k="Ready rounds" v={`${spec.readyRounds}`} />
            <KV k="Reload" v={`${spec.reloadS} s`} />
            <KV k="Reaction time" v={`${spec.reactionS} s`} />
            <KV k="Service status" v={spec.status} c="var(--cy)" />
            <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 4, lineHeight: 1.5 }}>
              Source: {spec.source}{spec.note ? ` · ${spec.note}` : ''}
            </div>
          </Grp>
        )}
        <Grp title="Deployment">
          <KV k="Centroid lat" v={dms(a.centroid.lat, true)} mono />
          <KV k="Centroid lon" v={dms(a.centroid.lon, false)} mono />
          <KV k="Footprint" v={`${a.polygon.length}-vertex polygon`} />
          <KV k="Rounds available" v={`${a.inventory}`} c={a.inventory ? 'var(--txt)' : 'var(--red)'} />
          <KV k="Rounds committed" v={`${shots.length}`} c="var(--amb)" />
          <KV k="Status" v={a.active ? 'OPERATIONAL' : 'DESTROYED / OFFLINE'} c={a.active ? 'var(--grn)' : 'var(--red)'} />
          <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 4, lineHeight: 1.5 }}>
            Unit designator is fictional; the system type and its specifications are real.
          </div>
        </Grp>
        <Grp title="Coverage">
          <KV k="Feasible targets" v={`${d.feasibleTargets} / ${d.totalTargets}`} />
          <div style={{ margin: '3px 0 7px' }}><Bar v={d.feasibleTargets} max={d.totalTargets} c="var(--amb)" /></div>
          <KV k="Best achievable Pk" v={d.bestPk.toFixed(3)} />
        </Grp>
        {shots.length > 0 && (
          <Grp title="Assigned Engagements">
            {shots.map((s, i) => {
              const th = sc.threats.find((x) => x.id === s.threatId)!;
              return (
                <div key={i} style={{ fontSize: 9.5, color: 'var(--dim)', padding: '3px 0', borderBottom: '1px solid #0d141c' }}>
                  <span style={{ color: 'var(--txt)' }}>{th.callsign}</span> · round {s.salvoIndex + 1} ·
                  Pk {s.option.pk.toFixed(3)} · intercept {clock(s.option.tIntercept)} @ {(s.option.interceptAltM / 1000).toFixed(1)} km
                </div>
              );
            })}
          </Grp>
        )}
        <Grp title="Polygon Vertices (Lat / Lon)">
          {a.polygon.map((p, i) => (
            <div key={i} style={{ fontSize: 9, color: 'var(--dim2)', fontFamily: 'inherit' }}>
              V{i + 1} &nbsp;{p.lat.toFixed(5)}°N &nbsp;{p.lon.toFixed(5)}°E
            </div>
          ))}
        </Grp>
      </Wrap>
    );
  }

  /* ================= ASSET ================= */
  const as = sc.assets.find((x) => x.id === sel.id);
  if (!as) return <Empty>Not found.</Empty>;
  const sect = SECTORS.find((x) => x.id === as.id);
  const inbound = sc.threats.filter((th) => th.targetAssetId === as.id);
  return (
    <Wrap title={as.name} tag={as.id} col={COL.asset} sub="PROTECTED ASSET" onClose={() => onSel(null)}>
      <Grp title="Location">
        <KV k="Centre lat" v={dms(as.centroid.lat, true)} mono />
        <KV k="Centre lon" v={dms(as.centroid.lon, false)} mono />
        <KV k="Decimal" v={`${as.centroid.lat.toFixed(4)}°, ${as.centroid.lon.toFixed(4)}°`} />
        <KV k="Defended radius" v={`${as.radiusKm.toFixed(0)} km`} />
        <KV k="Asset value" v={`${as.value} / 10`} c="var(--cy)" />
        {sect && <KV k="Population" v={sect.pop.toLocaleString()} />}
        {sect && <KV k="Designation" v={sect.kind} />}
      </Grp>
      <Grp title={`Threats aimed at this asset (${inbound.length})`}>
        {inbound.length === 0 && <div style={{ fontSize: 10, color: 'var(--dim2)' }}>No tracks aimed at this asset.</div>}
        {inbound.map((th) => {
          const r = sol?.perThreat.find((p) => p.threatId === th.id);
          return (
            <div key={th.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, padding: '2px 0' }}>
              <span style={{ color: 'var(--txt)' }}>{th.callsign} <span style={{ color: 'var(--dim2)' }}>{th.cls}</span></span>
              <span style={{ color: r?.leaker ? COL.threat : COL.burst }}>
                {r?.leaker ? 'WILL STRIKE' : `${((r?.cumulativePk ?? 0) * 100).toFixed(0)}% stopped`}
              </span>
            </div>
          );
        })}
      </Grp>
    </Wrap>
  );
}

function Wrap({ title, tag, sub, col, children, onClose }: { title: string; tag: string; sub: string; col: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: col, letterSpacing: '.05em' }}>{title}</div>
          <div style={{ fontSize: 8.5, color: 'var(--dim2)', marginTop: 2 }}>{tag} · {sub}</div>
        </div>
        <button style={{ padding: '2px 7px', fontSize: 10 }} onClick={onClose}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 12px' }}>{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 14 }}>{children}</div>;
}
function Grp({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 11 }}>
      <div className="lbl" style={{ marginBottom: 5, paddingBottom: 3, borderBottom: '1px solid var(--line)' }}>{title}</div>
      {children}
    </div>
  );
}
function KV({ k, v, c, mono }: { k: string; v: string; c?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9.8, padding: '1.5px 0' }}>
      <span style={{ color: 'var(--dim2)', flexShrink: 0 }}>{k}</span>
      <span style={{ color: c ?? 'var(--txt)', textAlign: 'right', letterSpacing: mono ? '-.02em' : 0 }}>{v}</span>
    </div>
  );
}
