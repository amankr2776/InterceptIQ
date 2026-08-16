# InterceptIQ

### Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets

**Live:** https://interceptiq.vercel.app

Tactical command-and-control prototype for **optimal interceptor launch-area selection** over the Indian subcontinent.

> Identify the optimal set of land-based launch locations to maximise kill probability against multiple inbound air targets — the output being the **minimal subset** of candidate deployment areas.

---

## The one-minute demo

1. Open **Overview**. The headline reads e.g. *"2 of 6 interceptor sites selected · all 5 of 5 threats neutralised · 63 ms to solve."*
2. Click **NO DEFENCE** in the compare bar. Same attack, no interceptors — Amritsar and Jaipur shields turn red, verdict reads *"5 LEAKERS — Amritsar, Jaipur STRUCK."*
3. Click **OPTIMISED**. Everything turns green again. The strip quantifies it: *"vs no defence: 5 strikes prevented · vs all-sites: 2 fewer sites."*
4. Press **Run** (defaults to 25×, first engagement ~12 s). Watch red threats cross the border, batteries go ALERT → LOCKED → FIRING, blue interceptors fly out, green bursts.
5. Hand it over: **KILL** any battery, or **Inject threat** and click anywhere on the map. Everything re-solves in under 100 ms.

---

## Four pages

| Page | Purpose |
|---|---|
| **Overview** `/` | Headline result, counterfactual compare bar, live map, 3-step explainer |
| **Mission Detail** `/mission` | Fire Plan (default), Mission Timeline, Event Log, Site Inspector |
| **Methodology** `/methodology` | 5-step algorithm walkthrough, Pk model, real-vs-simulated, live benchmark |
| **National Map** `/national` | All-India laydown — 24 sectors, 130 batteries, 24 radars, 130 M people covered |

---

## What makes the result legible

**Counterfactual comparison.** The optimiser's answer means nothing without alternatives. Five modes, all solved live on the same scenario in ~200 ms — nothing pre-computed:

| Mode | Typical result |
|---|---|
| No defence | 0/5 stopped — Amritsar, Jaipur struck |
| Best single site | 4/5, 1 site |
| All sites | 5/5, 74.5%, 5 sites |
| Layered | 5/5, 82.8%, 5 sites |
| **Optimised** | **5/5, 3 sites** — fewer sites, protection held |

**Engagement direction is unambiguous.** Red dashed + marching + arrowhead = incoming threat, terminating *at* the protected asset. Blue solid = interceptor, flying *outward* from its battery. Gold shield = protected asset. Green burst = threat destroyed in the air. A persistent legend sits on every map.

