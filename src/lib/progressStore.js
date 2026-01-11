const KEY = "ktj_progress_v1";

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: {}, stats: { totalCleared: 0 } };
    return JSON.parse(raw);
  } catch {
    return { cleared: {}, stats: { totalCleared: 0 } };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function markCleared(progress, itemId, payload = {}) {
  const existed = !!progress.cleared[itemId];
  progress.cleared[itemId] = { clearedAt: Date.now(), ...progress.cleared[itemId], ...payload };
  if (!existed) progress.stats.totalCleared = (progress.stats.totalCleared ?? 0) + 1;
  return progress;
}

export function isCleared(progress, itemId) {
  return !!progress.cleared[itemId];
}

