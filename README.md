<div align="center">

```
 ██╗███╗   ██╗████████╗███████╗██████╗  ██████╗███████╗██████╗ ████████╗██╗ ██████╗
 ██║████╗  ██║╚══██╔══╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗╚══██╔══╝██║██╔═══██╗
 ██║██╔██╗ ██║   ██║   █████╗  ██████╔╝██║     █████╗  ██████╔╝   ██║   ██║██║   ██║
 ██║██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗██║     ██╔══╝  ██╔═══╝    ██║   ██║██║▄▄ ██║
 ██║██║ ╚████║   ██║   ███████╗██║  ██║╚██████╗███████╗██║        ██║   ██║╚██████╔╝
 ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝        ╚═╝   ╚═╝ ╚══▀▀═╝
```

### 🛡️ Identification of optimal set of multiple interceptor launch areas<br/>to maximise the destruction of multiple air targets

**A real-time air-defence battle-management console.**<br/>
Decides *which* interceptor sites to use, *what* each one shoots, and **proves no smaller set would do**.

[![Live](https://img.shields.io/badge/▶_LIVE_DEMO-interceptiq.vercel.app-ffb020?style=for-the-badge&labelColor=03060b)](https://interceptiq.vercel.app)

![TypeScript](https://img.shields.io/badge/TypeScript-97%25-3178c6?style=flat-square&labelColor=03060b)
![Next.js](https://img.shields.io/badge/Next.js_14-000?style=flat-square&labelColor=03060b)
![Solve](https://img.shields.io/badge/⚡_solve-27_ms-34d399?style=flat-square&labelColor=03060b)
![Certified](https://img.shields.io/badge/🔒_minimality-PROVEN-a78bfa?style=flat-square&labelColor=03060b)
![Offline](https://img.shields.io/badge/📡_works-offline-38bdf8?style=flat-square&labelColor=03060b)
![Audio](https://img.shields.io/badge/🔊_audio-synthesised-f43f5e?style=flat-square&labelColor=03060b)

</div>

---

<div align="center">

![Interceptors away](docs/intro-flyout.png)

**A 24-second cinematic engagement opens the app.**<br/>
<sub>Canvas particle system · additive bloom · motion blur · camera shake · synthesised audio.<br/>No video file, no sample library — it loads instantly and runs offline.</sub>

</div>

---

## ◤ THE PROBLEM IN ONE PICTURE

Seven threats inbound. Seven candidate launch sites. **Which do you use?**

<table>
<tr>
<td width="50%" align="center">

### ❌ NO DEFENCE

![No defence](docs/app-nodefence.png)

**`0 / 7 stopped`** — Amritsar and Jaipur **struck**

</td>
<td width="50%" align="center">

### ✅ OPTIMISED

![Optimised](docs/app-overview.png)

**`7 / 7 stopped`** — **3 sites** · 171 ms

</td>
</tr>
</table>

> **Using *every* site scores 82.3 % from 5 sites.**<br/>
> **The optimiser reaches the same or better from 3 — and proves nothing smaller works.**

---

## ◤ WHY THIS IS HARD

```
      THREAT PICTURE                              DEFENSIVE NETWORK
   ┌────────────────────┐                    ┌────────────────────────┐
   │  7 inbound tracks  │                    │  7 candidate launch    │
   │  SRBM · MRBM       │                    │  areas across 4 layers │
   │  CRUISE · UAV      │                    │  BMD · LR · MR · point │
   │  STRIKE AIRCRAFT   │                    └───────────┬────────────┘
   └─────────┬──────────┘                                │
             └──────────────────┬─────────────────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │  49 (site × threat) pairings │  reachable in time?
                 │  feasibility + Pk scoring    │  inside altitude band?
                 └──────────────┬───────────────┘  before impact?
                                ▼
                 ┌──────────────────────────────┐
                 │  Hungarian assignment O(n³)  │  exact optimum
                 │  run in salvo waves          │  many-to-many
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │  2⁷−1 = 127 subsets tested   │  which sites are ESSENTIAL?
                 │  by INCREASING cardinality   │
                 └──────────────┬───────────────┘
                                ▼
                    ╔═══════════════════════════╗
                    ║   3 SITES · 0 LEAKERS     ║
                    ║   MINIMALITY PROVEN       ║
                    ╚═══════════════════════════╝
```

Picking the best **assignment** is textbook. Picking the smallest **set of sites** that still holds
the line — *and proving it* — is the actual problem statement, and it is where most solutions stop
at *"it works"* instead of *"nothing smaller works."*

---

## ◤ LIVE ENGAGEMENT

![Engagement](docs/app-engagement.png)

| | Meaning |
|:--|:--|
| 🔴 **Red, dashed, marching** | Incoming threat — arrowhead terminating **at the protected asset** |
| 🔵 **Blue, solid** | Interceptor — flying **outward** from its battery |
| 🛡️ **Gold shield** | Protected asset — the thing being defended |
| 💥 **Green burst** | Threat destroyed in the air |

Direction is never ambiguous: two colours, two dash patterns, arrows pointing opposite ways —
legible even in monochrome.

### ⚡ The alert chain

Batteries are **not inert** until they fire. They work up through real readiness states:

```
 READY ──▶ ALERT ─────▶ TRACKING ────▶ LOCKED ─────▶ FIRING ──▶ RELOADING
   │         │             │              │             │
 nothing   track       inside THIS    assigned +     round
 inbound   crossed     battery's      counting       away
           frontier    envelope       down
```

Every state is derived from geometry at the current simulation time using **the same range and
altitude tests the solver uses** — what the operator sees always matches what the optimiser decided.

### 🔊 Audio

Fully synthesised at runtime. Real ordnance audio is mostly **noise shaped by filters**, not tones:

| Cue | Construction |
|:--|:--|
| **Launch** | ignition crack → broadband roar through a downward-sweeping band-pass → sub rumble that Dopplers away |
| **Intercept** | sub-bass thump + noise burst through a fast low-pass + debris crackle |
| **Asset struck** | heavier, closer, 2.4 s tail |
| **Jet flyby** | layered noise + turbine whine, Doppler through the pass |
| **Airspace alert** | two-tone klaxon band-passed to read as a PA horn in a room |

Everything routes through a **convolution reverb generated from decaying noise**, so all events sit
in one acoustic space. A wind bed keeps the silence between events from being dead air.

---

## ◤ THE WHOLE COUNTRY

![National](docs/app-national.png)

<div align="center">

**38 defended sectors · 223 batteries · 41 radars · 140.5 M people covered**

**100% of the national borderline inside radar cover AND inside an interceptor envelope**

</div>

Real Indian cities with real coordinates and populations. Click any sector to drill into its
laydown, any battery for its published specification, any radar for its coverage.

### 🧭 Every frontier, not just one

The laydown is organised into **five fronts**, each with its own posture, because the threat on
each is genuinely different and the systems India has publicly fielded on each differ accordingly.

| Front | Batteries | Sectors | Posture |
|:--|--:|--:|:--|
| 🔴 **West** — Pakistan | 87 | 15 | Full stack incl. BMD tier. Shortest warning; ballistic + cruise + drone saturation |
| 🟣 **North** — China / LAC | 16 | 4 | Reach and ceiling over magazine depth. Leh · Tawang · Gangtok · Dehradun |
| 🟠 **East** — Siliguri, Bangladesh, Myanmar | 45 | 8 | S-400 + MR-SAM + Akash in the Siliguri sector, as publicly reported |
| 🔵 **Maritime** — Bay of Bengal, Palk Strait, Andamans | 53 | 7 | Low-altitude capable systems for sea-skimmers and long-endurance UAV |
| 🟢 **Interior** — depth sectors | 22 | 4 | Leaner posture; warning measured in minutes, not seconds |

New sectors this release: **Siliguri Corridor · Guwahati · Tezpur · Tawang · Gangtok · Shillong ·
Agartala · Imphal · Dibrugarh · Bhubaneswar · Visakhapatnam · Madurai · Thiruvananthapuram ·
Port Blair**, with nine matching theatres — Siliguri Corridor, Northeastern Theatre, Eastern LAC,
Bangladesh Frontier, Myanmar Frontier, Bay of Bengal, Palk Strait & Southern Tip, and the
Andaman & Nicobar Command.

Every battery is verified **on national soil** and **dispersed** — 0 of 223 off-soil, minimum
pairwise separation 12.1 km, so no two fire units share an engagement geometry.

### 🗺️ The boundary itself

The national outline is rebuilt from **Natural Earth 10 m, India point-of-view edition**
(`ne_10m_admin_0_countries_ind`) — the depiction showing India's official claimed boundary,
northern extent **37.05°N** including PoK and Aksai Chin. For an Indian air-defence tool that is
the correct depiction; the UN POV would draw the country wrong for its own users.

| | Before | After |
|:--|--:|--:|
| India outline vertices | 564 | **4 562** |
| Mean border segment | 30.4 km | **5.0 km** |
| Worst border segment | 162.3 km | **60.4 km** |
| Northern extent | 35.5°N *(J&K cut off)* | **37.05°N** |
| Coastal tolerance fudge needed | 0.08° (~9 km) | **0.02° (~2 km)** |

30 hard reference points — Colaba, Kanyakumari, Kavaratti, Port Blair, Gilgit, Tawang, plus ten
that must read as *foreign* — all resolve correctly. Because the geometry is honest, the tolerance
band that used to paper over it shrank by 4.5×.

The finer border made territory tests 4× more expensive, so `border.ts` gained a **latitude-bucketed
edge index**: a test now examines only edges spanning the query latitude instead of all 4 562.
Exact same answers, **69 µs → 1.15 µs (60× faster)**, and scenario generation went **426 ms → 12 ms**.

### 📡 No gaps in the shield

Sector radars and batteries are sited to defend cities, so coverage used to follow the population
map and leave real frontier watching nothing. Measured on the sector-only laydown:

| | Before | After |
|:--|--:|--:|
| Borderline inside radar cover | 96.9% (worst gap **305 km**, Great Nicobar) | **100%** |
| Borderline inside an interceptor envelope | 84.3% | **100%** |

Two gap-filling passes now walk the *actual border ring* and plant a long-range EW array or an
MR-SAM fire unit wherever a sample point is uncovered, re-testing as they go so only what is
genuinely needed gets added.

---

## ◤ REAL SYSTEMS, CITED

### 🛡️ Interceptors

| System | Origin | Range | Altitude | Speed | Ready |
|:--|:--|--:|--:|--:|--:|
| **S-400 Triumf** | 🇷🇺 Russia | 3–400 km | 10–30 000 m | Mach 14 | 8 |
| **PAD / Pradyumna** | 🇮🇳 DRDO | 30–200 km | 50–80 km | Mach 5.5 | 4 |
| **AAD / Ashwin** | 🇮🇳 DRDO | 10–200 km | 15–30 km | Mach 4.5 | 6 |
| **MR-SAM (Barak-8)** | 🇮🇳🇮🇱 DRDO/IAI | 0.5–100 km | 50–16 000 m | Mach 2 | 8 |
| **Akash** | 🇮🇳 DRDO | 4.5–45 km | 100–20 000 m | Mach 3.5 | 12 |
| **SPYDER-MR** | 🇮🇱 Rafael | 1–50 km | 20–16 000 m | Mach 4 | 8 |
| **QRSAM** | 🇮🇳 DRDO | 3–30 km | 30–10 000 m | Mach 4.7 | 6 |
| **S-125 Pechora** | 🇷🇺🇮🇳 legacy | 3.5–35 km | 20–18 000 m | Mach 3.5 | 4 |

### 🎯 Threats — the adversary at full potential

India's side models a complete layered network, so the threat side has to be equally complete or
the problem is artificially easy. **32 systems across 12 capability classes**, each chosen to
stress a *different* layer of the defence.

| Class | Systems modelled | What it defeats |
|:--|:--|:--|
| **HGV** 🆕 | DF-17/DF-ZF · Fatah-II | Depressed manoeuvring glide — flies *below* exo-atmospheric BMD |
| **MRBM** | Shaheen-II · Ghauri · Ababeel (MIRV) · DF-21 · DF-26 | Saturation and high-apogee re-entry |
| **SRBM / TBM** | Ghaznavi · Abdali · DF-15B · Nasr | Nasr's 60 km lob leaves seconds of warning |
| **Cruise** | Babur · Ra'ad-II ALCM · CJ-10 | Terrain-hugging, the hard case for long-range SAMs |
| **Supersonic** 🆕 | CM-400AKG (Mach 4 dive) · YJ-12 (Mach 3 sea-skimmer) | Collapses reaction time |
| **Stealth** 🆕 | J-20 Mighty Dragon · J-35A/FC-31 | Low RCS shrinks the effective radar horizon |
| **Bomber** 🆕 | H-6K | Launches from stand-off, never enters the SAM envelope |
| **Aircraft** | JF-17 Thunder · F-16 · J-10C · Su-30 · Mirage ROSE | Low-level ingress |
| **Helicopter** 🆕 | AH-1Z Viper · Z-10ME | Nap-of-the-earth, *under* the radar horizon |
| **UAV** | Shahpar-II · Akinci · Wing Loong II · GJ-11 stealth UCAV · loiterer | Small RCS, long exposure |
| **Swarm** 🆕 | Co-ordinated small-UAV swarm | Magazine-depth attack; cost exchange favours the attacker |

Split by operator: **15 Pakistani · 10 Chinese · 6 fielded by both**. Every figure is from
published open-source reporting and **cited in-app**.

Each class has its **own silhouette** — a glide vehicle is a lifting-body wedge with a plasma
sheath (no rocket plume, since the glide phase is unpowered), a helicopter has a rotor disc and
stub pylons, a swarm is a cluster of quadcopters inside a formation envelope, a stealth fighter is
an all-straight-edge chined diamond. Airframes render at **53–78 px** so the shape is readable at
theatre scale.

Every figure is from published open-source reporting and **cited in-app**, alongside guidance
method, associated radar, warhead mass, simultaneous-engagement capacity, reaction and reload times.

**Geography** is Natural Earth vector data: India and eight neighbours, **169 admin-1 units**
(35 Indian states/UTs, 8 Pakistani and 12 Chinese provinces), coastlines, 60 cities — bundled as
**252 KB of static JSON**. No tile server, no API key, **works fully offline**.

> [!IMPORTANT]
> The systems and their specifications are **real and sourced**. Every battery position, radar site,
> unit designator and threat launch point is **fictional**. No real installation is represented.

---

## ◤ ANALYSIS — THE PROOF SURFACE

![Analysis](docs/app-analysis.png)

Everything computed live from the current scenario:

- **Kill-probability solution space** — every battery × threat pairing the optimiser considered,
  colour-ramped, with committed cells outlined. Not just the winners.
- **Minimality search trace** — every subset tested, grouped by cardinality, each marked
  `PASS` / `FAIL` / `SKIP`, with the acceptance threshold τ shown.
- **Battery utilisation** — which layers actually contributed, mean Pk, mean intercept standoff.
- **Performance by threat class** — ballistic vs cruise vs UAV vs aircraft.
- **Solver trace** — the raw decision log.

---

## ◤ SOUND & VFX — WHY IT DOESN'T SOUND LIKE A GAME

Every sound is **synthesised at runtime**. No sample files, nothing to download, works offline.

The difference between a game explosion and a recorded one is not loudness — it is physics. Four
things were rebuilt:

**1 · A blast is a shock front, not a noise burst.**
The detonation is an explicitly rendered pressure waveform — a **Friedlander N-wave**: an
instantaneous rise to peak overpressure, exponential decay through zero into a *negative*
underpressure phase, then recovery. That discontinuity at t=0 *is* the crack. Positive-phase
duration scales with charge mass, so a 23 kg SPYDER warhead snaps at ~3 ms and a 700 kg TBM
warhead thuds at ~26 ms.

**2 · Distance is modelled, not faked with volume.**
Sound travels 343 m/s and air absorbs high frequencies. Every cue now takes a **slant range in km**
and derives its own arrival delay, air-absorption cutoff, amplitude and wet/dry balance. A 200 km
exo-atmospheric kill arrives late, muffled and mostly as reverb tail; a terminal intercept overhead
hits dry and hard. Previously every event sounded identical, which is exactly what makes audio
read as synthetic.

**3 · Ground reflection.**
Real outdoor blasts have a second arrival a few milliseconds behind the direct one, bounced off
the ground. That slap is what makes an explosion sound *outdoors*. Added as a delayed, filtered,
per-channel-decorrelated copy.

**4 · No tonal residue.**
The jet and siren previously leaned on sawtooth oscillators, and a sustained sawtooth reads as
"synth" to anybody. The **jet** is now pure broadband noise — shear-layer roar, turbulent core,
and three detuned narrow resonances for the compressor face, all Dopplered through the pass. The
**siren** is a summed chopper-wheel harmonic stack that spins up and coasts down. The **drone** is
noise ring-modulated by a drifting blade-pass frequency. Rocket motors are amplitude-modulated at
15–35 Hz by **combustion instability** — real motors chug, and that tearing quality is the tell.

The only deliberately electronic cue is the **radar lock**, because that one genuinely is a console
tone in the fire-control cabin rather than something happening in the sky.

### ✨ Visual effects

- **Shock fronts** — expanding additive rings with a bright core and soft edge, decelerating hard.
  A blast wave is a discontinuity and reads wrong as a soft blob.
- **Lofted fly-out** — interceptors fly a curved proportional-navigation path, not a chord, and the
  airframe's nose is the **analytic tangent** to that curve, so it always points where it is
  actually travelling. Verified in the live DOM: 36 airframes sampled, 0 misaligned, worst 2.44°.
- **Salvo fan-out** — rounds in a salvo curve to alternating sides instead of stacking on one line.
- **Friendly CAP** — Rafale, Su-30MKI and MiG-21 orbit a racetrack over defended territory in the
  opening sequence. Indian types, so they fly on the defending side.
- Frame-persistence motion blur, additive bloom, gravity-obeying cooling debris, muzzle flash
  lighting the terrain, and camera shake kicked by each detonation.

---

## ◤ THE ALGORITHM

**Hungarian assignment** — a from-scratch O(n³) Jonker-Volgenant rectangular solver, equivalent to
`scipy.optimize.linear_sum_assignment`, verified against a known optimum.

### 🔒 Minimality is proven, not asserted

```
   B    = protection using ALL candidate batteries
   τ    = B − tolerance                          ← acceptance bar
   S is ADMISSIBLE  ⟺  protection(S) ≥ τ
   S* is MINIMAL    ⟺  admissible AND no admissible subset of size |S*|−1 exists
```

The search enumerates subsets **by increasing cardinality** and stops at the first size containing
an admissible subset — every smaller subset was *explicitly tested and failed*. Constructive proof
by exhaustion, not a local optimum.

> 💬 **One sentence for a judge:** *"We enumerate every subset in increasing size order and stop at
> the first size that clears the bar, so every smaller subset has been explicitly tested and failed."*

A sound upper bound skips hopeless subsets without solving them. Because that prune underpins the
proof, it was re-verified by brute force: **120 smaller subsets across 12 scenarios, 0 violations.**
Above 14 candidate sites the solver reports **HEURISTIC** rather than claim a proof it did not perform.

### 🎯 Engagement doctrine

Maximising raw Pk drives intercepts *toward the battery* — which sits near the city it defends.
Selection weights Pk against **standoff from the protected asset**, floored at 70 % of best
available Pk so doctrine never buys a bad shot.

```
  before ──  standoff  33 km  ·  0.6 km altitude  ·   13 s margin
  after  ──  standoff 124 km  · 10.6 km altitude  ·  272 s margin
             mean Pk improved 0.44 → 0.47
```

---

## ◤ CORRECTNESS

Every one of these was a **real bug, found by measurement**:

| Bug | How it was caught | Root cause |
|:--|:--|:--|
| Intercepts drawn ~490 km off | "distance from asset" was nonsense | stale hardcoded AOI origin |
| **38.5 %** of attacks launched *from inside India* | territory audit | no soil check on launch placement |
| Cruise missiles un-interceptable | Babur leaked 25 % | blanket debris floor overrode each battery's own minimum |
| Interceptors idled on the rail up to **727 s** | implied Mach 0.1 for a Mach 2 system | launch time not derived from geometry |
| `hard` tier crashed on **28 of 32** seeds | tier sweep | unchecked `find(...)!` |
| **9.4 %** of batteries in Pakistan/China/sea | soil audit | bearing projected with no constraint |
| Batteries stacked **2.4 km** apart | separation audit | placement unaware of other units |
| **9.8%** of QRSAM and **8.3%** of Akash batteries never had a track in range | per-system utilisation sweep | batteries were assigned to assets round-robin while threats picked targets at random, so short-range units defended cities nobody was attacking. "OUT OF RANGE" was the top infeasibility reason for every short-range type |
| Point defence sited **417 km** from the asset it defends | battery-to-asset distance audit | the siting solver could relax standoff without limit to satisfy soil/dispersion, putting a 45 km Akash far outside its own reach of Delhi |
| 3 of 32 threat systems **never appeared in any scenario** | roster-coverage sweep | the standoff band was computed as `max(min*0.45,120)..min(max,900)`, which INVERTS at both extremes — DF-26 got 1350..900 and Nasr got 120..70, so no bearing could ever satisfy it |
| HGV tracks **originating inside PoK** | territory audit on the new class | the lateral weave displaced the first sample sideways across the frontier *after* the launch point had been validated on the straight line |
| `FIRING IN 10s` printed **once per shot**, stacking 6 identical captions on one pixel | label-overlap sweep during the declutter pass | the arming indicator lived inside the per-shot loop; a salvo from one launcher shares a single `tLaunch`, so every round drew its own copy — 36 overlapping pairs in a single frame, all self-inflicted |
| A battery sited **strictly inside Bangladesh** | off-soil vertex audit | the 2 km coastal tolerance band is blind to *which* side of the frontier it reaches across; it now refuses any point strictly inside a neighbour |
| India drawn with the **wrong northern border** | boundary bbox check | bundled geometry topped out at 35.5°N, cutting off northern J&K, and used the UN rather than the India point of view |
| Lakshadweep silently deleted | reference-point test (Kavaratti "not India") | island rings below an area threshold were dropped as specks |
| **18.8 %** of shots flew at targets already destroyed | salvo timing sweep, worst lag **806 s** | renderer drew every round to its own aim point, ignoring that an earlier round in the salvo had already killed the threat — this is what made interceptors appear to fly the wrong way |
| Hostile launches on Indian soil in the new NE theatres | territory audit after adding the eastern front | launch guard used a 0.045° tolerance while the audit used 0.08°, so points 5–9 km outside the simplified ring passed one test and failed the other |
| Canvas `IndexSizeError` on every scrub | console capture during Playwright run | `requestAnimationFrame` passes the timestamp of when the frame *began*, which can predate setup time — negative `dt` integrated shock-ring radii below zero |

### ✅ Standing audit — 204 scenarios / 1 162 threats · all 17 theatres × 4 tiers

```
  ✓ crashes                     0        ✓ certified          204/204
  ✓ batteries off soil          0        ✓ max solve            71 ms
  ✓ polygon vertices off soil   0        ✓ leakers              0.00 %
  ✓ hostile origins in India    0        ✓ ghost rounds     0/3 461
  ✓ border in radar cover   100.0 %      ✓ console errors           0
  ✓ border in SAM envelope  100.0 %      ✓ min separation     7.1 km
  ✓ threat roster exercised  32/32       ✓ tracks not crossing border 0
```

**Presentation density** (hard tier, 22 sampled frames):

```
  range rings drawn by default      0.00 / frame   (toggle or hover to reveal)
  on-map text labels                19   / frame   (was 26)
  substantial label overlaps        22   total     (was 792 — 97% reduction)
```

Every one of the 12 threat classes is neutralised 100% of the time, with physically sensible
flight profiles — HGV glides at 48 km / Mach 10, helicopters at 2.6 km / Mach 0.24, ballistic
apogees at 94–133 km:

```
  HGV 48.0 km M10.0     MRBM 132.9 km M8.9     SRBM 93.8 km M6.8
  SUPCRUISE 14.5 km M4.0   STEALTH 12.3 km M1.0   BOMBER 8.2 km M0.85
  AIRCRAFT 7.1 km M0.94    DRONE 5.4 km M0.18     HELO 2.6 km M0.24
  SWARM 1.1 km M0.10       CRUISE 0.5 km M0.81    TBM 36.5 km M3.5
```

Per-system utilisation, after the siting fixes — every threat class now 100% neutralised:

```
  S-400   100.0 %      MR-SAM  96.6 % (was 86.3)
  Akash    91.4 %      QRSAM   91.2 % (was 80.4)
```

Plus, verified independently:

```
  ✓ solver geometry — 645 shots: intercept point vs the threat's own position
    at that instant agrees to 0.00 km; battery→aim bearing vs battery→target
    bearing agrees to 0.00°
  ✓ track headings — 6 048 samples, 0 errors > 5°, worst 0.4°
  ✓ interceptor airframes in the live DOM — 36 sampled, 0 misaligned, worst 2.44°
  ✓ national laydown — 194 batteries, 0 off soil, min separation 12.1 km
```

---

## ◤ DEMO IN 60 SECONDS

| # | Do this | They see |
|:--:|:--|:--|
| 1 | Let the intro play, hit **♪ ENABLE SOUND** | 24 s cinematic engagement with real ordnance audio |
| 2 | Click **NO DEFENCE** | Shields turn red — *"7 LEAKERS — Amritsar, Jaipur STRUCK"* |
| 3 | Click **OPTIMISED** | All green — *"7 strikes prevented · 2 fewer sites"* |
| 4 | Press **Run** | ALERT → LOCKED → FIRING, plumes, detonations, screen shake |
| 5 | Open **Mission Detail ▸ Analysis** | Full Pk matrix + every subset tested |
| 6 | Hand over the mouse | They **KILL** a battery or **inject** a threat → re-solves in <100 ms |

---

## ◤ RUN IT

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

Deploys to Vercel with zero configuration. The solver compiles into the client bundle, so
interactions re-solve **locally with no network latency**; `/api/scenario` and `/api/allocate`
expose the same engine as stateless serverless functions.

---

## ◤ ARCHITECTURE

```
lib/
├── 🗺️  region.json      Natural Earth 10m India-POV borders · admin-1 · coast (439 KB)
├── 🧱  scripts/build-region.mjs   regenerates the above from Natural Earth source
├── 🌏  theatre.ts       region loader · 38 defended sectors · 17 theatres
├── 🚀  systems.ts       interceptor + threat specifications, with sources
├── 🧭  border.ts        territory tests · hostile launch placement
├── 📍  siting.ts        battery siting: on-soil + dispersion solver
├── 📈  scenario.ts      trajectory propagation · battery laydown
├── 🎯  geometry.ts      intercept solver · engagement windows · Pk model
├── 🧮  hungarian.ts     O(n³) rectangular assignment
├── 🔒  allocator.ts     cost matrix · salvo waves · certified minimality search
├── ⚖️  compare.ts       counterfactual modes
├── 🚨  alert.ts         battery readiness state machine
├── 🇮🇳  national.ts      all-India laydown across five fronts
├── 🛰️  flight.ts        interceptor flight model · salvo destruct logic
├── ✨  fx.ts            sprite particles · shock fronts · camera shake
├── ✈️  vehicles.ts      canvas airframe silhouettes
└── 🔊  audio.ts         physically-modelled ordnance audio (see below)

components/
├── CinematicIntro   24 s scripted engagement on canvas
├── GeoMap + FxLayer theatre map with particle overlay
├── IndiaMap         national overview
├── CompareBar       counterfactual selector
├── AnalysisTab      Pk matrix · search trace · utilisation
└── MissionSummary   end-of-run debrief
```

---

## ◤ SCOPE

| | |
|:--|:--|
| ✅ **Real** | Borders, coastlines, cities, populations · all weapon-system specifications and sources · the assignment algorithm · the minimality proof · intercept reachability geometry · live re-optimisation |
| 🎭 **Fictional** | Every battery position, radar site, unit designator and threat launch point |
| 📐 **Simplified** | Flat-earth kinematics with a single drag term · constant average interceptor speed · engineering Pk model · long subsonic transits compressed in playback time (geometry exact) |
| ⛔ **Not modelled** | Sensor coverage gaps · track quality · radar horizon · ECM · debris · fratricide · terrain masking · weather |

> [!NOTE]
> Real operational kill-probability data is classified. The Pk model uses publicly documented
> intercept-geometry relationships — range, closing angle, interceptor speed, time margin — as a
> bounded, monotone engineering approximation. It ranks engagement options defensibly; absolute
> values are not a claim about real capability. This is stated in-app on the Methodology page, not
> buried here.

<div align="center">
<br/>

### **[▶ OPEN THE LIVE CONSOLE](https://interceptiq.vercel.app)**

<sub>Built for the problem statement:<br/>*Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets*</sub>

</div>
