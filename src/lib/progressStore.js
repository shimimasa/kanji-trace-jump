// src/lib/progressStore.js
const KEY = "ktj_progress_v1";

// 進捗モデル（例）
// progress = {
//   cleared: { "<itemId>": { clearedAt, bestTimeMs? } },
//   stats: { totalCleared: number, ... }
// }

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: {}, stats: { totalCleared: 0 } };
    const parsed = JSON.parse(raw);
    return parsed ?? { cleared: {}, stats: { totalCleared: 0 } };
  } catch {
    return { cleared: {}, stats: { totalCleared: 0 } };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function markCleared(progress, itemId, payload = {}) {
  const exists = !!progress.cleared[itemId];
  progress.cleared[itemId] = {
    clearedAt: Date.now(),
    ...progress.cleared[itemId],
    ...payload,
  };
  if (!exists) progress.stats.totalCleared = (progress.stats.totalCleared ?? 0) + 1;
  return progress;
}

export function isCleared(progress, itemId) {
  return !!progress.cleared[itemId];
}
