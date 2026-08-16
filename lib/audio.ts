// InterceptIQ
'use client';

/**
 * BATTLEFIELD AUDIO ENGINE
 * ========================
 * Everything is synthesised at runtime — no sample files, so it loads
 * instantly, works offline and ships nothing but code.
 *
 * WHY THE PREVIOUS VERSION STILL SOUNDED LIKE A GAME
 * --------------------------------------------------
 * It was already noise-based rather than oscillator-based, which was the right
 * instinct, but it broke four rules that separate real recorded ordnance from
 * a sound-effect library:
 *
 *  1. NO CRACK. A real detonation heard from any distance begins with a
 *     shock front — a near-instantaneous overpressure step, a millisecond
 *     wide. The old blast ramped over 6 ms into a filtered noise burst, which
 *     is the anatomy of a "boom" sample, not of a blast wave. Here the
 *     detonation is built from an explicit rendered impulse: a one-sample
 *     step followed by an N-wave (positive phase, negative underpressure
 *     phase) at the physical duration for the charge size.
 *
 *  2. NO DISTANCE. Everything arrived instantly and full-bandwidth. Air
 *     absorbs high frequencies at roughly 0.5 dB per 100 m per kHz, and sound
 *     travels 343 m/s. A kill at 120 km should arrive ~350 s late, muffled to
 *     a low thud, and mostly as reverb tail. Every cue now takes a distance in
 *     km and derives its own delay, low-pass cutoff and wet/dry balance from
 *     it. Distant events genuinely become rumble.
 *
 *  3. NO GROUND. Real outdoor blasts have a ground-reflected arrival a few
 *     milliseconds after the direct one, which is what gives them their
 *     characteristic slap. Added as a delayed, filtered, attenuated copy.
 *
 *  4. TONAL RESIDUE. Jet and alert cues leaned on sawtooth oscillators, and a
 *     sustained sawtooth reads as "synth" to any listener. The jet is now
 *     pure broadband noise: a low-frequency shear-layer roar, a mid-band
 *     turbulent core, and a set of narrow resonant peaks for the compressor,
 *     each detuned and jittered so no single pitch dominates.
 *
 * Additional realism: a rocket motor is amplitude-modulated by low-frequency
 * combustion instability (real motors chug), the reverb is a true stereo
 * decorrelated impulse with an early-reflection cluster rather than plain
 * decaying noise, and the master bus is limited so overlapping detonations
 * duck the bed instead of clipping.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;      // dry bus
let verbSend: GainNode | null = null;    // far-field reverb send
let duckTarget: GainNode | null = null;  // bed, ducked by loud events
let enabled = false;
let bed: { stop: () => void } | null = null;

/** Speed of sound, m/s, at ~15 °C. Used to delay distant events. */
const C_SOUND = 343;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();

    master = ctx.createGain();
    master.gain.value = 0.9;

    /* Two-stage dynamics: a slow compressor for overall density, then a fast
     * brickwall-ish limiter. A single compressor either pumps or clips when a
     * salvo of detonations lands together. */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 26; comp.ratio.value = 4;
    comp.attack.value = 0.012; comp.release.value = 0.32;

    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3.2; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.0008; lim.release.value = 0.12;

    master.connect(comp).connect(lim).connect(ctx.destination);

    /* Reverb: an open-country impulse. Early reflections from terrain in the
     * first 120 ms, then a long decorrelated diffuse tail. Left and right are
     * generated independently so it opens up in stereo rather than sitting in
     * the middle of the head. */
    const conv = ctx.createConvolver();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 3.4);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const pre = Math.floor(sr * 0.024);
      for (let i = pre; i < len; i++) {
        const u = (i - pre) / (len - pre);
        // diffuse tail, steep at first then long
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - u, 3.1) * 0.72;
      }
      // discrete early reflections off ridgelines
      for (const [ms, g] of [[31, 0.5], [47, 0.38], [68, 0.3], [96, 0.22], [131, 0.16]]) {
        const k = Math.floor(sr * (ms / 1000) * (ch ? 1.07 : 1));
        if (k < len) d[k] += (Math.random() < 0.5 ? -1 : 1) * g;
      }
    }
    conv.buffer = buf;
    verbSend = ctx.createGain();
    verbSend.gain.value = 0.4;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.78;
    verbSend.connect(conv).connect(verbOut).connect(comp);
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

