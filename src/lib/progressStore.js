const KEY = "ktj_progress_v1";
import { normalizeToProgressKey } from "./progressKey.js";

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: {}, items: {}, stats: { totalCleared: 0 } };
    const parsed = JSON.parse(raw);
    // 後方互換：itemsが無い古いデータを救済
    if (!parsed.items) parsed.items = {};
    if (!parsed.cleared) parsed.cleared = {};
    if (!parsed.stats) parsed.stats = { totalCleared: 0 };
    // ✅ 旧キー → 新キーへ移行（段階1）
    migrateKeysInPlace(parsed);
    return parsed;
  } catch {
    return { cleared: {}, items: {}, stats: { totalCleared: 0 } };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

function migrateKeysInPlace(progress) {
    // cleared
    const nextCleared = {};
    for (const k in (progress.cleared || {})) {
      const nk = normalizeToProgressKey(k);
      nextCleared[nk] = progress.cleared[k];
    }
    progress.cleared = nextCleared;
  
    // items
    const nextItems = {};
    for (const k in (progress.items || {})) {
      const nk = normalizeToProgressKey(k);
      // 同じ漢字に統合された場合は “より新しい/大きい” 側を優先してマージ
      const cur = progress.items[k];
      const prev = nextItems[nk];
      if (!prev) {
        nextItems[nk] = cur;
      } else {
        nextItems[nk] = {
          ...prev,
          ...cur,
          attempts: Math.max(prev.attempts ?? 0, cur.attempts ?? 0),
          fails: Math.max(prev.fails ?? 0, cur.fails ?? 0),
          lastAttemptAt: Math.max(prev.lastAttemptAt ?? 0, cur.lastAttemptAt ?? 0),
          clearedAt: prev.clearedAt ?? cur.clearedAt,
          masterAttempts: Math.max(prev.masterAttempts ?? 0, cur.masterAttempts ?? 0),
          masterPasses: Math.max(prev.masterPasses ?? 0, cur.masterPasses ?? 0),
          masterLastAt: Math.max(prev.masterLastAt ?? 0, cur.masterLastAt ?? 0),
          masterMistakes: mergeMistakes(prev.masterMistakes, cur.masterMistakes),
        };
      }
    }
    progress.items = nextItems;
  }
  
  function mergeMistakes(a = {}, b = {}) {
    const out = { ...a };
    for (const k in b) out[k] = Math.max(out[k] ?? 0, b[k] ?? 0);
    return out;
  }

// ===========================
// Review session persistence
// ===========================
function ensureReview(progress) {
    if (!progress.reviewSessions) progress.reviewSessions = [];
    return progress.reviewSessions;
  }
  
  /**
  + * reviewSession = {
  + *   at: number,
  + *   rangeId: string,
  + *   total: number,
  + *   clearedCount: number,
  + *   totalFails: number,
  + *   policy?: string,
  + *   onlyUncleared?: boolean
  + * }
  + */
  export function recordReviewSession(progress, session) {
    const list = ensureReview(progress);
    list.unshift({ at: Date.now(), ...session });
    // 直近30件だけ
    progress.reviewSessions = list.slice(0, 30);
    return progress.reviewSessions[0];
  }

function ensureItem(progress, itemId) {
      if (!progress.items) progress.items = {};
      if (!progress.items[itemId]) {
        progress.items[itemId] = {
          attempts: 0,
          fails: 0,
          lastAttemptAt: 0,
          clearedAt: null,
          // ✅ Master stats (A-4)
          masterAttempts: 0,
          masterPasses: 0,
          masterLastAt: 0,
          masterMistakes: {
            WRONG_ORDER: 0,
            BAD_SHAPE: 0,
            TOO_SHORT: 0,
            START_OFF: 0,
            FAR_FROM_STROKE: 0,
          },
        };
      }
      return progress.items[itemId];
    }

export function markCleared(progress, itemId, payload = {}) {
  const existed = !!progress.cleared[itemId];
  progress.cleared[itemId] = { clearedAt: Date.now(), ...progress.cleared[itemId], ...payload };
  if (!existed) progress.stats.totalCleared = (progress.stats.totalCleared ?? 0) + 1;
  
  // itemsにも同期（復習ソート用）
  const it = ensureItem(progress, itemId);
  it.clearedAt = progress.cleared[itemId].clearedAt;
  it.lastAttemptAt = Date.now();
return progress;
}

export function isCleared(progress, itemId) {
  return !!progress.cleared[itemId];
}

// ✅ 判定回数/失敗回数/最終挑戦日時を記録（未クリアでもOK）
export function recordAttempt(progress, itemId, { failed }) {
      const it = ensureItem(progress, itemId);
      it.attempts = (it.attempts ?? 0) + 1;
      if (failed) it.fails = (it.fails ?? 0) + 1;
      it.lastAttemptAt = Date.now();
      return it;
    }
    // ✅ Master attempt record (A-4)
// reason は startTraceGame の MASTER_FAIL_REASON のキー（例: "WRONG_ORDER"）
export function recordMasterAttempt(progress, itemId, { ok, reason }) {
    const it = ensureItem(progress, itemId);
    it.masterAttempts = (it.masterAttempts ?? 0) + 1;
    it.masterLastAt = Date.now();
    if (!ok) {
      const mm = (it.masterMistakes ||= {});
      const key = String(reason || "BAD_SHAPE");
      mm[key] = (mm[key] ?? 0) + 1;
    }
    return it;
  }
  
  export function recordMasterPass(progress, itemId) {
    const it = ensureItem(progress, itemId);
    it.masterPasses = (it.masterPasses ?? 0) + 1;
    it.masterLastAt = Date.now();
    return it;
  }
    // 便利：弱点スコアを計算（Dex側のソートに使う）
    export function getWeakScore(progress, itemId) {
      const it = progress?.items?.[itemId];
      if (!it) return 0;
      const a = Math.max(1, it.attempts ?? 0);
      const f = Math.max(0, it.fails ?? 0);
      // 失敗率を主軸＋失敗回数を加点（好みで調整可）
      return (f / a) * 1000 + f * 10;
    }