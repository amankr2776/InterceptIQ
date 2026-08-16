// InterceptIQ
'use client';

/**
 * CINEMATIC AUDIO ENGINE
 * ======================
 * Everything is synthesised at runtime — no sample files, so it loads
 * instantly and works offline.
 *
 * The previous version used bare oscillators, which is why it sounded like a
 * game. Real ordnance audio is mostly *noise* shaped by filters and envelopes,
 * not tones:
 *
 *   · a rocket motor is broadband noise through a resonant band-pass that
 *     opens as the motor comes up, plus a low rumble that Dopplers away
 *   · an explosion is a sub-bass thump, a noise burst through a fast-decaying
 *     low-pass, and a long convolved tail
 *   · a jet is layered noise with a compressor whine an octave up
 *   · distance means low-pass filtering and reverb, not just lower volume
 *
 * A convolution reverb is generated from noise (exponentially decaying, with
 * a slight pre-delay) so every impact sits in the same acoustic space.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verbSend: GainNode | null = null;
let enabled = false;
let bed: { stop: () => void } | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();

    master = ctx.createGain();
    master.gain.value = 0.85;
    // gentle limiter so overlapping detonations never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 9;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    master.connect(comp).connect(ctx.destination);

    // convolution reverb — open-air battlefield tail
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const pre = Math.floor(ctx.sampleRate * 0.02);
      for (let i = 0; i < len; i++) {
        if (i < pre) { d[i] = 0; continue; }
        const u = (i - pre) / (len - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - u, 2.6) * (1 - u * 0.35);
      }
    }
    conv.buffer = buf;
    verbSend = ctx.createGain();
    verbSend.gain.value = 0.34;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.7;
    verbSend.connect(conv).connect(verbOut).connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setAudioEnabled(v: boolean) {
  enabled = v;
  if (v) ac();
  else stopBed();
}
export const isAudioEnabled = () => enabled;

/** Shared white-noise buffer; cached because allocation is the expensive part. */
let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext) {
  if (noiseBuf) return noiseBuf;
  const len = a.sampleRate * 3;
  noiseBuf = a.createBuffer(1, len, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

interface Voice { src: AudioBufferSourceNode; gain: GainNode }

function noiseVoice(
  a: AudioContext, dur: number, filt: BiquadFilterNode[], gainCurve: (g: GainNode, t: number) => void,
  send = 0.5
): Voice {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.loop = true;
  const gain = a.createGain();
  let node: AudioNode = src;
  for (const f of filt) { node.connect(f); node = f; }
  node.connect(gain);
  gain.connect(master!);
  if (verbSend) {
    const s = a.createGain();
    s.gain.value = send;
    gain.connect(s).connect(verbSend);
  }
  gainCurve(gain, a.currentTime);
  src.start();
  src.stop(a.currentTime + dur);
  return { src, gain };
}

/* ------------------------------------------------------------------ */
/*  EVENTS                                                            */
/* ------------------------------------------------------------------ */

/**
 * MISSILE LAUNCH — ignition crack, motor roar building, Doppler departure.
 * `power` scales duration and low-end weight (S-400 vs QRSAM).
 */
export function sfxLaunch(power = 1) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;
  const dur = 2.2 * power;

  // ignition transient
  const ig = a.createBiquadFilter(); ig.type = 'bandpass';
  ig.frequency.setValueAtTime(1400, t); ig.Q.value = 0.7;
  noiseVoice(a, 0.3, [ig], (g) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55 * power, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  }, 0.5);

  // motor roar: band-pass sweeping down as it departs
  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(620, t);
  bp.frequency.exponentialRampToValueAtTime(180, t + dur);
  bp.Q.value = 1.1;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(5200, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  noiseVoice(a, dur, [bp, lp], (g) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42 * power, t + 0.14);
    g.gain.setValueAtTime(0.42 * power, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }, 0.55);

  // sub rumble
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(62 * power, t);
  o.frequency.exponentialRampToValueAtTime(28, t + dur);
  const og = a.createGain();
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(0.30 * power, t + 0.08);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(og).connect(master!);
  o.start(t); o.stop(t + dur + 0.05);
}

/**
 * INTERCEPT — warhead detonation heard at distance.
 * Sub thump + shaped noise burst + long reverb tail.
 */