/* ------------------------------------------------------------------ */
/*  PRIMITIVES                                                        */
/* ------------------------------------------------------------------ */

/** Shared white-noise buffer; allocation is the expensive part, so cache it. */
let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext) {
  if (noiseBuf) return noiseBuf;
  const len = a.sampleRate * 4;
  noiseBuf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = noiseBuf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/**
 * Brown-ish noise (integrated white). Real low-frequency rumble has a −6 dB
 * per octave slope; white noise filtered by a biquad only gives −12 dB after
 * the corner and sounds thin underneath. Used for blast tails and the bed.
 */
let brownBuf: AudioBuffer | null = null;
function brown(a: AudioContext) {
  if (brownBuf) return brownBuf;
  const len = a.sampleRate * 4;
  brownBuf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = brownBuf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.022 * w) / 1.022;
      d[i] = last * 12;
    }
  }
  return brownBuf;
}

/**
 * ATMOSPHERIC PROPAGATION
 * Given a distance in km, return the arrival delay, the air-absorption
 * cutoff, an amplitude factor and how wet the event should be. This single
 * function is what makes a 200 km intercept sound different from one
 * overhead, rather than just quieter.
 */
function propagation(km: number) {
  const m = Math.max(0, km) * 1000;
  return {
    delay: Math.min(6, m / C_SOUND / 60),          // compressed to keep the demo watchable
    // high frequencies are absorbed first; 18 kHz close, a few hundred Hz far
    cutoff: Math.max(140, 17000 * Math.exp(-m / 9000)),
    amp: 1 / (1 + Math.pow(km / 14, 1.15)),
    wet: Math.min(0.95, 0.22 + km / 90),
  };
}

interface Chain { input: AudioNode; out: GainNode }

/**
 * Build a per-event output chain that applies distance: air-absorption
 * low-pass, dry level, and a reverb send that grows with range.
 */
function farField(a: AudioContext, km: number, level: number): Chain {
  const p = propagation(km);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = p.cutoff; lp.Q.value = 0.5;
  const out = a.createGain();
  out.gain.value = level * p.amp;
  lp.connect(out);
  out.connect(master!);
  if (verbSend) {
    const s = a.createGain();
    s.gain.value = p.wet;
    out.connect(s).connect(verbSend);
  }
  return { input: lp, out };
}

/** Momentarily duck the ambient bed so a blast has room. */
function duck(a: AudioContext, at: number, amount: number, hold: number) {
  if (!duckTarget) return;
  const g = duckTarget.gain;
  const base = 0.055;
  g.cancelScheduledValues(at);
  g.setValueAtTime(g.value, at);
  g.linearRampToValueAtTime(base * (1 - amount), at + 0.03);
  g.setValueAtTime(base * (1 - amount), at + hold);
  g.linearRampToValueAtTime(base, at + hold + 1.4);
}

/**
 * BLAST IMPULSE
 * Renders an actual pressure waveform into a buffer rather than enveloping
 * noise. A Friedlander N-wave: instantaneous rise to peak overpressure,
 * exponential decay through zero into a negative underpressure phase, then
 * recovery. This is the shape that makes an explosion read as an explosion
 * and not as a filtered noise burst — the discontinuity at t=0 is the crack.
 *
 * `posMs` is the positive-phase duration, which scales with charge mass; a
 * 23 kg SAM warhead is a sharp snap, a 700 kg TBM warhead is a deep thud.
 */
function blastBuffer(a: AudioContext, posMs: number, grit: number): AudioBuffer {
  const sr = a.sampleRate;
  const total = Math.floor(sr * Math.min(2.6, (posMs / 1000) * 22 + 0.35));
  const buf = a.createBuffer(2, total, sr);
  const tp = (posMs / 1000) * sr;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // direct arrival — the shock front
    for (let i = 0; i < total; i++) {
      const t = i / tp;
      // Friedlander waveform
      const p = t < 12 ? (1 - t) * Math.exp(-t * 1.05) : 0;
      // turbulent combustion noise riding on the pressure wave, decaying fast
      const n = (Math.random() * 2 - 1) * Math.exp(-t * 0.55) * grit;
      d[i] = p + n * Math.abs(p) * 1.6 + n * 0.12 * Math.exp(-t * 2.2);
    }
    /* Ground reflection: the same front again a few ms later, softer and
     * duller. Slightly different per channel so it is not a mono comb. */
    const gd = Math.floor(sr * (0.011 + ch * 0.0026));
    for (let i = total - 1; i >= gd; i--) d[i] += d[i - gd] * 0.42;
  }
  return buf;
}

