// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
/**
 * Hungarian / Jonker-Volgenant style O(n^3) rectangular assignment.
 * Direct equivalent of scipy.optimize.linear_sum_assignment(cost).
 * Minimises total cost. Returns row -> col (or -1).
 *
 * Implemented here in TS so the whole optimiser runs in a single Vercel
 * serverless function with no Python runtime.
 */
export function linearSumAssignment(cost: number[][]): { rows: number[]; cols: number[]; total: number } {
  const nRows = cost.length;
  if (nRows === 0) return { rows: [], cols: [], total: 0 };
  const nCols = cost[0].length;
  if (nCols === 0) return { rows: [], cols: [], total: 0 };

  const transpose = nCols < nRows;
  const n = transpose ? nCols : nRows;   // rows of working matrix (<= m)
  const m = transpose ? nRows : nCols;
  const C = (i: number, j: number) => (transpose ? cost[j][i] : cost[i][j]);

  const INF = Infinity;
  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1).fill(-1); // col -> row
  const way = new Int32Array(m + 1).fill(-1);

  for (let i = 0; i < n; i++) {
    p[m] = i;
    let j0 = m;
    const minv = new Float64Array(m + 1).fill(INF);
    const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 0; j < m; j++) {
        if (used[j]) continue;
        const cur = C(i0, j) - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      if (j1 === -1) break;
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== -1);
    // augment
    while (j0 !== m && way[j0] !== -1) {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    }
  }

  const rowOf: number[] = [];
  const colOf: number[] = [];
  const assignCol = new Int32Array(n).fill(-1);
  for (let j = 0; j < m; j++) if (p[j] >= 0 && p[j] < n) assignCol[p[j]] = j;

  let total = 0;
  for (let i = 0; i < n; i++) {
    const j = assignCol[i];
    if (j < 0) continue;
    const c = C(i, j);
    if (!isFinite(c)) continue;
    total += c;
    if (transpose) { rowOf.push(j); colOf.push(i); }
    else { rowOf.push(i); colOf.push(j); }
  }
  // keep pairs sorted by row for stable output
  const order = rowOf.map((_, k) => k).sort((a, b) => rowOf[a] - rowOf[b]);
  return {
    rows: order.map((k) => rowOf[k]),
    cols: order.map((k) => colOf[k]),
    total,
  };
}
