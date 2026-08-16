'use client';
// InterceptIQ
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { generateScenario } from './scenario';
import { allocate, allocateMinimalSet } from './allocator';
import { injectThreat } from './inject';
import { setAudioEnabled, sfxLaunch, sfxIntercept, sfxImpact, sfxAlert } from './audio';
import type { AllocationSolution, Scenario } from './types';
import { solveAllModes, solveMode, type Mode, type ModeResult } from './compare';

type Tier = 'easy' | 'medium' | 'hard' | 'random';

interface Ctx {
  sc: Scenario | null;
  sol: AllocationSolution | null;
  t: number; setT: (v: number) => void;
  tMax: number;
  playing: boolean; setPlaying: (v: boolean) => void;
  rate: number; setRate: (v: number) => void;
  minimise: boolean; setMinimise: (v: boolean) => void;
  flash: string | null;
  load: (tier: Tier, seed?: number, theatreId?: string, nThreats?: number) => void;
  theatreId: string; setTheatreId: (v: string) => void;
  mode: Mode; setMode: (m: Mode) => void;
  results: ModeResult[];
  busy: boolean;
  audio: boolean; setAudio: (v: boolean) => void;
  jumpToFirstEngagement: () => void;
  toggleSite: (id: string) => void;
  addThreat: (lat: number, lon: number, systemId?: string) => void;
  removeThreat: (id: string) => void;
  updateArea: (id: string, patch: Partial<Scenario['areas'][0]>) => void;
  setScenario: (s: Scenario) => void;
  selThreat: string | null; setSelThreat: (v: string | null) => void;
}

const C = createContext<Ctx | null>(null);
export const useMission = () => {
  const v = useContext(C);
  if (!v) throw new Error('useMission outside provider');
  return v;
};