function playBuffer(
  a: AudioContext, buf: AudioBuffer, when: number, km: number, level: number
) {
  const src = a.createBufferSource();
  src.buffer = buf;
  const ch = farField(a, km, level);
  src.connect(ch.input);
  src.start(when);
}

/**
 * Filtered noise voice. `filt` is applied in order; the result is routed
 * through the distance chain so every layer is treated consistently.
 */
function noiseVoice(
  a: AudioContext, when: number, dur: number, km: number, level: number,
  filt: BiquadFilterNode[], env: (g: GainNode, t: number) => void,
  useBrown = false
): GainNode {
  const src = a.createBufferSource();
  src.buffer = useBrown ? brown(a) : noise(a);
  src.loop = true;
  src.playbackRate.value = 0.85 + Math.random() * 0.3;
  const g = a.createGain();
  let node: AudioNode = src;
  for (const f of filt) { node.connect(f); node = f; }
  node.connect(g);
  const ch = farField(a, km, level);
  g.connect(ch.input);
  env(g, when);
  src.start(when);
  src.stop(when + dur + 0.1);
  return g;
}

/* ------------------------------------------------------------------ */
/*  EVENTS                                                            */
/* ------------------------------------------------------------------ */

/**
 * MISSILE LAUNCH.
 * Three physical stages, not one envelope:
 *   1. igniter/squib crack and the canister lid blowing — a hard transient
 *   2. motor buildup: broadband roar amplitude-modulated at 18–30 Hz by
 *      combustion instability, which is the "tearing" quality of a real
 *      solid motor as opposed to smooth filtered hiss
 *   3. departure: the whole spectrum tilts down and away as the round leaves,
 *      with the reverb tail rising as the direct sound falls
 */
export function sfxLaunch(power = 1, km = 2) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime + propagation(km).delay;
  const dur = 2.6 * (0.7 + power * 0.5);

  duck(a, t, 0.45, 0.5);

  // 1. ignition crack — short, bright, percussive
  playBuffer(a, blastBuffer(a, 2.2, 0.85), t, km, 0.42 * power);

  // 2. motor roar, band-passed and sweeping down as it climbs away
  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(520, t);
  bp.frequency.exponentialRampToValueAtTime(150, t + dur);
  bp.Q.value = 0.85;
  const roar = noiseVoice(a, t, dur, km, 0.62 * power, [bp], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.16);
    g.gain.setValueAtTime(1, at + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  });

  /* Combustion instability — this is the detail that separates a rocket from
   * a hiss. Real motors chug in the 15–35 Hz band. Modulating gain rather
   * than filter frequency keeps it from sounding like a tremolo pedal. */
  const chug = a.createOscillator(); chug.type = 'triangle';
  chug.frequency.setValueAtTime(26 * (1 / power), t);
  chug.frequency.linearRampToValueAtTime(15, t + dur);
  const chugAmt = a.createGain(); chugAmt.gain.value = 0.3;
  chug.connect(chugAmt).connect(roar.gain);
  chug.start(t); chug.stop(t + dur + 0.05);

  // 3. low-frequency thrust body — brown noise, felt more than heard
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(220, t);
  lp.frequency.exponentialRampToValueAtTime(70, t + dur);
  noiseVoice(a, t, dur, km, 0.85 * power, [lp], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }, true);
}

/**
 * WARHEAD DETONATION (intercept kill).
 * A fragmentation warhead going off at altitude, heard from the ground.
 * `km` is the slant range to the burst — a 200 km exo-atmospheric kill should
 * be an almost inaudible far-off rumble, an 8 km terminal kill should hit
 * hard. That difference is now audible.
 */
