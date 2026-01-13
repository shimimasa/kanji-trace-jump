export const CONTENT_MANIFEST = [
    // ✅ kanji_all を共通参照（フィルタは id から grade を読む）
  { type: "kanji", id: "kanji_g1",  label: "漢字（小1）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g2",  label: "漢字（小2）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g3",  label: "漢字（小3）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g4",  label: "漢字（小4）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g5",  label: "漢字（小5）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g6",  label: "漢字（小6）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g7",  label: "漢字（中1）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g8",  label: "漢字（中2）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g9",  label: "漢字（中3）",  source: "data/kanji/kanji_all.json" },
  { type: "kanji", id: "kanji_g10", label: "漢字（高校/常用拡張）", source: "data/kanji/kanji_all.json" },
  // ✅ 追加：かな / 英字など（まずは導入用の最小セットだけ入れる）
  // ひらがな
  { type: "hiragana", id: "hiragana_row_a", label: "ひらがな（あ行）", source: "data/hiragana/hiragana_all.json" },
  // カタカナ
  { type: "katakana", id: "katakana_row_a", label: "カタカナ（ア行）", source: "data/katakana/katakana_all.json" },
  // アルファベット
  { type: "alphabet", id: "alphabet_upper", label: "アルファベット（大文字）", source: "data/alphabet/alphabet_upper_all.json" },
  { type: "alphabet", id: "alphabet_lower", label: "アルファベット（小文字）", source: "data/alphabet/alphabet_lower_all.json" },
  // ローマ字（※実体は英字だが、導線のためタイプを分ける）
  { type: "romaji", id: "romaji_vowels", label: "ローマ字（母音）", source: "data/romaji/romaji_all.json" },
  ];
  
  export function groupByType(list) {
    return list.reduce((acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    }, {});
  }
  