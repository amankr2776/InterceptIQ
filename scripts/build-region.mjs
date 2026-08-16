// InterceptIQ
/**
 * REGION BUILDER
 * ==============
 * Rebuilds lib/region.json from Natural Earth 10 m source data.
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous region.json was simplified far too aggressively and used the
 * default (UN) point of view. Measured against it:
 *
 *   · India was reduced to 564 vertices with a MEAN border segment of 30 km
 *     and a worst segment of 162 km — at that resolution the frontier is a
 *     polygon sketch, not a border. It cut corners through real territory,
 *     which is why coastal and salient sites needed a 9 km tolerance fudge
 *     just to test as "inside India".
 *   · Its northern extent stopped at 35.5°N, so the whole of northern
 *     Jammu & Kashmir was missing from the national outline.
 *
 * This build uses Natural Earth's INDIA POINT OF VIEW edition
 * (ne_10m_admin_0_countries_ind), which depicts India's official claimed
 * boundary — northern extent 37.05°N, including PoK and Aksai Chin. For an
 * Indian air-defence tool that is the correct depiction; using the UN POV
 * would draw the country wrong for its own users.
 *
 * SIMPLIFICATION IS ADAPTIVE. India carries the fine tolerance because every
 * territory test, battery siting decision and border-crossing time depends on
 * it. Distant neighbours are decoration and can be coarse. This keeps the
 * payload small while making the part that matters accurate.
 *
 * Usage:  node scripts/build-region.mjs /path/to/natural-earth-geojson-dir
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || '/tmp';
const OUT = path.join(process.cwd(), 'lib', 'region.json');

/** Map window: the whole subcontinent plus approaches. */
const WIN = { w: 60, s: 5, e: 100, n: 40 };

const ISOS = ['IND', 'PAK', 'CHN', 'NPL', 'BTN', 'BGD', 'LKA', 'MMR', 'AFG'];

/* Per-country simplification tolerance in degrees. India is an order of
 * magnitude finer than the rest because the solver depends on it. */
const TOL = {
  IND: 0.004,   // ~0.4 km — the frontier the whole simulation is tested against
  PAK: 0.02, CHN: 0.03, AFG: 0.03,
  NPL: 0.015, BTN: 0.015, BGD: 0.012, LKA: 0.012, MMR: 0.025,
};

const read = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

/** Perpendicular distance from p to segment a-b, in degrees. */
function perp(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker, iterative so deep rings cannot blow the stack. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let maxD = -1, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = perp(pts[k], pts[i], pts[j]);
      if (d > maxD) { maxD = d; idx = k; }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([i, idx], [idx, j]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (pts, dp = 4) =>
  pts.map(([x, y]) => [+x.toFixed(dp), +y.toFixed(dp)]);

/** Ring area in square degrees — used to drop specks. */
function area(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  }
  return Math.abs(a / 2);
}

const inWin = (r) =>
  r.some(([x, y]) => x >= WIN.w - 6 && x <= WIN.e + 6 && y >= WIN.s - 6 && y <= WIN.n + 6);

/** Pull every ring out of a Polygon/MultiPolygon geometry. */
function rings(geom) {
  const out = [];
  if (geom.type === 'Polygon') out.push(...geom.coordinates);
  else if (geom.type === 'MultiPolygon') for (const p of geom.coordinates) out.push(...p);
  return out;
}

function processCountry(feat, iso) {
  const tol = TOL[iso] ?? 0.03;
  /* Keep every Indian ring, however small. Lakshadweep atolls are only
   * ~0.0002 sq deg and an earlier 0.0004 threshold silently deleted them —
   * Kavaratti then tested as "not India", which would let a hostile launch
   * point be placed on Indian territory. Sovereign islands are not specks. */
  const minArea = iso === 'IND' ? 0 : 0.004;
  return rings(feat.geometry)
    .filter((r) => r.length >= 4 && inWin(r) && area(r) >= minArea)
    .map((r) => round(simplify(r, tol)))
    .filter((r) => r.length >= 4)
    .sort((a, b) => area(b) - area(a));
}

/* ------------------------------------------------------------------ */

console.log('reading source…');
const countriesInd = read('ind.json');                       // India POV
const statesRaw = read('ne_10m_admin_1_states_provinces.json');
const coastRaw = read('ne_10m_coastline.json');

/* Property casing differs between Natural Earth files: the countries layer
 * uses ADM0_A3, the admin-1 layer uses adm0_a3. Check both, or every state
 * silently drops out. */
const featIso = (f) =>
  f.properties.ADM0_A3 || f.properties.ISO_A3 ||
  f.properties.adm0_a3 || f.properties.iso_a3;

const countries = [];
for (const iso of ISOS) {
  const f = countriesInd.features.find((x) => featIso(x) === iso);
  if (!f) { console.warn('  MISSING', iso); continue; }
  const rs = processCountry(f, iso);
  const nv = rs.reduce((a, r) => a + r.length, 0);
  countries.push({ name: f.properties.NAME, iso, rings: rs });
  console.log(`  ${iso}  rings ${String(rs.length).padStart(3)}  vertices ${nv}`);
}

/* Admin-1 units. Indian states get a finer tolerance than foreign provinces
 * because they are drawn as internal boundaries over the defended country. */
const admin1 = [];
for (const f of statesRaw.features) {
  const iso = featIso(f);
  if (!ISOS.includes(iso)) continue;
  const tol = iso === 'IND' ? 0.012 : 0.05;
  const rs = rings(f.geometry)
    .filter((r) => r.length >= 4 && inWin(r) && area(r) >= (iso === 'IND' ? 0.002 : 0.02))
    .map((r) => round(simplify(r, tol)))
    .filter((r) => r.length >= 4);
  if (!rs.length) continue;
  // label anchor = centroid of the largest ring
  const big = rs.reduce((a, b) => (area(b) > area(a) ? b : a));
  let cx = 0, cy = 0;
  for (const [x, y] of big) { cx += x; cy += y; }
  admin1.push({
    n: f.properties.name || f.properties.NAME_1 || '',
    iso,
    r: rs,
    c: [+(cx / big.length).toFixed(3), +(cy / big.length).toFixed(3)],
    a: +area(big).toFixed(4),
  });
}
console.log(`  admin1 units ${admin1.length} (IND ${admin1.filter((a) => a.iso === 'IND').length})`);

/* Coastline, clipped to the window and simplified. Drawn as open lines. */
const coast = [];
for (const f of coastRaw.features) {
  const ls = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const l of ls) {
    const seg = l.filter(([x, y]) => x >= WIN.w - 3 && x <= WIN.e + 3 && y >= WIN.s - 3 && y <= WIN.n + 3);
    if (seg.length < 3) continue;
    const s = round(simplify(seg, 0.02));
    if (s.length >= 3) coast.push(s);
  }
}
console.log(`  coast segments ${coast.length}`);

/* Cities and country label anchors are carried over verbatim from the
 * existing file — they are hand-curated and unrelated to geometry accuracy. */
const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));

const out = {
  window: WIN,
  countries,
  coast,
  cities: prev.cities,
  admin1,
  countryLabels: prev.countryLabels,
};

fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`\nwrote ${OUT}  (${kb} KB)`);