export function sfxIntercept(scale = 1, km = 25) {
  const a = ac(); if (!a || !enabled) return;
  const p = propagation(km);
  const t = a.currentTime + p.delay;

  duck(a, t, 0.6, 0.6);

  /* The blast proper. Positive-phase duration scales with warhead mass:
   * a 23 kg SPYDER warhead snaps at ~3 ms, a 180 kg S-400 warhead at ~9 ms. */
  const posMs = 3 + 7 * scale;
  playBuffer(a, blastBuffer(a, posMs, 0.7), t, km, 1.35 * scale);

  // fireball roll-off: the low-frequency energy that arrives behind the front
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(900, p.cutoff), t);
  lp.frequency.exponentialRampToValueAtTime(90, t + 1.4);
  noiseVoice(a, t, 1.8, km, 0.8 * scale, [lp], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
  }, true);

  /* Fragment/debris: a sparse cloud of tiny transients rather than a smooth
   * noise band. Individual pieces of casing arriving separately is what makes
   * the tail sound like wreckage instead of static. Skipped at long range,
   * where air absorption would have removed it entirely. */
  if (km < 60) {
    const n = Math.round(14 * scale);
    for (let i = 0; i < n; i++) {
      const at = t + 0.05 + Math.random() * 0.9;
      const bp = a.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 3600;
      bp.Q.value = 1.6 + Math.random() * 3;
      noiseVoice(a, at, 0.09, km, 0.1 * scale, [bp], (g, w) => {
        g.gain.setValueAtTime(0, w);
        g.gain.linearRampToValueAtTime(1, w + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, w + 0.09);
      });
    }
  }
}

/**
 * GROUND IMPACT — a leaker striking the defended asset.
 * The heaviest cue in the app, and the one that should make the failure land
 * emotionally: a long positive phase (large charge), a strong ground-coupled
 * sub component, and a debris rain that runs for seconds.
 */
export function sfxImpact(km = 6) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime + propagation(km).delay;

  duck(a, t, 0.8, 1.6);

  // large-charge blast: ~26 ms positive phase
  playBuffer(a, blastBuffer(a, 26, 0.6), t, km, 1.8);

  /* Seismic coupling — energy through the ground arrives ahead of the air
   * blast and is almost pure sub-bass. Real, and it is why nearby explosions
   * are felt before they are heard. */
  const sub = a.createBufferSource();
  sub.buffer = brown(a); sub.loop = true;
  const slp = a.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 48;
  const sg = a.createGain();
  sg.gain.setValueAtTime(0, t - 0.06);
  sg.gain.linearRampToValueAtTime(1.5, t - 0.02);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  sub.connect(slp).connect(sg).connect(master!);
  sub.start(Math.max(0, t - 0.06)); sub.stop(t + 2.6);

  // fireball
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.exponentialRampToValueAtTime(70, t + 2.6);
  noiseVoice(a, t, 3.0, km, 1.1, [lp], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.0);
  }, true);

  // debris rain — heavier and longer than an air-burst
  for (let i = 0; i < 30; i++) {
    const at = t + 0.15 + Math.random() * 2.4;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 400 + Math.random() * 2800;
    bp.Q.value = 1.2 + Math.random() * 3;
    noiseVoice(a, at, 0.14, km, 0.14, [bp], (g, w) => {
      g.gain.setValueAtTime(0, w);
      g.gain.linearRampToValueAtTime(1, w + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, w + 0.14);
    });
  }
}

/**
 * JET — a fast, low-level pass.
 * NO oscillators. A military turbofan at low level is overwhelmingly
 * broadband: shear-layer roar in the low mids, a turbulent core, and a set of
 * narrow resonances from the compressor face. Using a sawtooth for the whine
 * was the single biggest reason the old cue read as "game".
 *
 * The pass is Dopplered by sweeping every filter band through the same ratio
 * curve — approaching, abeam, receding — which is what the ear actually uses
 * to judge that something flew past.
 */
