// InterceptIQ
'use client';

/**
 * VEHICLE RENDERERS
 * =================
 * Canvas silhouettes with a top-lit metal ramp, panel shading and a hot
 * nozzle. Drawn nose-right in local space; the caller rotates to heading.
 *
 * These are shape studies of the real airframes rather than icons: a
 * ballistic RV is an ogive cone with a heat-shield band, a cruise missile has
 * a slab fuselage with mid-body wings and a dorsal intake, a strike aircraft
 * has swept wings, canted tails and twin nozzles.
 */

function metal(g: CanvasRenderingContext2D, h: number, top: string, mid: string, bot: string) {
  const grd = g.createLinearGradient(0, -h, 0, h);
  grd.addColorStop(0, top);
  grd.addColorStop(0.45, mid);
  grd.addColorStop(1, bot);
  return grd;
}

/** Ballistic re-entry vehicle / SRBM body. */
export function drawBallistic(g: CanvasRenderingContext2D, s: number, hostile = true) {
  const c = hostile ? '#8d3746' : '#2b5f8a';
  g.save(); g.scale(s, s);

  // exhaust nozzle glow
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,190,80,0.55)';
  g.beginPath(); g.ellipse(-15, 0, 9, 3.4, 0, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over';

  // body
  g.beginPath();
  g.moveTo(17, 0);
  g.bezierCurveTo(11, -3.4, 4, -4.6, -13, -4.6);
  g.lineTo(-15, -3.2); g.lineTo(-15, 3.2); g.lineTo(-13, 4.6);
  g.bezierCurveTo(4, 4.6, 11, 3.4, 17, 0);
  g.closePath();
  g.fillStyle = metal(g, 5, '#5a626e', '#2b303a', '#14171d');
  g.fill();
  g.strokeStyle = c; g.lineWidth = 1.1; g.stroke();

  // heat-shield band at the nose
  g.beginPath();
  g.moveTo(17, 0); g.bezierCurveTo(13, -2.6, 9, -3.6, 6, -3.9);
  g.lineTo(6, 3.9); g.bezierCurveTo(9, 3.6, 13, 2.6, 17, 0);
  g.closePath();
  g.fillStyle = hostile ? 'rgba(190,70,84,0.85)' : 'rgba(70,130,190,0.85)';
  g.fill();

  // panel line
  g.beginPath(); g.moveTo(-6, -4.2); g.lineTo(-6, 4.2);
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.8; g.stroke();

  // grid fins
  g.fillStyle = c;
  g.beginPath(); g.moveTo(-8, -4.2); g.lineTo(-15, -11); g.lineTo(-11, -11); g.lineTo(-5, -4.2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-8, 4.2); g.lineTo(-15, 11); g.lineTo(-11, 11); g.lineTo(-5, 4.2); g.closePath(); g.fill();

  // specular highlight
  g.beginPath(); g.moveTo(12, -2.4); g.lineTo(-11, -3.1);
  g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 1.1; g.stroke();
  g.restore();
}

/** Terrain-hugging cruise missile. */
export function drawCruise(g: CanvasRenderingContext2D, s: number) {
  g.save(); g.scale(s, s);

  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,190,80,0.45)';
  g.beginPath(); g.ellipse(-13, 0, 7, 2.6, 0, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over';

  // wings behind the body
  g.fillStyle = 'rgba(120,52,62,0.9)';
  g.beginPath(); g.moveTo(1, -2.4); g.lineTo(-8, -13); g.lineTo(-3, -13); g.lineTo(4, -2.4); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(1, 2.4); g.lineTo(-8, 13); g.lineTo(-3, 13); g.lineTo(4, 2.4); g.closePath(); g.fill();

  // fuselage
  g.beginPath();
  g.moveTo(15, 0);
  g.bezierCurveTo(10, -2.8, 5, -3.4, -12, -3.4);
  g.lineTo(-12, 3.4);
  g.bezierCurveTo(5, 3.4, 10, 2.8, 15, 0);
  g.closePath();
  g.fillStyle = metal(g, 3.6, '#5c6470', '#2d323c', '#15181e');
  g.fill();
  g.strokeStyle = '#8d3746'; g.lineWidth = 1.05; g.stroke();

  // dorsal intake
  g.fillStyle = '#3a414d';
  g.fillRect(-6, 2.0, 7, 2.4);

  // tailplane
  g.fillStyle = '#8d3746';
  g.beginPath(); g.moveTo(-9, -3.4); g.lineTo(-13, -8); g.lineTo(-9.5, -8); g.closePath(); g.fill();

  g.beginPath(); g.arc(11, -1.2, 1.3, 0, 7);
  g.fillStyle = 'rgba(255,220,225,0.95)'; g.fill();

  g.beginPath(); g.moveTo(11, -2.0); g.lineTo(-10, -2.4);
  g.strokeStyle = 'rgba(255,255,255,0.26)'; g.lineWidth = 1; g.stroke();
  g.restore();
}

