// src/lib/progressKey.js
// 進捗キーを「文字種対応」にする
// key = `${type}::${id}`

export const KEY_SEP = "::";
export const DEFAULT_TYPE = "kanji";

/** 正規キー（推奨） */
export function makeProgressKey(type, itemId) {
  const t = String(type ?? DEFAULT_TYPE).trim() || DEFAULT_TYPE;
  return `${t}${KEY_SEP}${String(itemId)}`;
}

// ---- 互換のために残す（既存コードを壊さない） ----
export const KANJI_KEY_PREFIX = "kanji::";
export function makeKanjiKey(itemId) {
  return makeProgressKey("kanji", itemId);
}

/**
+ * 旧キーを正規キーへ寄せる（ロード時マイグレーション用）
+ * - 既に `type::id` ならそのまま
+ * - 旧: kanji_g2::g2-001 などは kanji::g2-001 に
+ * - 旧: g2::g2-001 なども kanji::g2-001 に
+ * - 旧: kanji::id もそのまま
+ */
export function normalizeToProgressKey(key) {
  const k = String(key ?? "");
  if (!k) return k;

  // すでに type::id 形式（type側が空でなければOK）
  const sep = k.indexOf(KEY_SEP);
  if (sep > 0) {
    const type = k.slice(0, sep);
    const id = k.slice(sep + KEY_SEP.length);
    // "kanji::" みたいに id が空の壊れたデータはそのまま返す
    if (!type || !id) return k;
    return `${type}${KEY_SEP}${id}`;
  }

  // 旧: kanji_g2::g2-001 → kanji::g2-001
  const m1 = k.match(/^kanji_g\d+::(.+)$/);
  if (m1) return makeProgressKey("kanji", m1[1]);

  // 旧: g2::g2-001 → kanji::g2-001
  const m2 = k.match(/^g\d+::(.+)$/);
  if (m2) return makeProgressKey("kanji", m2[1]);

  return k;
}

// 互換：旧名も残す
export function normalizeToKanjiKey(key) {
  return normalizeToProgressKey(key);
}