export function sfxJet(dur = 4.0, km = 3) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime + propagation(km).delay * 0.3;
  const abeam = dur * 0.46;

  /* Doppler ratio: ~1.22 approaching, 1.0 abeam, ~0.80 receding.
   * Mach 0.85 at low level gives roughly this shift. */
  const applyDoppler = (f: number, node: AudioParam) => {
    node.setValueAtTime(f * 1.22, t);
    node.linearRampToValueAtTime(f * 1.18, t + abeam * 0.75);
    node.linearRampToValueAtTime(f * 0.80, t + abeam * 1.35);
    node.linearRampToValueAtTime(f * 0.74, t + dur);
  };

  const env = (g: GainNode, at: number, peak = 1) => {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak * 0.25, at + abeam * 0.55);
    g.gain.exponentialRampToValueAtTime(peak, at + abeam);
    g.gain.exponentialRampToValueAtTime(peak * 0.3, at + abeam * 1.5);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  };

  // 1. shear-layer roar — the body of the sound, brown noise, low-passed
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
  applyDoppler(420, lp.frequency);
  noiseVoice(a, t, dur, km, 1.0, [lp], (g, at) => env(g, at), true);

  // 2. turbulent core — mid-band, gives the "tearing air" quality
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.55;
  applyDoppler(950, bp.frequency);
  noiseVoice(a, t, dur, km, 0.5, [bp], (g, at) => env(g, at, 0.75));

  /* 3. compressor resonances. Narrow noise-band peaks, NOT tones — three of
   * them, detuned off a fundamental so no single pitch dominates and the ear
   * hears "machine" rather than "note". Only audible close in; air absorption
   * kills them beyond ~10 km. */
  if (km < 10) {
    for (const [mult, lvl, q] of [[1, 0.2, 15], [1.94, 0.13, 19], [3.07, 0.08, 22]]) {
      const pk = a.createBiquadFilter(); pk.type = 'bandpass'; pk.Q.value = q;
      applyDoppler(1180 * mult, pk.frequency);
      noiseVoice(a, t, dur, km, lvl, [pk], (g, at) => env(g, at, 0.9));
    }
  }
}

/**
 * DRONE / loitering munition — a two-stroke or small piston pusher-prop.
 * Characteristic buzz comes from blade-pass amplitude modulation of a noise
 * bed, roughly 90–140 Hz for a two-blade prop at typical RPM. Modelled by
 * ring-modulating noise with a slightly unstable LFO, which is why it wanders
 * instead of sitting on a synth pitch.
 */
export function sfxDrone(dur = 4.5, km = 4) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime + propagation(km).delay * 0.3;

  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = 620; bp.Q.value = 0.8;
  const body = noiseVoice(a, t, dur, km, 0.3, [bp], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  });

  // blade-pass modulation, drifting in RPM the way a real airframe does
  const bpf = a.createOscillator(); bpf.type = 'sawtooth';
  bpf.frequency.setValueAtTime(104, t);
  bpf.frequency.linearRampToValueAtTime(118, t + dur * 0.5);
  bpf.frequency.linearRampToValueAtTime(97, t + dur);
  const amt = a.createGain(); amt.gain.value = 0.85;
  bpf.connect(amt).connect(body.gain);
  bpf.start(t); bpf.stop(t + dur + 0.05);

  // slow RPM wander
  const wow = a.createOscillator(); wow.type = 'sine'; wow.frequency.value = 0.7;
  const wg = a.createGain(); wg.gain.value = 5;
  wow.connect(wg).connect(bpf.frequency);
  wow.start(t); wow.stop(t + dur + 0.05);
}

/**
 * BALLISTIC RE-ENTRY / supersonic overflight — a sonic boom.
 * A genuine double crack: bow shock and tail shock separated by the N-wave
 * duration, which for a missile-sized body is 60–120 ms. Then the rumble of
 * the wake.
 */
export function sfxSonicBoom(km = 20) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime + propagation(km).delay;
  duck(a, t, 0.5, 0.4);
  playBuffer(a, blastBuffer(a, 5, 0.35), t, km, 1.1);
  playBuffer(a, blastBuffer(a, 5, 0.35), t + 0.085, km, 0.85);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.exponentialRampToValueAtTime(60, t + 1.6);
  noiseVoice(a, t + 0.09, 1.8, km, 0.5, [lp], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
  }, true);
}

/**
 * AIRSPACE ALERT — a real air-raid siren, not a UI beep.
 * Electromechanical sirens produce a rich harmonic stack from a chopper wheel,
 * with the whole spectrum sliding as the rotor spins up and coasts down. Built
 * from a summed harmonic series through a horn-shaped resonance, then given
 * the same distance treatment as everything else so it sits outdoors.
 */
