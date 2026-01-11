export const CONTENT_MANIFEST = [
    {
      type: "kanji",
      id: "kanji_g1",
      label: "漢字（小1）",
      source: "data/kanji_g1_proto.json",
    },
    // 将来ここに追加：
    // { type:"kanji", id:"kanji_g2", label:"漢字（小2）", source:"data/kanji_g2.json" },
    // { type:"hiragana", id:"hiragana", label:"ひらがな", source:"data/hiragana.json" },
  ];
  
  export function groupByType(list) {
    return list.reduce((acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    }, {});
  }
  