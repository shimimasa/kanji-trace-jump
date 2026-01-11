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
  ];
  
  export function groupByType(list) {
    return list.reduce((acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    }, {});
  }
  