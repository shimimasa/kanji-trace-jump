// src/screens/TitleBookScreen.js
import { TITLE_CATALOG, loadTitleBook } from "../lib/titleBookStore.js";

const TITLE_BOOK_SORT_LS_KEY = "ktj_title_book_sort_v1";
const TITLE_BOOK_SEARCH_LS_KEY = "ktj_title_book_search_v1";

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

      const sortMode = loadTitleBookSort(); // "rarity" | "recent" | "name"
      const searchQuery = loadTitleBookSearch();
      const qn = normalizeJa(searchQuery);

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
        };
      });

      display.sort((a, b) => {
        if (a.isOwned !== b.isOwned) return a.isOwned ? -1 : 1;

        if (sortMode === "recent") return (b.lastAt ?? 0) - (a.lastAt ?? 0);
        if (sortMode === "name") return String(a.title).localeCompare(String(b.title), "ja");

        const rw = rarityWeight(b.rarity) - rarityWeight(a.rarity);
        if (rw !== 0) return rw;
        return (b.lastAt ?? 0) - (a.lastAt ?? 0);
      });

      // 検索は取得済みだけ（ネタバレ防止）
      const filtered = qn
        ? display.filter((it) => it.isOwned && normalizeJa(it.title).includes(qn))
        : display;

      const rows =
        total === 0
          ? `<div class="tb-empty">称号カタログが空です。</div>`
          : filtered
              .map((item) => {
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
                const rr2 = meta.rarity
                  ? `<span class="tb-rarity tb-r-${meta.rarity}">${meta.rarity}</span>`
                  : "";
                return `
                  <div class="tb-row locked">
                    <div class="tb-title">？？？ ${rr2}</div>
                    ${hint}
                  </div>
                `;
              })
              .join("");

      el.innerHTML = `
        <div class="card">
          <div class="tb-head">
            <div class="tb-head-title">
              称号ずかん <span class="tb-progress-text">${got}/${total}</span>
            </div>
            <div class="tb-head-actions">
              <button type="button" class="btn danger" data-action="resetProgress">進捗リセット</button>
              <button type="button" class="btn danger ghost" data-action="resetAll">全部リセット</button>
              <button type="button" class="btn" data-action="back">ホームへ</button>
            </div>
          </div>

          <div class="tb-progress">
            <div class="tb-bar"><div class="tb-bar-fill" style="width:${pct}%"></div></div>
            <div class="tb-progress-sub">達成率 ${pct}%（のこり ${remain}）</div>
          </div>

          <div class="tb-sort">
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

          <div class="tb-body">${rows}</div>

          <div class="tb-foot">
            <button type="button" class="btn" data-action="back">ホームへ</button>
            <button type="button" class="btn danger" data-action="resetProgress">進捗リセット</button>
          </div>
        </div>
      `;

      const rerender = () => nav.go("titleBook", { from: ctx.from ?? "home" });

      const onClick = (e) => {
        const btn = e.target?.closest?.("button");
        if (!btn) return;

        const action = btn.dataset.action;
        const sort = btn.dataset.sort;

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

        if (sort === "rarity" || sort === "recent" || sort === "name") {
          saveTitleBookSort(sort);
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
