// src/lib/titleBookStore.js
//
// Title Book store (称号ずかんの永続化)
// - startTraceGame から称号を登録
// - TitleBookScreen から一覧表示
//
// Storage: ktj_title_book_v1

export const TITLE_BOOK_LS_KEY = "ktj_title_book_v1";

// 理想：title/rarity/hint は現行UI互換。追加フィールドは将来拡張用（今は使わなくてもOK）。
export const TITLE_CATALOG = [
  // =========================================================
  // 0) 共通：プレイ成績系（既存を維持）
  // =========================================================
  { title: "スピード王", rarity: "N", hint: "はやくクリア", category: "performance", rangeId: "all", sortKey: 10 },
  { title: "かんぺき王", rarity: "R", hint: "高せいこうりつ＋きゅうさい少", category: "performance", rangeId: "all", sortKey: 11 },
  { title: "ていねい王", rarity: "N", hint: "せいこうりつ高め", category: "performance", rangeId: "all", sortKey: 12 },
  { title: "あきらめない王", rarity: "N", hint: "きゅうさい多めでも続けた", category: "performance", rangeId: "all", sortKey: 13 },
  { title: "ナイス王", rarity: "N", hint: "いい感じ", category: "performance", rangeId: "all", sortKey: 14 },
  { title: "のびしろ王", rarity: "N", hint: "これから伸びる", category: "performance", rangeId: "all", sortKey: 15 },
  { title: "がんばり王", rarity: "N", hint: "ミスしても進めた", category: "performance", rangeId: "all", sortKey: 16 },
  { title: "チャレンジ王", rarity: "N", hint: "挑戦した", category: "performance", rangeId: "all", sortKey: 17 },
  { title: "つぎはA王", rarity: "N", hint: "もうすこし！", category: "performance", rangeId: "all", sortKey: 18 },
  { title: "スタート王", rarity: "N", hint: "はじめの一歩", category: "performance", rangeId: "all", sortKey: 19 },

  { title: "ノーミス王", rarity: "R", hint: "ミス0（せいこうりつ100%）", category: "performance", rangeId: "all", sortKey: 20 },
  { title: "きゅうさいゼロ王", rarity: "R", hint: "きゅうさい0でクリア", category: "performance", rangeId: "all", sortKey: 21 },
  { title: "タイムアタック王", rarity: "R", hint: "かなり速い", category: "performance", rangeId: "all", sortKey: 22 },
  { title: "連勝王", rarity: "SR", hint: "コンボ高めでクリア", category: "performance", rangeId: "all", sortKey: 23 },
  { title: "新記録王", rarity: "R", hint: "じこベスト更新", category: "performance", rangeId: "all", sortKey: 24 },

  // =========================================================
  // 1) MASTERモード（既存を維持）
  // =========================================================
  { title: "MASTER初合格", rarity: "R", hint: "Masterモードで初めて合格する", category: "master", rangeId: "master", sortKey: 30 },
  { title: "書き順マスター", rarity: "SR", hint: "順番×を出さずに合格する", category: "master", rangeId: "master", sortKey: 31 },
  { title: "線マスター", rarity: "R", hint: "線×を出さずに合格する", category: "master", rangeId: "master", sortKey: 32 },
  { title: "MASTER皆伝", rarity: "SR", hint: "Master合格をたくさん積み上げる", category: "master", rangeId: "master", sortKey: 33 },

  // =========================================================
  // 2) 文字種：かな・英字（新規）
  // =========================================================
  { title: "ひらがなデビュー", rarity: "N", hint: "ひらがなで1回クリア", category: "script", rangeId: "hira", sortKey: 100 },
  { title: "ひらがな名人", rarity: "R", hint: "ひらがなをたくさんクリア", category: "script", rangeId: "hira", sortKey: 101 },
  { title: "ひらがな皆伝", rarity: "SR", hint: "ひらがなをコンプリート", category: "script", rangeId: "hira", sortKey: 102 },

  { title: "カタカナデビュー", rarity: "N", hint: "カタカナで1回クリア", category: "script", rangeId: "kata", sortKey: 110 },
  { title: "カタカナ名人", rarity: "R", hint: "カタカナをたくさんクリア", category: "script", rangeId: "kata", sortKey: 111 },
  { title: "カタカナ皆伝", rarity: "SR", hint: "カタカナをコンプリート", category: "script", rangeId: "kata", sortKey: 112 },

  { title: "ABCデビュー", rarity: "N", hint: "アルファベットで1回クリア", category: "script", rangeId: "abc", sortKey: 120 },
  { title: "ABCマスター", rarity: "R", hint: "アルファベットをたくさんクリア", category: "script", rangeId: "abc", sortKey: 121 },
  { title: "ABC皆伝", rarity: "SR", hint: "アルファベットをコンプリート", category: "script", rangeId: "abc", sortKey: 122 },

  // =========================================================
  // 3) 学年：小1〜小6（新規：マイルストーン中心）
  //     ※「全部コンプ」だけだと遠すぎるので、途中の称号も用意
  // =========================================================
  { title: "小1のはじまり", rarity: "N", hint: "小1漢字で1回クリア", category: "grade", rangeId: "g1", sortKey: 200 },
  { title: "小1の半分", rarity: "R", hint: "小1漢字を半分くらい達成", category: "grade", rangeId: "g1", sortKey: 201 },
  { title: "小1コンプリート", rarity: "SR", hint: "小1漢字をコンプリート", category: "grade", rangeId: "g1", sortKey: 202 },

  { title: "小2のはじまり", rarity: "N", hint: "小2漢字で1回クリア", category: "grade", rangeId: "g2", sortKey: 210 },
  { title: "小2の半分", rarity: "R", hint: "小2漢字を半分くらい達成", category: "grade", rangeId: "g2", sortKey: 211 },
  { title: "小2コンプリート", rarity: "SR", hint: "小2漢字をコンプリート", category: "grade", rangeId: "g2", sortKey: 212 },

  { title: "小3のはじまり", rarity: "N", hint: "小3漢字で1回クリア", category: "grade", rangeId: "g3", sortKey: 220 },
  { title: "小3の半分", rarity: "R", hint: "小3漢字を半分くらい達成", category: "grade", rangeId: "g3", sortKey: 221 },
  { title: "小3コンプリート", rarity: "SR", hint: "小3漢字をコンプリート", category: "grade", rangeId: "g3", sortKey: 222 },

  { title: "小4のはじまり", rarity: "N", hint: "小4漢字で1回クリア", category: "grade", rangeId: "g4", sortKey: 230 },
  { title: "小4の半分", rarity: "R", hint: "小4漢字を半分くらい達成", category: "grade", rangeId: "g4", sortKey: 231 },
  { title: "小4コンプリート", rarity: "SR", hint: "小4漢字をコンプリート", category: "grade", rangeId: "g4", sortKey: 232 },

  { title: "小5のはじまり", rarity: "N", hint: "小5漢字で1回クリア", category: "grade", rangeId: "g5", sortKey: 240 },
  { title: "小5の半分", rarity: "R", hint: "小5漢字を半分くらい達成", category: "grade", rangeId: "g5", sortKey: 241 },
  { title: "小5コンプリート", rarity: "SR", hint: "小5漢字をコンプリート", category: "grade", rangeId: "g5", sortKey: 242 },

  { title: "小6のはじまり", rarity: "N", hint: "小6漢字で1回クリア", category: "grade", rangeId: "g6", sortKey: 250 },
  { title: "小6の半分", rarity: "R", hint: "小6漢字を半分くらい達成", category: "grade", rangeId: "g6", sortKey: 251 },
  { title: "小6コンプリート", rarity: "SR", hint: "小6漢字をコンプリート", category: "grade", rangeId: "g6", sortKey: 252 },

  // =========================================================
  // 4) 学年：中1〜中3（新規）
  // =========================================================
  { title: "中1のはじまり", rarity: "N", hint: "中1漢字で1回クリア", category: "grade", rangeId: "j1", sortKey: 300 },
  { title: "中1の半分", rarity: "R", hint: "中1漢字を半分くらい達成", category: "grade", rangeId: "j1", sortKey: 301 },
  { title: "中1コンプリート", rarity: "SR", hint: "中1漢字をコンプリート", category: "grade", rangeId: "j1", sortKey: 302 },

  { title: "中2のはじまり", rarity: "N", hint: "中2漢字で1回クリア", category: "grade", rangeId: "j2", sortKey: 310 },
  { title: "中2の半分", rarity: "R", hint: "中2漢字を半分くらい達成", category: "grade", rangeId: "j2", sortKey: 311 },
  { title: "中2コンプリート", rarity: "SR", hint: "中2漢字をコンプリート", category: "grade", rangeId: "j2", sortKey: 312 },

  { title: "中3のはじまり", rarity: "N", hint: "中3漢字で1回クリア", category: "grade", rangeId: "j3", sortKey: 320 },
  { title: "中3の半分", rarity: "R", hint: "中3漢字を半分くらい達成", category: "grade", rangeId: "j3", sortKey: 321 },
  { title: "中3コンプリート", rarity: "SR", hint: "中3漢字をコンプリート", category: "grade", rangeId: "j3", sortKey: 322 },

  // =========================================================
  // 5) 学年：高1（新規）
  // =========================================================
  { title: "高1のはじまり", rarity: "N", hint: "高1漢字で1回クリア", category: "grade", rangeId: "h1", sortKey: 400 },
  { title: "高1の半分", rarity: "R", hint: "高1漢字を半分くらい達成", category: "grade", rangeId: "h1", sortKey: 401 },
  { title: "高1コンプリート", rarity: "SR", hint: "高1漢字をコンプリート", category: "grade", rangeId: "h1", sortKey: 402 },

  // =========================================================
  // 6) 横断称号（新規：範囲拡大で特に効く）
  // =========================================================
  { title: "小学生マスター", rarity: "SR", hint: "小1〜小6をコンプリート", category: "milestone", rangeId: "elem", sortKey: 500 },
  { title: "中学生マスター", rarity: "SR", hint: "中1〜中3をコンプリート", category: "milestone", rangeId: "jhs", sortKey: 501 },
  { title: "基礎文字マスター", rarity: "SR", hint: "ひらがな・カタカナ・ABCをコンプリート", category: "milestone", rangeId: "basic", sortKey: 502 },
  { title: "ぜんぶマスター", rarity: "SR", hint: "すべての範囲をコンプリート", category: "milestone", rangeId: "all", sortKey: 503 },
];

