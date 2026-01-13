// src/game/judge.js
import {
    TOLERANCE, START_TOL,
    MIN_HIT_RATE, MIN_DRAW_LEN_RATE, MIN_COVER_RATE,
    MIN_POINTS, MIN_MOVE_EPS, RESAMPLE_STEP, COVER_SAMPLES,
    START_TOL_MASTER,
    MASTER_FAIL_REASON
  } from "./config.js";
  
  /**
   * 総合判定エントリ
   */
  export function judgeAttempt({
    points,
    strokes,
    strokeIndex,
    isMaster
  }) {
    if (isMaster) {
      return judgeTraceMaster(points, strokes, strokeIndex);
    }
    return judgeTrace(points, strokes, strokeIndex);
  }
  
  /**
   * 通常（Kid）モード判定
   */
  export function judgeTrace(points, strokes, strokeIndex) {
    const stroke = strokes[strokeIndex];
    if (!stroke) return { ok: false };
  
    const res = evaluateStroke(points, stroke);
    if (!res.ok) return res;
  
    return { ok: true };
  }
  
  /**
   * Masterモード判定（厳密）
   */
  export function judgeTraceMaster(points, strokes, strokeIndex) {
    const guessed = guessStrokeIndex(points, strokes);
    if (guessed !== strokeIndex) {
      return {
        ok: false,
        reason: MASTER_FAIL_REASON.WRONG_ORDER
      };
    }
  
    const stroke = strokes[strokeIndex];
    const res = evaluateStroke(points, stroke);
    if (!res.ok) {
      return {
        ok: false,
        reason: MASTER_FAIL_REASON.BAD_SHAPE
      };
    }
  
    return { ok: true };
  }
  
  /**
   * どの画をなぞったか推定（Master用）
   */
  export function guessStrokeIndex(points, strokes) {
    let best = Infinity;
    let bestIdx = -1;
  
    for (let i = 0; i < strokes.length; i++) {
      const d = distanceToStroke(points[0], strokes[i]);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
  
    if (best > START_TOL_MASTER) return -1;
    return bestIdx;
  }
  
  /**
   * ===== 以下は純計算 =====
   */
  
  function evaluateStroke(points, stroke) {
    if (points.length < MIN_POINTS) {
      return { ok: false, reason: MASTER_FAIL_REASON.TOO_SHORT };
    }
  
    const drawLen = polylineLength(points);
    const strokeLen = polylineLength(stroke);
  
    if (drawLen < strokeLen * MIN_DRAW_LEN_RATE) {
      return { ok: false, reason: MASTER_FAIL_REASON.TOO_SHORT };
    }
  
    const cover = coverageRate(points, stroke);
    if (cover < MIN_COVER_RATE) {
      return { ok: false, reason: MASTER_FAIL_REASON.BAD_SHAPE };
    }
  
    return { ok: true };
  }
  
  function polylineLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += dist(pts[i - 1], pts[i]);
    }
    return len;
  }
  
  function coverageRate(points, stroke) {
    let hit = 0;
    const samples = resample(stroke, COVER_SAMPLES);
    for (const s of samples) {
      if (minDist(points, s) <= TOLERANCE) hit++;
    }
    return hit / samples.length;
  }
  
  function distanceToStroke(p, stroke) {
    return Math.min(...stroke.map(pt => dist(p, pt)));
  }
  
  function minDist(points, p) {
    return Math.min(...points.map(q => dist(p, q)));
  }
  
  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
  
  function resample(points, n) {
    if (points.length === 0) return [];
    const out = [points[0]];
    let acc = 0;
    const step = polylineLength(points) / (n - 1);
  
    for (let i = 1; i < points.length; i++) {
      const d = dist(points[i - 1], points[i]);
      acc += d;
      if (acc >= step) {
        out.push(points[i]);
        acc = 0;
      }
    }
    while (out.length < n) out.push(points.at(-1));
    return out;
  }
  