// src/lib/progressKey.js
export const KANJI_KEY_PREFIX = "kanji::";

/** 正規キー */
export function makeKanjiKey(itemId) {
  return `${KANJI_KEY_PREFIX}${String(itemId)}`;
}

/** 旧キーから id を抽出して正規キーに寄せる */
export function normalizeToKanjiKey(key) {
  const k = String(key ?? "");

  // すでに正規
  if (k.startsWith(KANJI_KEY_PREFIX)) return k;

  // 旧: kanji_g2::g2-001 → g2-001
  const m1 = k.match(/^kanji_g\d+::(.+)$/);
  if (m1) return makeKanjiKey(m1[1]);

  // 旧: g2::g2-001 → g2-001
  const m2 = k.match(/^g\d+::(.+)$/);
  if (m2) return makeKanjiKey(m2[1]);

  // 旧: kanji::id 以外はそのまま
  return k;
}
