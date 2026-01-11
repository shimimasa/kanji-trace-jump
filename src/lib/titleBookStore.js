// src/lib/titleBookStore.js
//
// Title Book store (称号ずかんの永続化)
// - startTraceGame から称号を登録
// - TitleBookScreen から一覧表示
//
// Storage: ktj_title_book_v1

export const TITLE_BOOK_LS_KEY = "ktj_title_book_v1";

// ✅ 全称号カタログ（ここが唯一の定義元）
export const TITLE_CATALOG = [
  { title: "スピード王", rarity: "N", hint: "はやくクリア" },
  { title: "かんぺき王", rarity: "R", hint: "高せいこうりつ＋きゅうさい少" },
  { title: "ていねい王", rarity: "N", hint: "せいこうりつ高め" },
  { title: "あきらめない王", rarity: "N", hint: "きゅうさい多めでも続けた" },
  { title: "ナイス王", rarity: "N", hint: "いい感じ" },
  { title: "のびしろ王", rarity: "N", hint: "これから伸びる" },
  { title: "がんばり王", rarity: "N", hint: "ミスしても進めた" },
  { title: "チャレンジ王", rarity: "N", hint: "挑戦した" },
  { title: "つぎはA王", rarity: "N", hint: "もうすこし！" },
  { title: "スタート王", rarity: "N", hint: "はじめの一歩" },
  // --- Rare / Epic ---
  { title: "ノーミス王", rarity: "R", hint: "ミス0（せいこうりつ100%）" },
  { title: "きゅうさいゼロ王", rarity: "R", hint: "きゅうさい0でクリア" },
  { title: "タイムアタック王", rarity: "R", hint: "かなり速い" },
  { title: "連勝王", rarity: "SR", hint: "コンボ高めでクリア" },
  { title: "新記録王", rarity: "R", hint: "じこベスト更新" },
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
