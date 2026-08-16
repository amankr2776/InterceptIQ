# CK115 — Interceptor Allocation C2

Tactical command-and-control console for **optimal interceptor launch-area selection and engagement planning** over the Indian subcontinent.

> **Problem (SIH CK115, Dte of IT & Cyber Security, DRDO):** identify the optimal set of land-based launch locations to maximise kill probability against multiple inbound air targets — the output being the **minimal subset** of candidate deployment areas.

---

## Real data, not mockups

### Geography — Natural Earth 10m/50m vector data (public domain)

Real borders and coastlines for **India and its neighbours**: Pakistan, China, Nepal, Bhutan, Bangladesh, Sri Lanka, Myanmar, Afghanistan. Plus 60 real cities with real coordinates and populations, and the full regional coastline.

Geometry is simplified with Douglas-Peucker (ε ≈ 4 km, 24,156 → 5,035 points) and bundled as **82 KB of static JSON**. It renders instantly and **works offline** — no tile server, no API key, nothing that can fail during a live demo.

### Weapon systems — published open-source specifications

Every interceptor and threat in `lib/systems.ts` carries real published data with a named source. Nothing is invented, nothing is classified.

**Interceptors**

| System | Origin | Range | Altitude | Speed | Ready | Status |
|---|---|---|---|---|---|---|
| S-400 Triumf | Russia | 3–400 km | 10–30,000 m | Mach 14 | 8 | 3 of 5 regiments operational (2025) |
| PAD / Pradyumna | India (DRDO) | 30–200 km | 50–80 km | Mach 5.5 | 4 | BMD Phase-I, exo-atmospheric |
| AAD / Ashwin | India (DRDO) | 10–200 km | 15–30 km | Mach 4.5 | 6 | BMD Phase-I, endo-atmospheric |
| MR-SAM (Barak-8) | India–Israel | 0.5–100 km | 50–16,000 m | Mach 2 | 8 | In service, 18 IAF squadrons |
| Akash | India (DRDO) | 4.5–45 km | 100–20,000 m | Mach 3.5 | 12 | In service, 15 squadrons |
| SPYDER-MR | Israel (Rafael) | 1–50 km | 20–16,000 m | Mach 4 | 8 | 18 systems with IAF |
| QRSAM | India (DRDO) | 3–30 km | 30–10,000 m | Mach 4.7 | 6 | Ordered 2025 |
| S-125 Pechora | USSR/India | 3.5–35 km | 20–18,000 m | Mach 3.5 | 4 | Legacy, being replaced |

Each entry also records guidance method, warhead mass, associated radar, simultaneous-engagement capacity, reload and reaction times.

**Threat classes** — representative real systems for the theatre (Shaheen-II, Ghauri, Ghaznavi, Abdali, Babur) with published range, apogee, speed, warhead, guidance and CEP, sourced from CSIS Missile Threat and equivalent open reporting.

> **The systems and their specifications are real. Every deployment location, unit designator and launch point in this tool is fictional.** No real installation is represented.

### Theatres — real defended sectors

Four selectable theatres built on real Indian cities with real coordinates and populations:

- **Northwestern** — Delhi NCR · Amritsar · Jaipur
- **Western Seaboard** — Mumbai · Ahmedabad
- **Central Corridor** — Delhi NCR · Lucknow · Jaipur
- **Southern Peninsula** — Bengaluru · Chennai · Hyderabad

---

## Two views

### `/national` — National Air Defence (start here)

Full map of India and its neighbours with the complete air-defence picture:

- **10 defended sectors** — Delhi NCR, Mumbai, Amritsar, Ahmedabad, Jaipur, Lucknow, Bengaluru, Chennai, Hyderabad, Kolkata — real coordinates, real populations (121.1 M covered)
- **40 interceptor batteries** in a layered laydown: high-value sectors get BMD + long-range + medium-range + point defence; lower-value sectors get medium and point defence only
- **10 surveillance radars** with detection-range rings
- **Click any sector** to see its batteries, rounds at readiness, max engagement range and altitude, radar detection range and layers present
- **Click any battery** for the full published weapon-system block, associated radar (detection and fire-control ranges), exact deployment coordinates in DMS, stand-off and bearing from the sector, and an offline/restore switch
- **Click any radar** for type, band, role and detection range
- Layer toggles for engagement envelopes, radar coverage, graticule and country names
- From any sector, jump straight into the live engagement console for its theatre

### `/` — Live Engagement

