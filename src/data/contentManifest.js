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
  // ✅ 追加：かな（行セットを一気に拡大）
  // ひらがな（基本）
  { type: "hiragana", id: "hiragana_row_a",  label: "ひらがな（あ行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_ka", label: "ひらがな（か行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_sa", label: "ひらがな（さ行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_ta", label: "ひらがな（た行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_na", label: "ひらがな（な行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_ha", label: "ひらがな（は行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_ma", label: "ひらがな（ま行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_ya", label: "ひらがな（や行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_ra", label: "ひらがな（ら行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_row_wa", label: "ひらがな（わ行）", source: "data/hiragana/hiragana_all.json" },

  // ひらがな（濁点/半濁点）
  { type: "hiragana", id: "hiragana_dakuten_ga", label: "ひらがな（が行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_dakuten_za", label: "ひらがな（ざ行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_dakuten_da", label: "ひらがな（だ行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_dakuten_ba", label: "ひらがな（ば行）", source: "data/hiragana/hiragana_all.json" },
  { type: "hiragana", id: "hiragana_handakuten_pa", label: "ひらがな（ぱ行）", source: "data/hiragana/hiragana_all.json" },

  // ひらがな（小書き）
  { type: "hiragana", id: "hiragana_small_tsu_ya_yu_yo", label: "ひらがな（小さい っゃゅょ）", source: "data/hiragana/hiragana_all.json" },
  
  // カタカナ（基本）
  { type: "katakana", id: "katakana_row_a",  label: "カタカナ（ア行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_ka", label: "カタカナ（カ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_sa", label: "カタカナ（サ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_ta", label: "カタカナ（タ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_na", label: "カタカナ（ナ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_ha", label: "カタカナ（ハ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_ma", label: "カタカナ（マ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_ya", label: "カタカナ（ヤ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_ra", label: "カタカナ（ラ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_row_wa", label: "カタカナ（ワ行）", source: "data/katakana/katakana_all.json" },
  
  // カタカナ（濁点/半濁点）
  { type: "katakana", id: "katakana_dakuten_ga", label: "カタカナ（ガ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_dakuten_za", label: "カタカナ（ザ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_dakuten_da", label: "カタカナ（ダ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_dakuten_ba", label: "カタカナ（バ行）", source: "data/katakana/katakana_all.json" },
  { type: "katakana", id: "katakana_handakuten_pa", label: "カタカナ（パ行）", source: "data/katakana/katakana_all.json" },

  // カタカナ（小書き）
  { type: "katakana", id: "katakana_small_tsu_ya_yu_yo", label: "カタカナ（小さい ッャュョ）", source: "data/katakana/katakana_all.json" },
  // アルファベット
  { type: "alphabet", id: "alphabet_upper", label: "アルファベット（大文字）", source: "data/alphabet/alphabet_upper_all.json" },
  { type: "alphabet", id: "alphabet_lower", label: "アルファベット（小文字）", source: "data/alphabet/alphabet_lower_all.json" },
  ];
  
  export function groupByType(list) {
    return list.reduce((acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    }, {});
  }
  