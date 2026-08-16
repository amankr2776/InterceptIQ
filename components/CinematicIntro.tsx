'use client';
// InterceptIQ
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Particles, Shake } from '@/lib/fx';
import {
  setAudioEnabled, isAudioEnabled, sfxLaunch, sfxIntercept, sfxAlert, sfxJet,
  sfxLock, startBed, stopBed,
} from '@/lib/audio';
import {
  drawBallistic, drawCruise, drawJet, drawDrone, drawInterceptor, drawTEL,
} from '@/lib/vehicles';

/**
 * CINEMATIC OPENING
 * =================
 * A ~24 s scripted engagement rendered to canvas with a real particle system.
 * No video file and no external assets, so it loads instantly and works
 * offline — but it reads as footage rather than a diagram because of what the
 * renderer does per frame:
 *
 *   · frame persistence instead of clear() → genuine motion blur on trails
 *   · additive bloom pass for every hot source
 *   · smoke that lingers, expands and drifts for seconds after a pass
 *   · debris that cools and falls under gravity
 *   · camera shake kicked by each detonation, and a slow push-in
 *   · muzzle flash lighting the terrain from the launcher position
 *
 * The choreography is a layered air-defence engagement: ballistic tracks are
 * taken far out by the S-400, a cruise missile by Akash, and a low strike
 * aircraft by QRSAM at the last ring.
 */

const W = 1920, H = 1080;
const DUR = 24.5;

type Kind = 'ballistic' | 'cruise' | 'jet' | 'drone';

interface Track {
  id: string; kind: Kind;
  x0: number; y0: number; x1: number; y1: number; loft: number;
  tIn: number; tCross: number; tKill: number;
  by: string; label: string; scale: number;
}

const BATTERIES = [
  { id: 'S400',  x: 1395, y: 560, name: 'S-400 TRIUMF', sub: '400 km · Mach 14',  cans: 4, s: 1.5,  tAlert: 4.6, tLock: 7.2 },
  { id: 'AKASH', x: 1060, y: 760, name: 'AKASH',        sub: '45 km · Mach 3.5',  cans: 3, s: 1.22, tAlert: 4.9, tLock: 8.4 },
  { id: 'QRSAM', x: 1530, y: 830, name: 'QRSAM',        sub: '30 km · Mach 4.7',  cans: 2, s: 1.05, tAlert: 5.2, tLock: 17.4 },
];

const TRACKS: Track[] = [
  { id: 'T1', kind: 'ballistic', x0: 80,  y0: 330, x1: 1330, y1: 470, loft: 250, tIn: 2.2,  tCross: 4.6,  tKill: 12.2, by: 'S400',  label: 'SRBM · 700 kg HE',   scale: 1.5 },
  { id: 'T2', kind: 'ballistic', x0: 30,  y0: 520, x1: 1140, y1: 660, loft: 190, tIn: 3.0,  tCross: 5.2,  tKill: 13.6, by: 'S400',  label: 'MRBM · Mach 6.5',    scale: 1.35 },
  { id: 'T3', kind: 'cruise',    x0: 50,  y0: 782, x1: 1045, y1: 772, loft: 26,  tIn: 3.8,  tCross: 6.0,  tKill: 15.0, by: 'AKASH', label: 'CRUISE · terrain-hug', scale: 1.35 },
  { id: 'T4', kind: 'drone',     x0: 60,  y0: 640, x1: 1050, y1: 700, loft: 40,  tIn: 6.4,  tCross: 8.2,  tKill: 16.4, by: 'AKASH', label: 'SHAHPAR-II · UAV',   scale: 1.2 },
  { id: 'T5', kind: 'jet',       x0: 10,  y0: 890, x1: 1510, y1: 846, loft: 16,  tIn: 15.4, tCross: 16.6, tKill: 20.4, by: 'QRSAM', label: 'JF-17 · low-level ingress', scale: 1.45 },
];

