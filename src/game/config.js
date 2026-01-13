// src/game/config.js
export const SET_SIZE = 5;
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
