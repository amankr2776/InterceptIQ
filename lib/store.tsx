'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { generateScenario } from './scenario';
import { allocate, allocateMinimalSet } from './allocator';
import { injectThreat } from './inject';
import type { AllocationSolution, Scenario } from './types';

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
  load: (tier: Tier, seed?: number, theatreId?: string) => void;
  theatreId: string; setTheatreId: (v: string) => void;
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
  const [rate, setRate] = useState(4);
  const [minimise, setMinimise] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [selThreat, setSelThreat] = useState<string | null>(null);
  const [theatreId, setTheatreId] = useState('NW');
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

  const load = useCallback((tier: Tier, seed?: number, th?: string) => {
    const tid = th ?? theatreId;
    if (th) setTheatreId(th);
    const s = generateScenario({ tier, seed, theatreId: tid });
    setSc(s); setT(0); setPlaying(false); setSelThreat(null);
    const r = solve(s, 0, minimise);
    setFlash(`${tier.toUpperCase()} · ${s.id} · ${s.threats.length} tracks · ${s.areas.length} candidate areas · solved ${r.metrics.solveMs}ms`);
  }, [minimise, solve, theatreId]);

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
  useEffect(() => { if (sc) solve(sc, t, minimise); /* eslint-disable-next-line */ }, [minimise]);

  const reSolve = useCallback((scen: Scenario, label: string) => {
    const t0 = performance.now();
    const s = solve(scen, t, minimise);
    setFlash(`${label} · RE-OPTIMISED ${(performance.now() - t0).toFixed(0)}ms · ${s.selectedAreaIds.length} site(s), ${s.metrics.interceptorsUsed} rounds`);
  }, [t, minimise, solve]);

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
    }}>
      {children}
    </C.Provider>
  );
}