**Air-defence alert chain.** Batteries are not inert until they fire. They walk up through READY → ALERT (a track crosses the frontier) → TRACKING (inside this battery's envelope) → LOCKED (assigned, counting down) → FIRING → RELOADING, with colour, an animated readiness ring and a countdown. Every state is derived from geometry at the current sim time using the same tests the solver uses.

---

## Real data

**Geography.** Natural Earth vectors for India and its neighbours — Pakistan, China, Nepal, Bhutan, Bangladesh, Sri Lanka, Myanmar, Afghanistan. 169 admin-1 units (35 Indian states/UTs, 8 Pakistani and 12 Chinese provinces), coastlines, and 60 real cities. Simplified and bundled as 252 KB of static JSON: renders instantly, works fully offline, no tile server or API key.

**Weapon systems.** Eight interceptors with published open-source specifications, each cited in-app: S-400 Triumf, PAD, AAD, MR-SAM (Barak-8), Akash, SPYDER, QRSAM, S-125 Pechora — range, altitude band, speed, guidance, radar, warhead, reaction and reload times. Seven threat classes: Shaheen-II, Ghauri, Ghaznavi, Abdali, Babur, plus Shahpar-II class UAV and a loitering munition.

**Defended sectors.** 24 real Indian cities with real coordinates and populations, weighted toward the northwestern border belt (Rajasthan, Gujarat, Haryana, Punjab, J&K, Uttarakhand).

> The systems and their specifications are real and sourced. **Every battery position, radar site, unit designator and threat launch point is fictional.** No real installation is represented.

---

## The optimisation

**Hungarian assignment** — a from-scratch O(n³) Jonker-Volgenant rectangular solver, equivalent to `scipy.optimize.linear_sum_assignment`, verified against a known optimum. Rows are interceptor rounds, columns are live threats, cost is −(Pk × target value). Many-to-many is handled by re-running the exact solver in salvo waves with diminishing marginal returns.

**Minimality is proven, not asserted.**

```
B   = protection using ALL candidate batteries
tau = B - tolerance
S is ADMISSIBLE iff protection(S) >= tau
S* is MINIMAL   iff admissible AND no admissible subset of size |S*|-1 exists
```

The search enumerates subsets by **increasing cardinality** and stops at the first size containing an admissible subset — so every smaller subset was explicitly tested and failed. A sound upper bound prunes hopeless subsets without solving them; this was re-verified by brute-forcing 120 smaller subsets across 12 scenarios with **0 violations**. Above 14 candidate sites the solver reports **HEURISTIC** rather than claim a proof it did not perform.

**Engagement doctrine.** Maximising raw Pk drives intercepts toward the battery — which sits near the city it defends. Selection now weights Pk against **standoff from the protected asset**, with a floor at 70 % of best available Pk so doctrine never buys a bad shot. Mean intercept standoff went from 33 km to ~120 km; mean Pk improved. Reported Pk is always the true physical value at the chosen point.

**Postures.** *Minimal* is the PS deliverable (smallest certified subset). *Layered* lets every capable battery engage, which is what an operator would actually see. *All* is the naive baseline.

---

## Correctness

Each of these was a real bug found by measurement, not a hypothetical:

| Bug | Detection | Fix |
|---|---|---|
| Intercept points drawn ~490 km off | "distance from asset" was nonsense | solver used a stale hardcoded AOI origin |
| 38.5 % of attacks launched **from inside India** | territory audit | ray-cast launch solver against real borders |
| Cruise missiles structurally un-interceptable | Babur leaked 25 % | a blanket debris floor overrode each battery's own minimum altitude |
| Interceptors sat on the rail for up to 727 s | implied Mach 0.1 for a Mach 2 system | launch time derived from geometry, not earliest-ready |
| `hard` tier crashed on 28 of 32 seeds | tier sweep | unchecked `find(...)!` returning undefined |
| 9.4 % of batteries sited in Pakistan/China/sea | soil audit | siting solver with hard on-soil constraint |
| Batteries stacked 2.4 km apart | separation audit | dispersion scoring scaled to system reach |

**Standing audit** — 81 scenarios / 393 threats across every theatre and tier:

```
crashes 0 · certified 81/81 · max solve 625 ms · leakers 1.5 %
batteries off national soil 0/405 · polygon vertices off soil 0/2430
hostile origins inside India 0 · bad flight profiles 0
injected threats engaged 15/15 · counterfactual ordering intact
```

---

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Deploys to Vercel with zero configuration. The solver is compiled into the client bundle, so judge interactions re-solve locally with no network latency; `/api/scenario` and `/api/allocate` expose the same engine as stateless serverless functions.

## Layout

```
lib/region.json     Natural Earth borders, admin-1 units, coast, cities (252 KB)
lib/theatre.ts      region loader, 24 defended sectors, 10 theatre presets
lib/systems.ts      interceptor + threat specifications, with sources
lib/border.ts       territory tests, hostile launch placement
lib/siting.ts       battery siting: on-soil + dispersion solver
lib/scenario.ts     trajectory propagation, battery laydown
lib/geometry.ts     intercept solver, engagement windows, Pk model
lib/hungarian.ts    O(n^3) rectangular assignment
lib/allocator.ts    cost matrix, salvo waves, certified minimality search
lib/compare.ts      counterfactual modes
lib/alert.ts        battery readiness state machine
lib/national.ts     all-India layered laydown
lib/audio.ts        synthesised launch / intercept / impact cues
components/         GeoMap, IndiaMap, CompareBar, Inspector, MissionSummary,
                    ProfileView, Timeline, EventLog, symbols, Nav
```

## Scope

**Real:** borders, coastlines, cities and populations; all weapon-system specifications and their sources; the assignment algorithm; the minimality proof; intercept reachability geometry; live re-optimisation.

**Fictional:** every battery position, radar site, unit designator and threat launch point.

**Simplified:** flat-earth kinematics with a single drag term; constant average interceptor speed; engineering Pk model; long subsonic transits compressed in playback time (geometry exact).

**Not modelled:** sensor coverage gaps, track quality, radar horizon, ECM, debris, fratricide, terrain masking, weather.
