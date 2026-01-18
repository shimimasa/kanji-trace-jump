// ===========================
// Gameplay options (defaults)
// ===========================
// 1セットの文字数（UIの「もくひょう：○もじ」や結果の setLen に影響）
export const DEFAULT_SET_SIZE = 5;

// 互換：既存コードが SET_SIZE を参照しているので残す
export const SET_SIZE = DEFAULT_SET_SIZE;
export const AUTO_NEXT_DELAY_MS = 650;

export const JUMP_MS = 520;
export const FAIL_MS = 520;

export const TOLERANCE = 20;
export const START_TOL = 34;

export const MIN_HIT_RATE = 0.45;
export const MIN_DRAW_LEN_RATE = 0.15;
export const MIN_COVER_RATE = 0.35;
export const MIN_POINTS = 3;
export const MIN_MOVE_EPS = 0.35;
export const RESAMPLE_STEP = 1.2;
export const COVER_SAMPLES = 32;

export const COMBO_WINDOW_MS = 1400;

export const MASTER_FAIL_REASON = {
  WRONG_ORDER: "WRONG_ORDER",
  BAD_SHAPE: "BAD_SHAPE",
  TOO_SHORT: "TOO_SHORT",
  START_OFF: "START_OFF",
  FAR_FROM_STROKE: "FAR_FROM_STROKE",
};

export function failReasonLabel(reason) {
  switch (reason) {
    case MASTER_FAIL_REASON.WRONG_ORDER: return "順番×";
    case MASTER_FAIL_REASON.BAD_SHAPE: return "線×";
    case MASTER_FAIL_REASON.TOO_SHORT: return "短×";
    case MASTER_FAIL_REASON.START_OFF: return "始×";
    case MASTER_FAIL_REASON.FAR_FROM_STROKE: return "外×";
    default: return "×";
  }
}

// ===========================
// Master mode UI/behavior (v2)
// ===========================
export const MASTER_HINT_TEXT = "書き順を思い出して書こう";

// Master: どの線でも開始OKだが、線から遠すぎるタップは除外
export const START_TOL_MASTER = 26;

// 猫の待機位置（viewBox内に置く。外に出したいなら負値でもOK）
export const CAT_WAIT_POS = { x: 8, y: 92 };

// Master fail mark (SVG text)
export const MASTER_FAIL_MARK_POS = { x: 50, y: 56 };

// Title popup timing (ms)
export const TITLE_POPUP_MS = 2200;

// Confetti defaults
export const CONFETTI_DEFAULTS = { durationMs: 1600, count: 70 };

// ===========================
// UI timings (ms)
// ===========================
export const TITLE_POPUP_FADE_OUT_MS = 500;
export const MASTER_FAIL_FLASH_MS = 320;
export const MASTER_FAIL_MARK_MS = 520;

// ===========================
// Master strictness knobs
// ===========================
// Phase2 推定後、同一ストローク扱いの許容（今は未使用、将来の調整用）
export const MASTER_GUESS_EPS = 0;