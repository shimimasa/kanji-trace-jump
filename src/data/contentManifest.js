// src/data/contentManifest.js

// type: "kanji" | "hiragana" | "katakana" | "romaji" | "alphabet"
// id: 範囲の識別子（保存や進捗のキーにも使う）
// source: 読み込むJSON（public/data/...）
// label: 画面表示

export const CONTENT_MANIFEST = [
    {
      type: "kanji",
      id: "kanji_g1",
      label: "漢字（小1）",
      source: "data/kanji_g1_proto.json",
    },
    // 将来追加するだけ
    // { type:"kanji", id:"kanji_g2", label:"漢字（小2）", source:"data/kanji_g2.json" },
    // ...
    // { type:"hiragana", id:"hiragana_basic", label:"ひらがな", source:"data/hiragana.json" },
    // { type:"katakana", id:"katakana_basic", label:"カタカナ", source:"data/katakana.json" },
    // { type:"romaji", id:"romaji_basic", label:"ローマ字", source:"data/romaji.json" },
    // { type:"alphabet", id:"alphabet_upper", label:"アルファベット（大文字）", source:"data/alphabet_upper.json" },
  ];
  
  export function groupByType(list) {
    return list.reduce((acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    }, {});
  }
  