**Map** — pan (drag), zoom (scroll, 0.75–14×), reset. Real borders, coastline, cities, and a degree graticule that adapts its interval to zoom. Live cursor readout in DMS and decimal degrees. Adaptive scale bar. Toggleable layers: tracks, predicted paths, engagements, range rings, launch points, altitude ticks, graticule, cities, country names.

**Click any entity for full detail:**

*Tracks* — the threat system's published specification block (category, range, apogee, speed, warhead, guidance, CEP, source) plus live state: latitude/longitude in DMS and decimal, altitude, velocity in m/s and Mach, flight-path angle, **radius of curvature** (`R = |v|³/|v×a|`), heading with compass point, apogee, ground range, time of flight, attacker launch point with its own coordinates, predicted impact and countdown, cumulative Pk, every committed shot with intercept altitude/slant range/aspect/closing speed/margin/engagement window, and the firing solution from *every* battery including why infeasible ones fail.

*Batteries* — why TASKED vs IDLE in plain language, the full published weapon-system block with its source, deployment centroid in DMS, polygon footprint, rounds available and committed, coverage fraction, best achievable Pk, and assigned engagements.

*Sectors* — centre coordinates, defended radius, asset value, population, designation, and all inbound tracks with protection status.

**Bottom dock** (drag the top edge to resize) — Mission Timeline with detect/decision/launch/intercept/impact markers and a scrubbable playhead · Vertical Profile showing downrange × altitude with each battery's engagement band · Event Log, timestamped and auto-scrolling.

---

## The optimisation

**Hungarian assignment** — a from-scratch O(n³) Jonker-Volgenant rectangular solver, the exact equivalent of `scipy.optimize.linear_sum_assignment`, verified against a known-optimal case. Rows are interceptor rounds, columns are live targets, cost is `−(Pk × target value)`. Many-to-many is handled by running the exact solver in salvo waves with diminishing marginal returns.

**Minimality is proven, not asserted.**

```
B   = protection using ALL candidate batteries
tau = B - tolerance
S is ADMISSIBLE iff protection(S) >= tau
S* is MINIMAL   iff admissible AND no admissible subset of size |S*|-1 exists
```

The search enumerates subsets by **increasing cardinality** and stops at the first size containing an admissible subset — so every smaller subset was explicitly tested and failed. Certification runs to 12 candidates; beyond that it reports **HEURISTIC** rather than claim a proof it did not perform.

**Intercept geometry** — for each (battery, target) pair the solver scans the whole feasible engagement window and commits at maximum Pk, not the earliest feasible point (which sits on the max-range boundary and is the worst shot available).

**Kill probability** — `Pk = 0.92 · f_range · f_aspect · f_margin · f_class`, bounded [0,1] and monotone in every factor so any ranking is explainable. It is **not** a validated lethality model; real values require classified interceptor performance data.

**Live re-optimisation** — KILL any battery, or inject a new track by clicking the map. Everything re-solves from scratch, typically under 50 ms, at any point on the timeline.

---

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

**Deploy to Vercel:** zero config — push to Git and import, or `npx vercel --prod`. The solver is compiled into the client bundle so interactions re-solve locally with no network latency; `/api/scenario` and `/api/allocate` expose the same engine as stateless serverless functions.

## Layout

```
lib/region.json     real Natural Earth borders, coast, cities (82 KB)
lib/theatre.ts      region loader, real defended sectors, theatre presets
lib/national.ts     national laydown: layered battery + radar disposition
lib/systems.ts      real interceptor + threat specifications, with sources
lib/scenario.ts     trajectory propagation, battery laydown
lib/geometry.ts     intercept solver, engagement windows, Pk model
lib/hungarian.ts    O(n^3) rectangular assignment
lib/allocator.ts    cost matrix, salvo waves, certified minimality search
lib/diagnostics.ts  TASKED/IDLE explanation engine
lib/format.ts       DMS, compass, radius of curvature
lib/store.tsx       mission state + live re-solve
components/         IndiaMap, GeoMap, Inspector, ProfileView, Timeline, EventLog
```

## Scope

**Real:** borders, coastlines, cities and populations; all weapon-system specifications and their sources; the assignment algorithm; the minimality proof; intercept reachability geometry.

**Fictional:** every battery position, unit designator, threat launch point and engagement. No real deployment is represented.

**Simplified:** flat-earth kinematics with a single drag term; constant average interceptor speed; engineering Pk model; cruise tracks simulate the terminal ingress leg rather than full published range.

**Not modelled:** sensor coverage, track quality, radar horizon, ECM, debris, fratricide, terrain masking, weather.
