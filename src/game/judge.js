// src/game/judge.js
import {
    TOLERANCE, START_TOL,
    MIN_HIT_RATE, MIN_DRAW_LEN_RATE, MIN_COVER_RATE,
    MIN_POINTS, MIN_MOVE_EPS, RESAMPLE_STEP, COVER_SAMPLES,
    START_TOL_MASTER,
    MASTER_FAIL_REASON
  } from "./config.js";

  import {
      dist,
      polylineLength,
      distancePointToPolyline,
      normalizeDrawnPoints,
      sampleAlongPolyline,
      avgDistancePolyline,
      getAdaptiveParams,
    } from "./strokeMath.js";
  /**
   * 総合判定エントリ
   */
  export function judgeAttempt({
    points,
    strokes,
    strokeIndex,
    isMaster,
    // 旧判定の「連続失敗救済」を使いたい場合に外から渡せる（任意）
    // startTraceGame 側で failStreak[strokeIndex] を渡すと、旧挙動と同等になる
    failStreak = null
  }) {
    if (isMaster) {
      return judgeTraceMaster(points, strokes, strokeIndex);
    }
    return judgeTrace(points, strokes, strokeIndex, failStreak);
  }
  
  /**
   * 通常（Kid）モード判定
   */
  export function judgeTrace(points, strokes, strokeIndex, failStreak) {
    const stroke = strokes[strokeIndex];
    if (!stroke) return { ok: false };
  
    // 旧main.js相当：adaptive params + hit/cover + start check + (任意で救済)
    return judgeTraceKidDetailed(points, stroke, strokeIndex, failStreak);
  }
  
  /**
   * Masterモード判定（厳密）
   */
  export function judgeTraceMaster(points, strokes, strokeIndex) {
    if (!Array.isArray(points) || points.length < MIN_POINTS) {
              return { ok: false, reason: MASTER_FAIL_REASON.TOO_SHORT };
            }
            if (!Array.isArray(strokes) || strokes.length === 0) {
              return { ok: false, reason: MASTER_FAIL_REASON.BAD_SHAPE };
            }
        
            // 旧main.js相当：平均距離で「どの画をなぞったか」を推定
            const { bestI, bestD } = guessStrokeIndex(points, strokes);
            // Master開始は startTraceGame の onDown で START_TOL_MASTER gate がある前提だが、
            // 念のためここでも guard しておく（変な入力が来た時に暴れない）
            if (bestI < 0 || !Number.isFinite(bestD) || bestD > START_TOL_MASTER * 3) {
              return { ok: false, reason: MASTER_FAIL_REASON.FAR_FROM_STROKE };
            }
        
            // 書き順ミス
            if (bestI !== strokeIndex) {
              return { ok: false, reason: MASTER_FAIL_REASON.WRONG_ORDER };
            }
        
            // 形の厳密判定（救済なし）
            return judgeTraceMasterDetailed(points, strokes[strokeIndex]);
  }
  
  /**
   * どの画をなぞったか推定（Master用）
   */
  export function guessStrokeIndex(points, strokes) {
    
    let bestI = -1;
        let bestD = Infinity;
        for (let i = 0; i < strokes.length; i++) {
          const d = avgDistancePolyline(points, strokes[i]);
          if (d < bestD) {
            bestD = d;
            bestI = i;
          }
        }
        return { bestI, bestD };

  }
  
  /**
   * ===== 以下は純計算（旧main.js相当） =====
   */
    
      // ---------------------------
      // Kid判定（旧main.js相当）
      // ---------------------------
      function judgeTraceKidDetailed(drawnPoints, strokePoly, strokeIndex, failStreak = null) {
        if (!Array.isArray(drawnPoints) || drawnPoints.length < MIN_POINTS) return { ok: false };
    
        const dp = normalizeDrawnPoints(drawnPoints, { step: RESAMPLE_STEP, minMoveEps: MIN_MOVE_EPS });
        if (dp.length < 2) return { ok: false };
    
        const strokeLen = polylineLength(strokePoly);
        if (strokeLen <= 0) return { ok: false };
    
        const P = getAdaptiveParams(strokeLen, {
                      tolerance: TOLERANCE,
                      startTol: START_TOL,
                      minHitRate: MIN_HIT_RATE,
                      minDrawLenRate: MIN_DRAW_LEN_RATE,
                      minCoverRate: MIN_COVER_RATE,
                    });
    
        // 連続失敗救済（任意：外から failStreak を渡した場合のみ適用）
        // 旧main.js：最大3段階で緩和
        if (failStreak && Array.isArray(failStreak)) {
          const streak = Math.max(0, Math.min(3, failStreak?.[strokeIndex] ?? 0));
          if (streak > 0) {
            P.tol += 3 * streak;
            P.coverTol = P.tol * 1.15;
            P.minHit = Math.max(0.28, P.minHit - 0.06 * streak);
            P.minCover = Math.max(0.18, P.minCover - 0.06 * streak);
            P.startTol += 3 * streak;
          }
        }
    
        // 開始位置（旧main.js：strokePoly[0] 近辺）
        const start = dp[0];
        const s0 = strokePoly[0];
        if (dist(start, s0) > P.startTol) return { ok: false };
    
        // 短すぎ
        const drawnLen = polylineLength(dp);
        if (drawnLen < strokeLen * P.minDraw) return { ok: false };
    
        // hitRate（描いた点が線からどれだけ近いか）
        let hit = 0;
        for (const p of dp) if (distancePointToPolyline(p, strokePoly) <= P.tol) hit++;
        const hitRate = hit / dp.length;
    
        // coverRate（目標線上の点がどれだけ描線でカバーされているか）
        const samples = sampleAlongPolyline(strokePoly, COVER_SAMPLES);
        let cover = 0;
        for (const sp of samples) if (distancePointToPolyline(sp, dp) <= P.coverTol) cover++;
        const coverRate = cover / samples.length;
    
        const ok = hitRate >= P.minHit && coverRate >= P.minCover;
        return { ok };
      }
    
      // ---------------------------
      // Master判定（旧main.js相当 / 理由付き）
      // ---------------------------
      function judgeTraceMasterDetailed(drawnPoints, strokePoly) {
        if (!Array.isArray(drawnPoints) || drawnPoints.length < MIN_POINTS) {
          return { ok: false, reason: MASTER_FAIL_REASON.TOO_SHORT };
        }
    
        const dp = normalizeDrawnPoints(drawnPoints, { step: RESAMPLE_STEP, minMoveEps: MIN_MOVE_EPS });
        if (dp.length < 2) {
          return { ok: false, reason: MASTER_FAIL_REASON.TOO_SHORT };
        }
    
        const strokeLen = polylineLength(strokePoly);
        if (strokeLen <= 0) {
          return { ok: false, reason: MASTER_FAIL_REASON.BAD_SHAPE };
        }
    
        const P = getAdaptiveParams(strokeLen, {
                      tolerance: TOLERANCE,
                      startTol: START_TOL,
                      minHitRate: MIN_HIT_RATE,
                      minDrawLenRate: MIN_DRAW_LEN_RATE,
                      minCoverRate: MIN_COVER_RATE,
                    });
        // Masterは救済しない
    
        // 開始位置ずれ（Master理由：START_OFF）
        const start = dp[0];
        const s0 = strokePoly[0];
        if (dist(start, s0) > P.startTol) {
          return { ok: false, reason: MASTER_FAIL_REASON.START_OFF };
        }
    
        // 短すぎ（Master理由：TOO_SHORT）
        const drawnLen = polylineLength(dp);
        if (drawnLen < strokeLen * P.minDraw) {
          return { ok: false, reason: MASTER_FAIL_REASON.TOO_SHORT };
        }
    
        // 線から離れすぎ（安全柵：明らかに別物）
        let sumD = 0;
        for (const p of dp) sumD += distancePointToPolyline(p, strokePoly);
        const avgD = sumD / dp.length;
        if (avgD > P.tol * 2.2) {
          return { ok: false, reason: MASTER_FAIL_REASON.FAR_FROM_STROKE };
        }
    
        // hit/cover
        let hit = 0;
        for (const p of dp) if (distancePointToPolyline(p, strokePoly) <= P.tol) hit++;
        const hitRate = hit / dp.length;
    
        const samples = sampleAlongPolyline(strokePoly, COVER_SAMPLES);
        let cover = 0;
        for (const sp of samples) if (distancePointToPolyline(sp, dp) <= P.coverTol) cover++;
        const coverRate = cover / samples.length;
    
        if (hitRate >= P.minHit && coverRate >= P.minCover) {
          return { ok: true, reason: null };
        }
        return { ok: false, reason: MASTER_FAIL_REASON.BAD_SHAPE };
      }
  
  // 旧（簡易）evaluateStroke/coverageRate/resample系は「旧判定相当」で置き換え済みのため削除