// ----------------------------
// Types (informal)
// book = { items: { [title]: { title, rank?, rarity?, count, firstAt, lastAt } } }
// ----------------------------

export function getTitleMeta(title) {
  if (!title) return null;
  return TITLE_CATALOG.find((x) => x.title === title) ?? null;
}

export function loadTitleBook() {
  try {
    const raw = localStorage.getItem(TITLE_BOOK_LS_KEY);
    if (!raw) return { items: {} };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return { items: {} };
    if (!obj.items || typeof obj.items !== "object") obj.items = {};
    return obj;
  } catch {
    return { items: {} };
  }
}

export function saveTitleBook(book) {
  try {
    localStorage.setItem(TITLE_BOOK_LS_KEY, JSON.stringify(book));
  } catch {}
}

export function addTitleToBook({ title, rank = null, rarity = null, at = Date.now() }) {
  if (!title) return null;

  const meta = getTitleMeta(title);
  const rr = rarity ?? meta?.rarity ?? null;

  const book = loadTitleBook();
  const items = (book.items ||= {});
  const prev = items[title];

  if (prev) {
    items[title] = {
      ...prev,
      title,
      rank: rank ?? prev.rank ?? null,
      rarity: rr ?? prev.rarity ?? null,
      count: (prev.count ?? 0) + 1,
      lastAt: at,
      firstAt: prev.firstAt ?? at,
    };
  } else {
    items[title] = {
      title,
      rank: rank ?? null,
      rarity: rr,
      count: 1,
      firstAt: at,
      lastAt: at,
    };
  }

  saveTitleBook(book);
  return items[title];
}
