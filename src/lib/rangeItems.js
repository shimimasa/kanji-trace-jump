// src/lib/rangeItems.js
// 範囲（rangeId）→ 実際に扱う item 配列を「全画面共通」で返す
// - Game(startTraceGame) と Progress/Dex/Review の母数ズレをなくす目的

import { CONTENT_MANIFEST } from "../data/contentManifest.js";

function getBaseUrl() {
  const base = import.meta.env.BASE_URL ?? "/";
  return new URL(base, window.location.href);
}

export function getRangeById(rangeId) {
  const id = rangeId ?? "kanji_g1";
  return CONTENT_MANIFEST.find((x) => x.id === id) ?? null;
}

export function getRangeType(rangeId) {
  return getRangeById(rangeId)?.type ?? "kanji";
}

export function extractKanjiGrade(rangeId) {
  const m = String(rangeId ?? "").match(/kanji_g(\d+)/);
  return m ? Number(m[1]) : null;
}

// startTraceGame 内の rowMap と同等（母数ズレの原因なので、ここに寄せる）
const KANA_ROW_MAP = {
  // --- ひらがな（基本） ---
  hiragana_row_a: ["あ", "い", "う", "え", "お"],
  hiragana_row_ka: ["か", "き", "く", "け", "こ"],
  hiragana_row_sa: ["さ", "し", "す", "せ", "そ"],
  hiragana_row_ta: ["た", "ち", "つ", "て", "と"],
  hiragana_row_na: ["な", "に", "ぬ", "ね", "の"],
  hiragana_row_ha: ["は", "ひ", "ふ", "へ", "ほ"],
  hiragana_row_ma: ["ま", "み", "む", "め", "も"],
  hiragana_row_ya: ["や", "ゆ", "よ"],
  hiragana_row_ra: ["ら", "り", "る", "れ", "ろ"],
  hiragana_row_wa: ["わ", "を", "ん"],

  // --- ひらがな（濁点/半濁点） ---
  hiragana_dakuten_ga: ["が", "ぎ", "ぐ", "げ", "ご"],
  hiragana_dakuten_za: ["ざ", "じ", "ず", "ぜ", "ぞ"],
  hiragana_dakuten_da: ["だ", "ぢ", "づ", "で", "ど"],
  hiragana_dakuten_ba: ["ば", "び", "ぶ", "べ", "ぼ"],
  hiragana_handakuten_pa: ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"],

  // --- ひらがな（小書き） ---
  hiragana_small_tsu_ya_yu_yo: ["っ", "ゃ", "ゅ", "ょ"],

 // --- カタカナ（基本） ---
  katakana_row_a: ["ア", "イ", "ウ", "エ", "オ"],
  katakana_row_ka: ["カ", "キ", "ク", "ケ", "コ"],
  katakana_row_sa: ["サ", "シ", "ス", "セ", "ソ"],
  katakana_row_ta: ["タ", "チ", "ツ", "テ", "ト"],
  katakana_row_na: ["ナ", "ニ", "ヌ", "ネ", "ノ"],
  katakana_row_ha: ["ハ", "ヒ", "フ", "ヘ", "ホ"],
  katakana_row_ma: ["マ", "ミ", "ム", "メ", "モ"],
  katakana_row_ya: ["ヤ", "ユ", "ヨ"],
  katakana_row_ra: ["ラ", "リ", "ル", "レ", "ロ"],
  katakana_row_wa: ["ワ", "ヲ", "ン"],

  // --- カタカナ（濁点/半濁点） ---
  katakana_dakuten_ga: ["ガ", "ギ", "グ", "ゲ", "ゴ"],
  katakana_dakuten_za: ["ザ", "ジ", "ズ", "ゼ", "ゾ"],
  katakana_dakuten_da: ["ダ", "ヂ", "ヅ", "デ", "ド"],
  katakana_dakuten_ba: ["バ", "ビ", "ブ", "ベ", "ボ"],
  katakana_handakuten_pa: ["パ", "ピ", "プ", "ペ", "ポ"],

  // --- カタカナ（小書き） ---
  katakana_small_tsu_ya_yu_yo: ["ッ", "ャ", "ュ", "ョ"],
};

export function getKanaAllowList(rangeId) {
  return KANA_ROW_MAP[rangeId] ?? null;
}

function getTraceableIndexPath(type, rangeId) {
  const baseUrl = getBaseUrl();
  switch (type) {
    case "hiragana":
      return new URL("data/hiragana/index_traceable_hiragana.json", baseUrl).toString();
    case "katakana":
      return new URL("data/katakana/index_traceable_katakana.json", baseUrl).toString();
    case "alphabet":
      // upper/lower を分ける（startTraceGame と合わせる）
      if (String(rangeId).includes("upper")) {
        return new URL("data/alphabet/index_traceable_alphabet_upper.json", baseUrl).toString();
      }
      return new URL("data/alphabet/index_traceable_alphabet_lower.json", baseUrl).toString();
    case "romaji":
      return new URL("data/romaji/index_traceable_romaji.json", baseUrl).toString();
    case "kanji":
    default:
      return new URL("data/kanji/index_traceable.json", baseUrl).toString();
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.json();
}

function pickChar(it) {
  return it?.kanji ?? it?.char ?? it?.letter ?? it?.symbol ?? it?.text ?? null;
}

/**
+ * 画面用：rangeIdに対応する「実際に扱うitems」を返す
+ * - Gameと同じ条件で絞る（母数を一致させる）
+ */
export async function loadRangeItems(rangeId) {
  const range = getRangeById(rangeId);
  if (!range) throw new Error(`range not found: ${String(rangeId)}`);

  const type = range.type ?? "kanji";
  const baseUrl = getBaseUrl();
  const allUrl = new URL(range.source, baseUrl).toString();

  const all = await fetchJson(allUrl);
  if (!Array.isArray(all)) throw new Error("all.json は配列である必要があります");

  // traceable（alphabetは例外：全件採用でも進める）
  let traceSet = null;
  if (type !== "alphabet") {
    try {
      const trUrl = getTraceableIndexPath(type, rangeId);
      const traceable = await fetchJson(trUrl);
      traceSet = new Set(Array.isArray(traceable) ? traceable : []);
    } catch {
      traceSet = new Set();
    }
  }

  const grade = type === "kanji" ? extractKanjiGrade(rangeId) : null;
  const allow = (type === "hiragana" || type === "katakana") ? getKanaAllowList(rangeId) : null;

  const items = all
    .filter((it) => {
      const ch = pickChar(it);
      if (!it?.id || !ch) return false;
      if (!it?.strokesRef) return false;

      // traceable（alphabet以外）
      if (type !== "alphabet") {
        if (!traceSet || !traceSet.has(it.id)) return false;
      }

      // kanji: grade
      if (type === "kanji" && grade != null) {
        if (Number(it.grade) !== grade) return false;
      }

      // kana: row
      if (allow && Array.isArray(allow)) {
        if (!allow.includes(ch)) return false;
      }

      return true;
    });

  return { range, type, items };
}