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

// ✅ alphabet: 描いた線(points)が一番近いストロークを推定
  function guessClosestStrokeIndex(points, strokes) {
      if (!Array.isArray(points) || points.length === 0) return -1;
      if (!Array.isArray(strokes) || strokes.length === 0) return -1;
      let bestI = -1;
      let best = Infinity;
      for (let i = 0; i < strokes.length; i++) {
        const poly = strokes[i];
        if (!poly || poly.length < 2) continue;
        // 点群の平均距離（軽量版：数点サンプル）
        let sum = 0;
        const step = Math.max(1, Math.floor(points.length / 8));
        let cnt = 0;
        for (let k = 0; k < points.length; k += step) {
          sum += distancePointToPolyline(points[k], poly);
          cnt++;
        }
        const avg = cnt ? sum / cnt : Infinity;
        if (avg < best) { best = avg; bestI = i; }
      }
      return bestI;
    }
// ---------------------------
// 旧判定（高精度）で使う純計算ユーティリティ
// ---------------------------

export function pointAtDistance(poly, d) {
  if (!poly || poly.length === 0) return { x: 0, y: 0 };
  if (poly.length === 1) return { ...poly[0] };
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const seg = dist(a, b);
    if (acc + seg >= d) {
      const t = seg === 0 ? 0 : (d - acc) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += seg;
  }
  return { ...poly[poly.length - 1] };
}

export function resamplePolyline(poly, step) {
  const len = polylineLength(poly);
  if (!Number.isFinite(len) || len <= 0) return (poly || []).slice();
  const out = [];
  for (let d = 0; d <= len; d += step) out.push(pointAtDistance(poly, d));
  const last = poly[poly.length - 1];
  const prev = out[out.length - 1];
  if (!prev || dist(prev, last) > 0.01) out.push({ x: last.x, y: last.y });
  return out;
}

export function normalizeDrawnPoints(points, { step, minMoveEps }) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const compact = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = compact[compact.length - 1];
    const cur = points[i];
    if (dist(prev, cur) >= minMoveEps) compact.push(cur);
  }
  if (compact.length < 2) return compact;
  return resamplePolyline(compact, step);
}

export function sampleAlongPolyline(poly, n) {
  const len = polylineLength(poly);
  if (!Number.isFinite(len) || len <= 0) return (poly || []).slice(0, 1);
  if (n <= 1) return [pointAtDistance(poly, len * 0.5)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = (len * i) / (n - 1);
    out.push(pointAtDistance(poly, d));
  }
  return out;
}

export function avgDistancePolyline(points, poly) {
  if (!points || points.length === 0 || !poly || poly.length < 2) return Infinity;
  let sum = 0;
  for (const p of points) sum += distancePointToPolyline(p, poly);
  return sum / points.length;
}

export function getAdaptiveParams(strokeLen, {
  tolerance,
  startTol,
  minHitRate,
  minDrawLenRate,
  minCoverRate
}) {
  // 短い線ほど甘く、長い線ほど厳密に（旧main.jsの挙動）
  const short = 12;
  const long = 60;
  const t = Math.max(0, Math.min(1, (strokeLen - short) / (long - short)));

  const tol = tolerance + (1 - t) * 4;
  const coverTol = tol * 1.15;
  const minHit = minHitRate + t * 0.08;
  const minDraw = minDrawLenRate + t * 0.07;
  const minCover = minCoverRate + t * 0.15;
  const startTol2 = startTol - t * 6;

  return { tol, coverTol, minHit, minDraw, minCover, startTol: startTol2 };
}