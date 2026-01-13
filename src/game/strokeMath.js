// src/game/strokeMath.js
// 幾何・ポリライン計算の共通モジュール

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < (pts?.length ?? 0); i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

export function distancePointToSegment(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
  const t = c1 / c2;
  const px = a.x + t * vx, py = a.y + t * vy;
  return Math.hypot(p.x - px, p.y - py);
}

export function distancePointToPolyline(p, poly) {
  let best = Infinity;
  for (let i = 1; i < (poly?.length ?? 0); i++) {
    best = Math.min(best, distancePointToSegment(p, poly[i - 1], poly[i]));
  }
  return best;
}