/** Strike aircraft — swept wing, canted tails, twin nozzles.
 *  `hostile` tints the edge lines red (PAF/PLAAF types) or blue (IAF CAP). */
export function drawJet(g: CanvasRenderingContext2D, s: number, hostile = true) {
  const c = hostile ? '#8d3746' : '#4da3ff';
  g.save(); g.scale(s, s);

  g.globalCompositeOperation = 'lighter';
  g.fillStyle = hostile ? 'rgba(255,160,90,0.42)' : 'rgba(120,190,255,0.42)';
  g.beginPath(); g.ellipse(-15, -2.2, 8, 2.2, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(-15, 2.2, 8, 2.2, 0, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over';

  // main wings (swept back)
  g.fillStyle = 'rgba(58,66,78,0.95)';
  g.beginPath(); g.moveTo(3, -3); g.lineTo(-12, -17); g.lineTo(-4, -17); g.lineTo(8, -3); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(3, 3); g.lineTo(-12, 17); g.lineTo(-4, 17); g.lineTo(8, 3); g.closePath(); g.fill();
  g.strokeStyle = c; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(3, -3); g.lineTo(-12, -17); g.moveTo(3, 3); g.lineTo(-12, 17); g.stroke();

  // canted tails
  g.fillStyle = 'rgba(78,86,100,0.95)';
  g.beginPath(); g.moveTo(-9, -2.6); g.lineTo(-17, -10); g.lineTo(-12, -10); g.lineTo(-6, -2.6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-9, 2.6); g.lineTo(-17, 10); g.lineTo(-12, 10); g.lineTo(-6, 2.6); g.closePath(); g.fill();

  // fuselage
  g.beginPath();
  g.moveTo(20, 0);
  g.bezierCurveTo(14, -3, 8, -4.4, -14, -4.4);
  g.lineTo(-16, -3); g.lineTo(-16, 3); g.lineTo(-14, 4.4);
  g.bezierCurveTo(8, 4.4, 14, 3, 20, 0);
  g.closePath();
  g.fillStyle = metal(g, 4.6, '#6a7280', '#333a45', '#171a20');
  g.fill();
  g.strokeStyle = c; g.lineWidth = 1.15; g.stroke();

  // canopy
  g.beginPath(); g.ellipse(8, -1.4, 4.6, 2.1, -0.12, 0, 7);
  g.fillStyle = 'rgba(150,200,235,0.55)'; g.fill();
  g.strokeStyle = 'rgba(200,230,255,0.5)'; g.lineWidth = 0.7; g.stroke();

  // nozzles
  g.fillStyle = '#0c0f14';
  g.fillRect(-16.5, -3.2, 2.2, 2.2);
  g.fillRect(-16.5, 1.0, 2.2, 2.2);

  g.beginPath(); g.moveTo(15, -2.6); g.lineTo(-13, -3.4);
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.1; g.stroke();
  g.restore();
}

/** Fixed-wing UAV. */
export function drawDrone(g: CanvasRenderingContext2D, s: number) {
  g.save(); g.scale(s, s);
  g.fillStyle = 'rgba(120,52,62,0.85)';
  g.fillRect(-2, -15, 3.2, 30);                       // straight high-aspect wing
  g.beginPath();
  g.moveTo(13, 0);
  g.bezierCurveTo(9, -2.2, 5, -2.7, -10, -2.7);
  g.lineTo(-10, 2.7);
  g.bezierCurveTo(5, 2.7, 9, 2.2, 13, 0);
  g.closePath();
  g.fillStyle = metal(g, 3, '#565e6a', '#2a2f38', '#14171c');
  g.fill();
  g.strokeStyle = '#8d3746'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#8d3746';
  g.beginPath(); g.moveTo(-7, -2.7); g.lineTo(-11, -8); g.lineTo(-7.5, -8); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-7, 2.7); g.lineTo(-11, 8); g.lineTo(-7.5, 8); g.closePath(); g.fill();
  g.restore();
}

/** Interceptor — slim, canard-controlled, bright motor. */
export function drawInterceptor(g: CanvasRenderingContext2D, s: number) {
  g.save(); g.scale(s, s);

  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(120,190,255,0.6)';
  g.beginPath(); g.ellipse(-15, 0, 10, 3.2, 0, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over';

  // canards
  g.fillStyle = '#4da3ff';
  g.beginPath(); g.moveTo(6, -2.6); g.lineTo(2, -7); g.lineTo(4.5, -2.6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(6, 2.6); g.lineTo(2, 7); g.lineTo(4.5, 2.6); g.closePath(); g.fill();
  // tail fins
  g.beginPath(); g.moveTo(-8, -3); g.lineTo(-14, -9); g.lineTo(-10, -9); g.lineTo(-5, -3); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-8, 3); g.lineTo(-14, 9); g.lineTo(-10, 9); g.lineTo(-5, 3); g.closePath(); g.fill();

  g.beginPath();
  g.moveTo(15, 0);
  g.bezierCurveTo(10, -2.6, 5, -3.2, -13, -3.2);
  g.lineTo(-13, 3.2);
  g.bezierCurveTo(5, 3.2, 10, 2.6, 15, 0);
  g.closePath();
  g.fillStyle = metal(g, 3.4, '#8fb9dd', '#1f3b55', '#0b1926');
  g.fill();
  g.strokeStyle = '#7cc4ff'; g.lineWidth = 1.15; g.stroke();

  g.beginPath(); g.moveTo(15, 0); g.lineTo(6, -3); g.lineTo(6, 3); g.closePath();
  g.fillStyle = '#cfe8ff'; g.fill();

  g.beginPath(); g.moveTo(12, -2); g.lineTo(-11, -2.4);
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.1; g.stroke();
  g.restore();
}

/** TEL launcher, side elevation. `spent` canisters render empty. */
export function drawTEL(
  g: CanvasRenderingContext2D, s: number, col: string,
  cans: number, spent: number, elev = -14
) {
  g.save(); g.scale(s, s);

  // canisters, elevated
  g.save(); g.rotate((elev * Math.PI) / 180);
  for (let i = 0; i < cans; i++) {
    const x = (i - (cans - 1) / 2) * 5.0;
    g.fillStyle = i < spent ? '#0a0f16' : '#1a222e';
    g.fillRect(x - 1.7, -24, 3.4, 24);
    g.strokeStyle = col; g.lineWidth = 1.05;
    g.strokeRect(x - 1.7, -24, 3.4, 24);
    if (i >= spent) { g.fillStyle = col; g.fillRect(x - 1.7, -24, 3.4, 4); }
  }
  g.restore();

  // chassis
  g.beginPath();
  g.moveTo(-19, 4); g.lineTo(19, 4); g.lineTo(16, -6); g.lineTo(-17, -6); g.closePath();
  g.fillStyle = metal(g, 6, '#3c4552', '#1b212b', '#0c1015');
  g.fill();
  g.strokeStyle = col; g.lineWidth = 1.2; g.stroke();

  // cab
  g.beginPath();
  g.moveTo(-19, -6); g.lineTo(-12, -6); g.lineTo(-12, -13); g.lineTo(-16.5, -13); g.closePath();
  g.fillStyle = '#171d26'; g.fill(); g.strokeStyle = col; g.lineWidth = 1; g.stroke();
  g.fillStyle = 'rgba(150,200,235,0.35)';
  g.fillRect(-15.5, -12, 3, 3.4);

  // wheels
  for (const wx of [-14, -8, 8, 14]) {
    g.beginPath(); g.arc(wx, 7, 3.4, 0, 7);
    g.fillStyle = '#06090d'; g.fill();
    g.strokeStyle = col; g.lineWidth = 1.1; g.stroke();
  }
  g.restore();
}