export function sfxAlert(km = 1.2) {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;
  const dur = 3.6;

  const horn = a.createBiquadFilter(); horn.type = 'bandpass';
  horn.frequency.value = 900; horn.Q.value = 1.1;
  const ch = farField(a, km, 0.3);
  horn.connect(ch.input);

  const bus = a.createGain();
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(1, t + 0.5);
  bus.gain.setValueAtTime(1, t + dur - 1.1);
  bus.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  bus.connect(horn);

  /* Chopper-wheel harmonics. A real siren's timbre comes from the ports being
   * square-ish, so odd harmonics dominate; amplitude falls as 1/n. */
  const f0 = 300;
  for (let n = 1; n <= 9; n++) {
    const o = a.createOscillator();
    o.type = 'sine';
    const set = (mult: number) => {
      o.frequency.setValueAtTime(f0 * n * 0.72, t);
      o.frequency.linearRampToValueAtTime(f0 * n * 1.0, t + 1.2);      // spin-up
      o.frequency.setValueAtTime(f0 * n * 1.0, t + dur - 1.4);
      o.frequency.linearRampToValueAtTime(f0 * n * 0.68 * mult, t + dur); // coast-down
    };
    set(1);
    const g = a.createGain();
    g.gain.value = (n % 2 ? 0.5 : 0.16) / n;
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // rotor air noise, so it is not a pure additive stack
  const rb = a.createBiquadFilter(); rb.type = 'bandpass';
  rb.frequency.value = 1500; rb.Q.value = 0.7;
  noiseVoice(a, t, dur, km, 0.07, [rb], (g, at) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  });
}

/**
 * RADAR LOCK — deliberately the one electronic cue in the app, because it is
 * an electronic event: it is a console tone in the fire-control cabin, not
 * something happening in the sky. Kept short, dry and quiet so it reads as
 * equipment rather than as a game pickup.
 */
export function sfxLock() {
  const a = ac(); if (!a || !enabled) return;
  const t = a.currentTime;
  for (let i = 0; i < 2; i++) {
    const at = t + i * 0.075;
    const o = a.createOscillator(); o.type = 'square';
    o.frequency.value = 1420;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1420; bp.Q.value = 8;
    const g = a.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.055, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
    o.connect(bp).connect(g).connect(master!);
    o.start(at); o.stop(at + 0.07);
  }
}

/**
 * AMBIENT BED — the acoustic floor. Without it, silence between events makes
 * every cue sound pasted on. Wind through a filter with a slow LFO, plus a
 * distant generator hum from the battery site.
 */
export function startBed() {
  const a = ac(); if (!a || !enabled || bed) return;
  const t = a.currentTime;

  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.055, t + 2.6);
  g.connect(master!);
  duckTarget = g;

  // wind: brown noise through a wandering low-pass
  const wlp = a.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 300;
  const wind = a.createBufferSource(); wind.buffer = brown(a); wind.loop = true;
  const wg = a.createGain(); wg.gain.value = 1;
  wind.connect(wlp).connect(wg).connect(g);
  wind.start();

  // gusting — two detuned LFOs so it never loops audibly
  const l1 = a.createOscillator(); l1.type = 'sine'; l1.frequency.value = 0.073;
  const l1g = a.createGain(); l1g.gain.value = 120;
  l1.connect(l1g).connect(wlp.frequency);
  const l2 = a.createOscillator(); l2.type = 'sine'; l2.frequency.value = 0.031;
  const l2g = a.createGain(); l2g.gain.value = 0.4;
  l2.connect(l2g).connect(wg.gain);
  l1.start(); l2.start();

  // distant site generator — 50 Hz mains hum plus its third, very low
  const hum = a.createOscillator(); hum.type = 'sine'; hum.frequency.value = 50;
  const hum3 = a.createOscillator(); hum3.type = 'sine'; hum3.frequency.value = 150;
  const hg = a.createGain(); hg.gain.value = 0.05;
  const hg3 = a.createGain(); hg3.gain.value = 0.016;
  hum.connect(hg).connect(g); hum3.connect(hg3).connect(g);
  hum.start(); hum3.start();

  bed = {
    stop: () => {
      const now = a.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      duckTarget = null;
      setTimeout(() => {
        for (const n of [wind, l1, l2, hum, hum3]) {
          try { n.stop(); } catch { /* already stopped */ }
        }
      }, 900);
    },
  };
}

export function stopBed() {
  if (bed) { bed.stop(); bed = null; }
}