export function sfxIntercept(scale = 1) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;

  // sub-bass thump
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120 * scale, t);
  o.frequency.exponentialRampToValueAtTime(26, t + 0.55);
  const og = a.createGain();
  og.gain.setValueAtTime(0.62 * scale, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  o.connect(og).connect(master!);
  if (verbSend) { const s = a.createGain(); s.gain.value = 0.5; og.connect(s).connect(verbSend); }
  o.start(t); o.stop(t + 0.8);

  // blast: bright crack decaying to a low roar
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(7000, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.9);
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55;
  noiseVoice(a, 1.5, [lp, hp], (g) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.72 * scale, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  }, 0.85);

  // debris crackle
  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2600, t); bp.Q.value = 0.6;
  noiseVoice(a, 1.1, [bp], (g) => {
    g.gain.setValueAtTime(0, t + 0.06);
    g.gain.linearRampToValueAtTime(0.13 * scale, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  }, 0.6);
}

/** ASSET STRUCK — heavier, closer, longer tail. */
export function sfxImpact() {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(88, t);
  o.frequency.exponentialRampToValueAtTime(19, t + 1.5);
  const og = a.createGain();
  og.gain.setValueAtTime(0.85, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
  o.connect(og).connect(master!);
  if (verbSend) { const s = a.createGain(); s.gain.value = 0.85; og.connect(s).connect(verbSend); }
  o.start(t); o.stop(t + 2);

  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4200, t);
  lp.frequency.exponentialRampToValueAtTime(140, t + 1.6);
  noiseVoice(a, 2.4, [lp], (g) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  }, 1.0);
}

/**
 * AIRSPACE ALERT — a two-tone klaxon, filtered so it reads as a PA horn in a
 * room rather than a UI beep.
 */
export function sfxAlert() {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;
  const horn = (f: number, at: number, dur: number) => {
    const o = a.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t + at);
    const bp = a.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = f * 2.1; bp.Q.value = 3.2;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(0.17, t + at + 0.05);
    g.gain.setValueAtTime(0.17, t + at + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    o.connect(bp).connect(g).connect(master!);
    if (verbSend) { const s = a.createGain(); s.gain.value = 0.55; g.connect(s).connect(verbSend); }
    o.start(t + at); o.stop(t + at + dur + 0.05);
  };
  horn(440, 0, 0.42);
  horn(330, 0.46, 0.52);
}

/** RADAR LOCK — short filtered chirp, the only deliberately "electronic" cue. */
export function sfxLock() {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;
  const o = a.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(1180, t);
  o.frequency.exponentialRampToValueAtTime(1760, t + 0.09);
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.10, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(master!);
  o.start(t); o.stop(t + 0.2);
}

/** JET FLYBY — layered noise plus compressor whine, Doppler through the pass. */
export function sfxJet(dur = 3.4) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;

  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.linearRampToValueAtTime(760, t + dur * 0.45);
  bp.frequency.exponentialRampToValueAtTime(190, t + dur);
  bp.Q.value = 0.9;
  noiseVoice(a, dur, [bp], (g) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.34, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }, 0.5);

  // turbine whine an octave up, Dopplering down through the pass
  const o = a.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(760, t);
  o.frequency.linearRampToValueAtTime(880, t + dur * 0.45);
  o.frequency.exponentialRampToValueAtTime(420, t + dur);
  const wf = a.createBiquadFilter(); wf.type = 'bandpass';
  wf.frequency.value = 1500; wf.Q.value = 6;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.075, t + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(wf).connect(g).connect(master!);
  o.start(t); o.stop(t + dur + 0.05);
}

/**
 * AMBIENT BED — low wind and a distant radar sweep tick. Gives the scene an
 * acoustic floor so the silence between events is not dead air.
 */
export function startBed() {
  const a = ac(); if (!a || !enabled || bed) return;
  const t = a.currentTime;

  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
  const src = a.createBufferSource(); src.buffer = noise(a); src.loop = true;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 2.2);
  src.connect(lp).connect(g).connect(master!);
  src.start();

  // slow LFO on the wind so it breathes
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.09;
  const lg = a.createGain(); lg.gain.value = 0.022;
  lfo.connect(lg).connect(g.gain);
  lfo.start();

  bed = {
    stop: () => {
      const now = a.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      setTimeout(() => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } }, 800);
    },
  };
}

export function stopBed() {
  if (bed) { bed.stop(); bed = null; }
}
