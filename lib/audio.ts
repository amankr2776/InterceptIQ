'use client';
// InterceptIQ

/**
 * Minimal synthesised audio cues — launch, intercept, impact alarm.
 *
 * Generated with WebAudio oscillators rather than shipped as files: no assets
 * to load, nothing to fail offline, a few hundred bytes of code. Muted by
 * default; the operator opts in.
 */

let ctx: AudioContext | null = null;
let enabled = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setAudioEnabled(v: boolean) {
  enabled = v;
  if (v) ac();
}
export const isAudioEnabled = () => enabled;

function tone(
  freq: number, dur: number, type: OscillatorType, gain: number,
  sweepTo?: number
) {
  const a = ac();
  if (!a || !enabled) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number) {
  const a = ac();
  if (!a || !enabled) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1400;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

/** Interceptor away — rising whoosh. */
export const sfxLaunch = () => { tone(180, 0.5, 'sawtooth', 0.06, 620); noise(0.28, 0.035); };
/** Threat destroyed — short bright burst. */
export const sfxIntercept = () => { tone(880, 0.16, 'square', 0.05, 240); noise(0.22, 0.06); };
/** Protected asset struck — low alarm. */
export const sfxImpact = () => { tone(140, 0.7, 'sawtooth', 0.09, 70); tone(72, 0.9, 'sine', 0.07); };
/** Airspace violation — two-tone alert. */
export const sfxAlert = () => { tone(660, 0.14, 'triangle', 0.045); setTimeout(() => tone(520, 0.18, 'triangle', 0.045), 150); };