export function MissionProvider({ children }: { children: React.ReactNode }) {
  const [sc, setSc] = useState<Scenario | null>(null);
  const [sol, setSol] = useState<AllocationSolution | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(25);
  const [minimise, setMinimise] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [selThreat, setSelThreat] = useState<string | null>(null);
  const [theatreId, setTheatreId] = useState('NW');
  const [mode, setModeRaw] = useState<Mode>('minimal');
  const [results, setResults] = useState<ModeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [audio, setAudioState] = useState(false);
  const raf = useRef<number | null>(null);

  const tMax = useMemo(
    () => (sc && sc.threats.length ? Math.max(...sc.threats.map((x) => x.impact.t)) + 12 : 100),
    [sc]
  );

  const solve = useCallback((scen: Scenario, tNow: number, mini: boolean) => {
    const s = mini ? allocateMinimalSet(scen, { tNow }) : allocate(scen, { tNow });
    setSol(s);
    return s;
  }, []);

  /** Re-solve every counterfactual mode for the comparison bar. */
  const refreshModes = useCallback((scen: Scenario, m: Mode) => {
    setBusy(true);
    const all = solveAllModes(scen, 0);
    setResults(all);
    const chosen = all.find((r) => r.mode === m);
    if (chosen?.sol) setSol(chosen.sol);
    else if (m === 'none') setSol({
      ...(all.find((r) => r.mode === 'minimal')!.sol!),
      shots: [], selectedAreaIds: [],
      perThreat: scen.threats.map((t) => ({ threatId: t.id, shots: [], cumulativePk: 0, leaker: true })),
      metrics: {
        ...(all.find((r) => r.mode === 'minimal')!.sol!.metrics),
        expectedKills: 0, threatsEngaged: 0, leakers: scen.threats.length,
        weightedProtection: 0, interceptorsUsed: 0, sitesUsed: 0, meanPk: 0,
      },
    });
    setBusy(false);
    return all;
  }, []);

  const load = useCallback((tier: Tier, seed?: number, th?: string, nThreats?: number) => {
    const tid = th ?? theatreId;
    if (th) setTheatreId(th);
    const s = generateScenario({ tier, seed, theatreId: tid, nThreats });
    setSc(s); setT(0); setPlaying(false); setSelThreat(null);
    const all = refreshModes(s, mode);
    const r = all.find((x) => x.mode === mode);
    setFlash(`${tier.toUpperCase()} · ${s.id} · ${s.threats.length} tracks · ${s.areas.length} candidate areas · solved ${r?.solveMs ?? 0}ms`);
  }, [mode, refreshModes, theatreId]);

  const setMode = useCallback((m: Mode) => {
    setModeRaw(m);
    if (!sc) return;
    setBusy(true);
    const r = solveMode(sc, m, 0);
    if (r.sol) setSol(r.sol);
    else {
      const base = results.find((x) => x.mode === 'minimal')?.sol;
      if (base) setSol({
        ...base, shots: [], selectedAreaIds: [],
        perThreat: sc.threats.map((t) => ({ threatId: t.id, shots: [], cumulativePk: 0, leaker: true })),
        metrics: { ...base.metrics, expectedKills: 0, threatsEngaged: 0,
          leakers: sc.threats.length, weightedProtection: 0, interceptorsUsed: 0,
          sitesUsed: 0, meanPk: 0 },
      });
    }
    setResults((prev) => prev.map((x) => (x.mode === m ? r : x)));
    setBusy(false);
    setFlash(`${r.label.toUpperCase()} — ${r.total - r.leakers}/${r.total} stopped, ${r.sitesUsed} site(s)`);
  }, [sc, results]);

  const setAudio = useCallback((v: boolean) => { setAudioState(v); setAudioEnabled(v); }, []);

  const jumpToFirstEngagement = useCallback(() => {
    if (!sol?.shots.length) return;
    const first = Math.min(...sol.shots.map((s) => s.option.tLaunch));
    setT(Math.max(0, first - 6));
    setPlaying(true);
  }, [sol]);

  useEffect(() => { load('medium', 42, 'NW'); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setT((p) => { const n = p + dt * rate; if (n >= tMax) { setPlaying(false); return tMax; } return n; });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, rate, tMax]);

  useEffect(() => { if (flash) { const id = setTimeout(() => setFlash(null), 3800); return () => clearTimeout(id); } }, [flash]);

  /* Audio cues. Fire once as the clock passes each event; a ref of already
   * played keys prevents re-triggering when the user scrubs backwards. */
  const played = useRef<Set<string>>(new Set());
  useEffect(() => { played.current.clear(); }, [sc?.id, mode]);
  useEffect(() => {
    if (!audio || !sc || !sol) return;
    const fire = (key: string, fn: () => void) => {
      if (played.current.has(key)) return;
      played.current.add(key); fn();
    };
    for (const th of sc.threats) {
      if (th.borderCrossT !== null && t >= th.borderCrossT && t < th.borderCrossT + 3)
        fire(`x${th.id}`, sfxAlert);
      const r = sol.perThreat.find((p) => p.threatId === th.id);
      if (r?.leaker && t >= th.impact.t && t < th.impact.t + 3) fire(`i${th.id}`, sfxImpact);
    }
    for (const s of sol.shots) {
      if (t >= s.option.tLaunch && t < s.option.tLaunch + 3)
        fire(`l${s.areaId}${s.threatId}${s.salvoIndex}`, sfxLaunch);
      if (t >= s.option.tIntercept && t < s.option.tIntercept + 3)
        fire(`k${s.areaId}${s.threatId}${s.salvoIndex}`, sfxIntercept);
    }
  }, [t, audio, sc, sol, mode]);
  useEffect(() => { if (sc) setMode(minimise ? 'minimal' : 'layered'); /* eslint-disable-next-line */ }, [minimise]);

  const reSolve = useCallback((scen: Scenario, label: string) => {
    const t0 = performance.now();
    const r = solveMode(scen, mode, t);
    if (r.sol) setSol(r.sol);
    // keep the comparison bar honest after a battlefield change
    setResults(solveAllModes(scen, t));
    setFlash(`${label} · RE-OPTIMISED ${(performance.now() - t0).toFixed(0)}ms · ${r.sitesUsed} site(s), ${r.rounds} rounds`);
  }, [t, mode]);

  const toggleSite = useCallback((id: string) => {
    setSc((prev) => {
      if (!prev) return prev;
      const next = { ...prev, areas: prev.areas.map((a) => a.id === id ? { ...a, active: !a.active } : a) };
      const a = next.areas.find((x) => x.id === id)!;
      reSolve(next, `${a.name} ${a.active ? 'RESTORED' : 'DESTROYED'}`);
      return next;
    });
  }, [reSolve]);

  const addThreat = useCallback((lat: number, lon: number, systemId?: string) => {
    setSc((prev) => {
      if (!prev) return prev;
      const th = injectThreat(prev, lat, lon, t, systemId);
      const next = { ...prev, threats: [...prev.threats, th] };
      reSolve(next, `NEW TRACK ${th.callsign} (${th.systemId}) INJECTED`);
      return next;
    });
  }, [t, reSolve]);

  const removeThreat = useCallback((id: string) => {
    setSc((prev) => {
      if (!prev) return prev;
      const next = { ...prev, threats: prev.threats.filter((x) => x.id !== id) };
      reSolve(next, `TRACK DROPPED`);
      return next;
    });
  }, [reSolve]);

  const updateArea = useCallback((id: string, patch: Partial<Scenario['areas'][0]>) => {
    setSc((prev) => {
      if (!prev) return prev;
      const next = { ...prev, areas: prev.areas.map((a) => a.id === id ? { ...a, ...patch } : a) };
      reSolve(next, `${next.areas.find((a) => a.id === id)!.name} RECONFIGURED`);
      return next;
    });
  }, [reSolve]);

  const setScenario = useCallback((s: Scenario) => {
    setSc(s); setT(0); setPlaying(false);
    solve(s, 0, minimise);
    setFlash('SCENARIO UPDATED');
  }, [minimise, solve]);

  return (
    <C.Provider value={{
      sc, sol, t, setT, tMax, playing, setPlaying, rate, setRate, minimise, setMinimise,
      flash, load, toggleSite, addThreat, removeThreat, updateArea, setScenario, selThreat, setSelThreat,
      theatreId, setTheatreId,
      mode, setMode, results, busy, audio, setAudio, jumpToFirstEngagement,
    }}>
      {children}
    </C.Provider>
  );
}
