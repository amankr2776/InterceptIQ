// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
/** Degrees → DMS with hemisphere, the way a C2 console shows coordinates. */
export function dms(v: number, isLat: boolean) {
  const h = isLat ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W';
  const a = Math.abs(v);
  const d = Math.floor(a);
  const mF = (a - d) * 60;
  const m = Math.floor(mF);
  const s = (mF - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"${h}`;
}

/** Military Grid-style easting/northing reference within the AOI. */
export function grid(x: number, y: number) {
  const e = Math.max(0, Math.min(99999, Math.round(x * 1000)));
  const n = Math.max(0, Math.min(99999, Math.round(y * 1000)));
  return `${String(e).padStart(5, '0')} ${String(n).padStart(5, '0')}`;
}

export const clock = (t: number) =>
  `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export const compass = (b: number) => {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return names[Math.round((((b % 360) + 360) % 360) / 22.5) % 16];
};

/**
 * Radius of curvature of a trajectory at time t, from three sampled points.
 * R = |v|^3 / |v × a|  — computed by finite difference in the vertical plane.
 * Small R = tight turn (terminal dive / boost pitch-over); large R = near-straight.
 */
export function radiusOfCurvature(
  pts: { x: number; y: number; z: number }[]
): number | null {
  if (pts.length < 3) return null;
  const [a, b, c] = pts;
  const v = { x: (c.x - a.x) / 2, y: (c.y - a.y) / 2, z: (c.z - a.z) / 2 };
  const ac = { x: c.x - 2 * b.x + a.x, y: c.y - 2 * b.y + a.y, z: c.z - 2 * b.z + a.z };
  const cx = v.y * ac.z - v.z * ac.y;
  const cy = v.z * ac.x - v.x * ac.z;
  const cz = v.x * ac.y - v.y * ac.x;
  const cross = Math.hypot(cx, cy, cz);
  const sp = Math.hypot(v.x, v.y, v.z);
  if (cross < 1e-9) return Infinity;
  return (sp * sp * sp) / cross;
}
