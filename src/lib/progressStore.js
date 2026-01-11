const KEY = "ktj_progress_v1";

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: {}, items: {}, stats: { totalCleared: 0 } };
    const parsed = JSON.parse(raw);
    // 後方互換：itemsが無い古いデータを救済
    if (!parsed.items) parsed.items = {};
    if (!parsed.cleared) parsed.cleared = {};
    if (!parsed.stats) parsed.stats = { totalCleared: 0 };
    return parsed;
  } catch {
    return { cleared: {}, items: {}, stats: { totalCleared: 0 } };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
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
    
    // 便利：弱点スコアを計算（Dex側のソートに使う）
    export function getWeakScore(progress, itemId) {
      const it = progress?.items?.[itemId];
      if (!it) return 0;
      const a = Math.max(1, it.attempts ?? 0);
      const f = Math.max(0, it.fails ?? 0);
      // 失敗率を主軸＋失敗回数を加点（好みで調整可）
      return (f / a) * 1000 + f * 10;
    }