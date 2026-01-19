// src/screens/TitleBookScreen.js
import { TITLE_CATALOG, loadTitleBook } from "../lib/titleBookStore.js";

const TITLE_BOOK_SORT_LS_KEY = "ktj_title_book_sort_v1";
const TITLE_BOOK_SEARCH_LS_KEY = "ktj_title_book_search_v1";
const TITLE_BOOK_FILTER_LS_KEY = "ktj_title_book_filter_v1";

function normalizeJa(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function rarityWeight(r) {
  if (r === "SR") return 3;
  if (r === "R") return 2;
  if (r === "N") return 1;
  return 0;
}

function loadTitleBookSort() {
  try {
    return localStorage.getItem(TITLE_BOOK_SORT_LS_KEY) || "rarity";
  } catch {
    return "rarity";
  }
}
function saveTitleBookSort(mode) {
  try {
    localStorage.setItem(TITLE_BOOK_SORT_LS_KEY, mode);
  } catch {}
}

function loadTitleBookFilter() {
    try {
      return localStorage.getItem(TITLE_BOOK_FILTER_LS_KEY) || "all";
    } catch {
      return "all";
    }
  }
  function saveTitleBookFilter(v) {
    try {
      localStorage.setItem(TITLE_BOOK_FILTER_LS_KEY, v);
    } catch {}
  }

function loadTitleBookSearch() {
  try {
    return localStorage.getItem(TITLE_BOOK_SEARCH_LS_KEY) || "";
  } catch {
    return "";
  }
}
function saveTitleBookSearch(q) {
  try {
    localStorage.setItem(TITLE_BOOK_SEARCH_LS_KEY, q ?? "");
  } catch {}
}

function safeRemoveLS(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// old-main.js系キー互換（必要なら増やしてOK）
function resetProgressOnly() {
  safeRemoveLS("ktj_progress_v2");
  safeRemoveLS("ktj_progress_v1");
}

function resetAllLocalData() {
  resetProgressOnly();
  safeRemoveLS("ktj_set_results_v1");
  safeRemoveLS("ktj_set_pb_v1");
  safeRemoveLS("ktj_title_book_v1");
  safeRemoveLS("ktj_title_book_sort_v1");
  safeRemoveLS("ktj_title_book_search_v1");
}

function confirmReset(kind = "progress") {
  const msg =
    kind === "all"
      ? "本当にリセットしますか？\n\n・進捗\n・自己ベスト\n・ランク/称号/図鑑\n・履歴\n\nすべて消えます。"
      : "進捗だけリセットしますか？\n（自己ベスト・称号図鑑は残ります）";
  return window.confirm(msg);
}

export function TitleBookScreen(ctx, nav) {
  let inputTimer = null;

  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen titlebook";

      const book = loadTitleBook();
      const ownedMap = book.items || {};

      const total = TITLE_CATALOG.length;
      const got = Object.keys(ownedMap).length;
      const pct = total > 0 ? Math.round((got / total) * 100) : 0;
      const remain = Math.max(0, total - got);

      const sortMode = loadTitleBookSort(); // "rarity" | "recent" | "name" | "recommend" | "recommend"
      const searchQuery = loadTitleBookSearch();
      const qn = normalizeJa(searchQuery);
      const filterMode = loadTitleBookFilter(); // "all" | "performance" | "master" | "script" | "grade" | "milestone"
      

      const display = TITLE_CATALOG.map((meta) => {
        const owned = ownedMap?.[meta.title] || null;
        return {
          meta,
          owned,
          lastAt: owned?.lastAt ?? 0,
          count: owned?.count ?? 0,
          rarity: owned?.rarity ?? meta.rarity ?? null,
          title: meta.title,
          isOwned: !!owned,
          category: meta.category ?? "other",
        };
      });

      display.sort((a, b) => {
        // 共通：取得済みは上へ
        if (a.isOwned !== b.isOwned) return a.isOwned ? -1 : 1;

        // ✅ おすすめ：未取得は「取りやすい順（N→R→SR）」で上へ
        if (sortMode === "recommend") {
          if (!a.isOwned && !b.isOwned) {
            const rwEasy = rarityWeight(a.rarity) - rarityWeight(b.rarity); // N(1)→SR(3)
            if (rwEasy !== 0) return rwEasy;
            return String(a.title).localeCompare(String(b.title), "ja");
          }
          // 取得済みは最近順
          return (b.lastAt ?? 0) - (a.lastAt ?? 0);
        }

        if (sortMode === "recent") return (b.lastAt ?? 0) - (a.lastAt ?? 0);
        if (sortMode === "name") return String(a.title).localeCompare(String(b.title), "ja");

        // デフォルト：レア順（SR→R→N）
        const rw = rarityWeight(b.rarity) - rarityWeight(a.rarity);
        if (rw !== 0) return rw;
        return (b.lastAt ?? 0) - (a.lastAt ?? 0);
      });

      // フィルタ（カテゴリ）
      const filteredByCategory =
        filterMode && filterMode !== "all"
          ? display.filter((it) => (it.category ?? "other") === filterMode)
          : display;

      // 検索は取得済みだけ（ネタバレ防止）
      const filtered = qn
        ? filteredByCategory.filter((it) => it.isOwned && normalizeJa(it.title).includes(qn))
        : filteredByCategory;

      // 取得済み／未取得に分割（未取得は折りたたむ）
      const ownedList = filtered.filter((x) => x.isOwned);
      const lockedList = filtered.filter((x) => !x.isOwned);

      const countsByCategory = display.reduce((acc, it) => {
        const k = it.category ?? "other";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});

      const renderRow = (item) => {
                const meta = item.meta;
                const owned = item.owned;
        
                if (owned) {
                  const rk = owned.rank ? `（${owned.rank}）` : "";
                  const rr = owned.rarity
                    ? `<span class="tb-rarity tb-r-${owned.rarity}">${owned.rarity}</span>`
                    : "";
                  const c = owned.count ?? 0;
                  return `
                    <div class="tb-row">
                      <div class="tb-title">${owned.title} <span class="tb-rank">${rk}</span> ${rr}</div>
                      <div class="tb-meta">取得 ${c}回</div>
                    </div>
                  `;
                }
        
                const hint = meta.hint
                  ? `<div class="tb-meta">ヒント：${meta.hint}</div>`
                  : `<div class="tb-meta">ヒント：？？？</div>`;
                const rr2 = meta.rarity ? `<span class="tb-rarity tb-r-${meta.rarity}">${meta.rarity}</span>` : "";
                return `
                  <div class="tb-row locked">
                    <div class="tb-title">？？？ ${rr2}</div>
                    ${hint}
                  </div>
                `;
              };
        
              const ownedRows =
                ownedList.length === 0
                  ? `<div class="tb-empty">まだ称号がありません。まずは1回クリアしてみよう。</div>`
                  : ownedList.map(renderRow).join("");
        
              const lockedRows =
                lockedList.length === 0
                  ? `<div class="tb-empty">未取得の称号はありません。</div>`
                  : lockedList.map(renderRow).join("");

      el.innerHTML = `
        <div class="card">
          <div class="tb-head">
            <div class="tb-head-title">
              称号ずかん <span class="tb-progress-text">${got}/${total}</span>
            </div>
            <div class="tb-head-actions">
              <button type="button" class="btn" data-action="back">ホームへ</button>
            </div>
          </div>

          <div class="tb-progress">
            <div class="tb-bar"><div class="tb-bar-fill" style="width:${pct}%"></div></div>
            <div class="tb-progress-sub">達成率 ${pct}%（のこり ${remain}）</div>
          </div>

          <div class="tb-filter">
            <button type="button" class="tb-filter-btn ${filterMode === "all" ? "active" : ""}" data-filter="all">ぜんぶ <span class="tb-count">${total}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "performance" ? "active" : ""}" data-filter="performance">プレイ <span class="tb-count">${countsByCategory.performance ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "master" ? "active" : ""}" data-filter="master">マスター <span class="tb-count">${countsByCategory.master ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "script" ? "active" : ""}" data-filter="script">もじ <span class="tb-count">${countsByCategory.script ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "grade" ? "active" : ""}" data-filter="grade">学年 <span class="tb-count">${countsByCategory.grade ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "milestone" ? "active" : ""}" data-filter="milestone">横断 <span class="tb-count">${countsByCategory.milestone ?? 0}</span></button>
          </div>

          <div class="tb-sort">
            <button type="button" class="tb-sort-btn ${sortMode === "recommend" ? "active" : ""}" data-sort="recommend">おすすめ</button>
            <button type="button" class="tb-sort-btn ${sortMode === "rarity" ? "active" : ""}" data-sort="rarity">レア順</button>
            <button type="button" class="tb-sort-btn ${sortMode === "recent" ? "active" : ""}" data-sort="recent">取得順</button>
            <button type="button" class="tb-sort-btn ${sortMode === "name" ? "active" : ""}" data-sort="name">名前順</button>
          </div>

          <div class="tb-search">
            <input
              class="tb-search-input"
              type="text"
              inputmode="search"
              placeholder="称号を検索（例：王）"
              value="${escapeAttr(searchQuery)}"
              aria-label="称号検索"
            />
            <button type="button" class="tb-search-clear" data-action="clearSearch" aria-label="検索をクリア">×</button>
          </div>

          <div class="tb-section">
            <div class="tb-section-title">もっている称号</div>
            <div class="tb-body">${ownedRows}</div>
          </div>

          <details class="tb-locked" ${got === 0 ? "" : ""}>
            <summary class="tb-locked-sum">
              まだの称号（${lockedList.length}）
              <span class="tb-locked-hint">（タップしてひらく）</span>
            </summary>
            <div class="tb-body tb-body-locked">${lockedRows}</div>
          </details>

          <div class="tb-foot">
            <button type="button" class="btn" data-action="back">ホームへ</button>
          </div>
          <details class="tb-admin">
            <summary class="tb-admin-sum">データ管理（こまったときだけ）</summary>
            <div class="tb-admin-body">
              <div class="tb-admin-note">※ リセットするとデータが消えます。</div>
              <div class="tb-admin-actions">
                <button type="button" class="btn danger small" data-action="resetProgress">進捗リセット</button>
                <button type="button" class="btn danger ghost small" data-action="resetAll">全部リセット</button>
              </div>
            </div>
          </details>
        </div>
      `;

      const rerender = () => nav.go("titleBook", { from: ctx.from ?? "home" });

      const onClick = (e) => {
        const btn = e.target?.closest?.("button");
        if (!btn) return;

        const action = btn.dataset.action;
        const sort = btn.dataset.sort;
        const filter = btn.dataset.filter;

        if (action === "back") {
          // ✅ もどるは常にホームへ
          nav.go("home", { selectedRangeId: ctx.selectedRangeId ?? null });
          return;
        }

        if (action === "clearSearch") {
          saveTitleBookSearch("");
          rerender();
          return;
        }

        if (action === "resetProgress") {
          if (!confirmReset("progress")) return;
          resetProgressOnly();
          rerender();
          return;
        }

        if (action === "resetAll") {
          if (!confirmReset("all")) return;
          resetAllLocalData();
          rerender();
          return;
        }

        if (sort === "rarity" || sort === "recent" || sort === "name" || sort === "recommend") {
          saveTitleBookSort(sort);
          rerender();
          return;
        }

        if (filter) {
                    saveTitleBookFilter(filter);
                    rerender();
                    return;
                  }
      };

      const onInput = (e) => {
        const input = e.target?.closest?.(".tb-search-input");
        if (!input) return;
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => {
          saveTitleBookSearch(input.value);
          rerender();
        }, 120);
      };

      el.addEventListener("click", onClick);
      el.addEventListener("input", onInput);

      return {
        el,
        cleanup() {
          clearTimeout(inputTimer);
          el.removeEventListener("click", onClick);
          el.removeEventListener("input", onInput);
        },
      };
    },
  };
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;");
}