const arcAt = (t: Track, u: number) => ({
  x: t.x0 + (t.x1 - t.x0) * u,
  y: t.y0 + (t.y1 - t.y0) * u - Math.sin(Math.PI * u) * t.loft,
});
const headAt = (t: Track, u: number) => {
  const a = arcAt(t, Math.max(0, u - 0.008)), b = arcAt(t, Math.min(1, u + 0.008));
  return Math.atan2(b.y - a.y, b.x - a.x);
};
const launchT = (t: Track) => {
  const b = BATTERIES.find((x) => x.id === t.by)!;
  return Math.max(b.tLock + 0.5, t.tKill - (t.by === 'S400' ? 3.4 : 2.4));
};

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const t0 = useRef<number | null>(null);
  const P = useRef(new Particles());
  const SH = useRef(new Shake());
  const fired = useRef<Set<string>>(new Set());
  const blown = useRef<Set<string>>(new Set());
  const [phase, setPhase] = useState('SURVEILLANCE');
  const [sound, setSound] = useState(false);
  const cued = useRef<Set<string>>(new Set());
  const [clock, setClock] = useState(0);
  const [ended, setEnded] = useState(false);

  const finish = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    stopBed();
    onDone();
  }, [onDone]);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d', { alpha: false })!;
    const parts = P.current, sh = SH.current;

    // static terrain silhouette — deterministic
    const ridge: number[] = [];
    for (let i = 0; i <= 64; i++) {
      ridge.push(
        H * 0.66 - Math.sin(i * 0.42) * 26 - Math.cos(i * 1.13) * 15 - Math.sin(i * 2.7) * 7
      );
    }
    const stars = Array.from({ length: 150 }, (_, i) => ({
      x: (i * 617) % W, y: ((i * 271) % Math.floor(H * 0.6)),
      r: (i % 3) * 0.5 + 0.4, p: (i % 17) / 17,
    }));

    let prev = 0;
    const frame = (now: number) => {
      if (t0.current === null) t0.current = now;
      const t = (now - t0.current) / 1000;
      const dt = Math.min(0.05, t - prev || 0.016);
      prev = t;
      setClock(t);

      setPhase(
        t < 2.2 ? 'SURVEILLANCE'
        : t < 4.6 ? 'HOSTILE LAUNCH DETECTED'
        : t < 7.2 ? 'AIRSPACE VIOLATION'
        : t < 9.0 ? 'FIRE SOLUTION COMPUTED'
        : t < 12.2 ? 'INTERCEPTORS AWAY'
        : t < 15.4 ? 'THREATS DESTROYED'
        : t < 20.4 ? 'LOW-ALTITUDE PENETRATOR'
        : 'AIRSPACE SECURE'
      );

      /* ---------- audio cues ---------- */
      if (isAudioEnabled()) {
        const cue = (k: string, at: number, fn: () => void) => {
          if (t >= at && !cued.current.has(k)) { cued.current.add(k); fn(); }
        };
        for (const tr of TRACKS) {
          cue(`x${tr.id}`, tr.tCross, sfxAlert);
          if (tr.kind === 'jet') cue(`j${tr.id}`, tr.tIn + 0.4, () => sfxJet(4.2));
          const b = BATTERIES.find((x) => x.id === tr.by)!;
          cue(`c${tr.id}`, b.tLock, sfxLock);
          cue(`l${tr.id}`, launchT(tr), () => sfxLaunch(tr.by === 'S400' ? 1.3 : 0.85));
          cue(`k${tr.id}`, tr.tKill, () => sfxIntercept(tr.kind === 'jet' ? 1.15 : 0.95));
        }
      }

      /* ---------- frame persistence = motion blur ---------- */
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(3,6,11,0.46)';
      g.fillRect(0, 0, W, H);

      sh.step(dt);
      // slow cinematic push-in
      const zoom = 1 + Math.min(0.10, t * 0.0045);
      g.save();
      g.translate(W / 2 + sh.x, H / 2 + sh.y);
      g.scale(zoom, zoom);
      g.translate(-W / 2, -H / 2);

      /* ---------- sky, stars, terrain ---------- */
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, 'rgba(5,11,20,0.55)');
      sky.addColorStop(0.6, 'rgba(7,16,26,0.4)');
      sky.addColorStop(1, 'rgba(4,10,16,0.5)');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);

      for (const s of stars) {
        g.globalAlpha = 0.18 + 0.3 * Math.abs(Math.sin(t * 0.8 + s.p * 9));
        g.fillStyle = '#8fb4d6';
        g.fillRect(s.x, s.y, s.r, s.r);
      }
      g.globalAlpha = 1;

      g.beginPath(); g.moveTo(0, ridge[0]);
      ridge.forEach((y, i) => g.lineTo((i * W) / 64, y));
      g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      const grd = g.createLinearGradient(0, H * 0.6, 0, H);
      grd.addColorStop(0, '#0b1c15'); grd.addColorStop(1, '#050d0a');
      g.fillStyle = grd; g.fill();
      g.strokeStyle = 'rgba(38,102,78,0.85)'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(0, ridge[0]);
      ridge.forEach((y, i) => g.lineTo((i * W) / 64, y)); g.stroke();

      // frontier
      g.setLineDash([14, 11]);
      g.strokeStyle = 'rgba(150,62,78,0.55)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(520, H * 0.52); g.lineTo(440, H); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(150,62,78,0.65)';
      g.font = '15px ui-monospace, monospace';
      g.fillText('F R O N T I E R', 350, H - 34);

      // radar sweep from the S-400
      g.save();
      g.translate(1395, 560);
      g.globalAlpha = t < 4.6 ? 0.30 : 0.14;
      for (const r of [180, 340, 520]) {
        g.beginPath(); g.arc(0, 0, r, 0, 7);
        g.strokeStyle = 'rgba(56,189,248,0.5)'; g.lineWidth = 1; g.stroke();
      }
      g.rotate(((t * 68) % 360) * Math.PI / 180);
      const sw = g.createLinearGradient(0, 0, 520, 0);
      sw.addColorStop(0, 'rgba(56,189,248,0.28)');
      sw.addColorStop(1, 'rgba(56,189,248,0)');
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 520, -0.10, 0.10); g.closePath();
      g.fillStyle = sw; g.fill();
      g.restore();
      g.globalAlpha = 1;

      /* ---------- protected city ---------- */
      g.save();
      g.translate(1740, H * 0.665);
      const dome = g.createRadialGradient(0, 0, 40, 0, 0, 190);
      dome.addColorStop(0, 'rgba(255,194,71,0.02)');
      dome.addColorStop(1, 'rgba(255,194,71,0.16)');
      g.beginPath(); g.arc(0, 0, 190, 0, 7); g.fillStyle = dome; g.fill();
      for (let i = 0; i < 9; i++) {
        const bh = 22 + ((i * 37) % 58);
        g.fillStyle = '#0e2419';
        g.fillRect(-92 + i * 21, -bh, 15, bh);
        g.strokeStyle = 'rgba(52,140,102,0.8)'; g.lineWidth = 1;
        g.strokeRect(-92 + i * 21, -bh, 15, bh);
        for (let k = 0; k < 3; k++) {
          if ((i * 7 + k * 3 + Math.floor(t * 0.7)) % 5 === 0) continue;
          g.fillStyle = 'rgba(255,206,110,0.55)';
          g.fillRect(-89 + i * 21, -bh + 6 + k * 14, 3, 4);
        }
      }
      g.fillStyle = '#ffc247';
      g.font = 'bold 17px ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText('P R O T E C T E D   A S S E T', 0, 52);
      g.textAlign = 'left';
      g.restore();

      /* ---------- batteries ---------- */
      for (const b of BATTERIES) {
        const mine = TRACKS.filter((x) => x.by === b.id);
        const spent = mine.filter((x) => t >= launchT(x)).length;
        const alert = t >= b.tAlert, lock = t >= b.tLock;
        const col = !alert ? '#3c5b74' : lock ? '#a78bfa' : '#ffb020';

        // muzzle flash lighting the ground
        for (const m of mine) {
          const dtl = t - launchT(m);
          if (dtl >= 0 && dtl < 0.4) {
            const a = (1 - dtl / 0.4) * 0.85;
            const fl = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, 300);
            fl.addColorStop(0, `rgba(255,214,140,${a * 0.5})`);
            fl.addColorStop(1, 'rgba(255,150,40,0)');
            g.globalCompositeOperation = 'lighter';
            g.beginPath(); g.arc(b.x, b.y, 300, 0, 7); g.fillStyle = fl; g.fill();
            g.globalCompositeOperation = 'source-over';
          }
        }

        if (alert) {
          const rr = 40 + (lock ? 12 * Math.abs(Math.sin(t * 5.5)) : 6 * Math.abs(Math.sin(t * 2.4)));
          g.beginPath(); g.arc(b.x, b.y, rr, 0, 7);
          g.strokeStyle = col; g.lineWidth = 1.8;
          g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]);
        }

        g.save(); g.translate(b.x, b.y);
        drawTEL(g, b.s, col, b.cans, Math.min(spent, b.cans));
        g.restore();

        g.textAlign = 'center';
        g.font = 'bold 16px ui-monospace, monospace';
        g.lineWidth = 4; g.strokeStyle = '#03060b';
        g.strokeText(b.name, b.x, b.y + 56); g.fillStyle = col;
        g.fillText(b.name, b.x, b.y + 56);
        g.font = '12px ui-monospace, monospace';
        g.strokeText(b.sub, b.x, b.y + 74); g.fillStyle = '#7f97ad';
        g.fillText(b.sub, b.x, b.y + 74);
        if (alert && spent < b.cans) {
          g.font = 'bold 12px ui-monospace, monospace'; g.fillStyle = col;
          g.strokeText(lock ? 'LOCKED' : 'ALERT', b.x, b.y - 58);
          g.fillText(lock ? 'LOCKED' : 'ALERT', b.x, b.y - 58);
        }
        g.textAlign = 'left';
      }

      /* ---------- threats ---------- */
      for (const tr of TRACKS) {
        if (t < tr.tIn) continue;
        const dead = t >= tr.tKill;
        const u = Math.min(1, (t - tr.tIn) / (tr.tKill - tr.tIn));
        const p = arcAt(tr, u), hd = headAt(tr, u);

        // flown trail
        g.beginPath();
        for (let k = 0; k <= 40; k++) {
          const q = arcAt(tr, (u * k) / 40);
          k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y);
        }
        g.strokeStyle = dead ? 'rgba(244,63,94,0.10)' : 'rgba(244,63,94,0.42)';
        g.lineWidth = 2; g.stroke();

        if (!dead) {
          // predicted path
          g.beginPath();
          for (let k = 0; k <= 30; k++) {
            const q = arcAt(tr, u + ((1 - u) * k) / 30);
            k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y);
          }
          g.setLineDash([11, 10]);
          g.strokeStyle = 'rgba(244,63,94,0.22)'; g.lineWidth = 1.5; g.stroke();
          g.setLineDash([]);

          if (tr.kind === 'ballistic') parts.exhaust(p.x, p.y, hd, 1.15);
          else if (tr.kind === 'cruise') parts.exhaust(p.x, p.y, hd, 0.55);
          else if (tr.kind === 'jet') { parts.contrail(p.x - Math.cos(hd) * 16, p.y - Math.sin(hd) * 16); parts.exhaust(p.x, p.y, hd, 0.4); }
          else parts.contrail(p.x, p.y);

          g.save(); g.translate(p.x, p.y); g.rotate(hd);
          if (tr.kind === 'ballistic') drawBallistic(g, tr.scale);
          else if (tr.kind === 'cruise') drawCruise(g, tr.scale);
          else if (tr.kind === 'jet') drawJet(g, tr.scale);
          else drawDrone(g, tr.scale);
          g.restore();

          g.font = '13px ui-monospace, monospace';
          g.textAlign = 'right';
          g.lineWidth = 4; g.strokeStyle = '#03060b';
          const lbl = tr.label + (t >= tr.tCross ? ' · INBOUND' : '');
          g.strokeText(lbl, p.x - 34, p.y - 26);
          g.fillStyle = '#ff97a4'; g.fillText(lbl, p.x - 34, p.y - 26);
          g.textAlign = 'left';
        } else if (!blown.current.has(tr.id)) {
          blown.current.add(tr.id);
          const q = arcAt(tr, 1);
          parts.detonate(q.x, q.y, tr.kind === 'jet' ? 1.25 : 1.0);
          sh.kick(tr.kind === 'jet' ? 24 : 18);
        }
      }

      /* ---------- interceptors ---------- */
      for (const tr of TRACKS) {
        const b = BATTERIES.find((x) => x.id === tr.by)!;
        const lt = launchT(tr);
        if (t < lt) continue;
        if (!fired.current.has(tr.id)) {
          fired.current.add(tr.id);
          parts.launchPlume(b.x, b.y - 16);
          sh.kick(7);
        }
        if (t > tr.tKill) continue;
        const f = Math.min(1, (t - lt) / (tr.tKill - lt));
        const tp = arcAt(tr, 1);
        // slight lofted lead so it arcs rather than tracking a ruler line
        const mx = (b.x + tp.x) / 2, my = (b.y + tp.y) / 2 - 90;
        const ix = (1 - f) * (1 - f) * b.x + 2 * (1 - f) * f * mx + f * f * tp.x;
        const iy = (1 - f) * (1 - f) * b.y + 2 * (1 - f) * f * my + f * f * tp.y;
        const f2 = Math.min(1, f + 0.03);
        const nx = (1 - f2) * (1 - f2) * b.x + 2 * (1 - f2) * f2 * mx + f2 * f2 * tp.x;
        const ny = (1 - f2) * (1 - f2) * b.y + 2 * (1 - f2) * f2 * my + f2 * f2 * tp.y;
        const ia = Math.atan2(ny - iy, nx - ix);

        parts.exhaust(ix, iy, ia, 1.0);

        g.save(); g.translate(ix, iy); g.rotate(ia);
        drawInterceptor(g, 1.45);
        g.restore();
      }

      /* ---------- particles on top ---------- */
      parts.step(dt);
      parts.draw(g);

      g.restore();

      /* ---------- vignette ---------- */
      const vig = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.86);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.72)');
      g.fillStyle = vig; g.fillRect(0, 0, W, H);

      // subtle scanlines
      g.globalAlpha = 0.045; g.fillStyle = '#8fd4ff';
      for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
      g.globalAlpha = 1;

      if (t >= DUR) { setEnded(true); finish(); return; }
      raf.current = requestAnimationFrame(frame);
    };

    raf.current = requestAnimationFrame(frame);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [finish]);

  const resolve = Math.max(0, Math.min(1, (clock - 21.0) / 1.8));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#03060b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <canvas ref={cv} width={W} height={H}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 68,
        background: 'linear-gradient(180deg,rgba(3,6,11,.92),rgba(3,6,11,0))',
        display: 'flex', alignItems: 'center', gap: 20, padding: '0 34px',
        fontFamily: 'ui-monospace, monospace', pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 27, fontWeight: 700, color: '#ffb020', letterSpacing: 3 }}>
          InterceptIQ
        </span>
        <span style={{ width: 1, height: 30, background: '#1d3348' }} />
        <span className="pulse" style={{ width: 9, height: 9, borderRadius: '50%', background: '#f43f5e' }} />
        <span style={{ fontSize: 15, color: '#c5d2e0', letterSpacing: 2.6 }}>{phase}</span>
        <span style={{ marginLeft: 'auto', fontSize: 14, color: '#5d7d96', letterSpacing: 1.6 }}>
          T+{clock.toFixed(1)}s
        </span>
      </div>

      {/* resolve card */}
      {resolve > 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: `rgba(3,6,11,${0.88 * resolve})`, opacity: resolve,
          fontFamily: 'ui-monospace, monospace', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 'clamp(38px,6.4vw,86px)', fontWeight: 700, color: '#ffb020', letterSpacing: 10 }}>
            InterceptIQ
          </div>
          <div style={{ fontSize: 'clamp(11px,1.35vw,19px)', color: '#c5d2e0', letterSpacing: 3.6, textAlign: 'center' }}>
            OPTIMAL INTERCEPTOR LAUNCH-AREA ALLOCATION
          </div>
          <div style={{ fontSize: 'clamp(10px,1vw,14px)', color: '#34d399', letterSpacing: 2, marginTop: 6 }}>
            5 THREATS ENGAGED · 0 LEAKERS · PROTECTED ASSET INTACT
          </div>
        </div>
      )}

      <button onClick={() => {
        const v = !sound; setSound(v); setAudioEnabled(v);
        if (v) startBed(); else stopBed();
      }} style={{
        position: 'absolute', left: 26, bottom: 26, padding: '11px 20px',
        background: sound ? 'rgba(255,176,32,.14)' : 'rgba(6,12,20,.92)',
        border: `1px solid ${sound ? '#ffb020' : '#2a4258'}`, borderRadius: 3,
        color: sound ? '#ffb020' : '#8fa8bd', fontSize: 12, letterSpacing: '.16em',
        cursor: 'pointer', fontFamily: 'ui-monospace, monospace', zIndex: 2,
      }}>
        {sound ? '♪ SOUND ON' : '♪ ENABLE SOUND'}
      </button>

      <button onClick={finish} style={{
        position: 'absolute', right: 26, bottom: 26, padding: '11px 20px',
        background: 'rgba(6,12,20,.92)', border: '1px solid #2a4258', borderRadius: 3,
        color: '#8fa8bd', fontSize: 12, letterSpacing: '.16em', cursor: 'pointer',
        fontFamily: 'ui-monospace, monospace', zIndex: 2,
      }}>
        {resolve > 0.5 ? 'ENTER CONSOLE →' : 'SKIP →'}
      </button>

      <div style={{
        position: 'absolute', left: 0, bottom: 0, height: 3,
        width: `${(clock / DUR) * 100}%`, background: '#ffb020', opacity: 0.7,
      }} />
    </div>
  );
}
