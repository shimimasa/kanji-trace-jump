// src/screens/TitleBookScreen.js
import { TITLE_CATALOG, loadTitleBook } from "../lib/titleBookStore.js";
import { loadRangeItems, getRangeType } from "../lib/rangeItems.js";
import { makeProgressKey } from "../lib/progressKey.js";

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

function rarityLabel(r) {
    if (r === "SR") return "でんせつ";
    if (r === "R") return "すごい";
    if (r === "N") return "ふつう";
    return "";
  }
  
  function labelFromSelectedRangeId(id) {
    const s = String(id ?? "");
    // 例: kanji_g1 ... kanji_g10（あなたの規約）
    const m = s.match(/kanji_g(\d+)/);
    if (!m) return s || "未選択";
    const n = Number(m[1]);
    if (n >= 1 && n <= 6) return `いま：小${n}`;
    if (n >= 7 && n <= 9) return `いま：中${n - 6}`;
    if (n === 10) return "いま：高1";
    return s || "未選択";
  }

  function ceilHalf(n) {
      const x = Math.max(0, Number(n) || 0);
      return Math.ceil(x / 2);
    }
    
    function rangeShortFromSelectedId(selectedRangeId, type) {
      const id = String(selectedRangeId ?? "");
      if (type === "kanji") {
        const m = id.match(/kanji_g(\d+)/);
        if (!m) return null;
    const n = Number(m[1]);
    // ✅ TitleBook 側の rangeId は g/j/h 表記（catalogに合わせる）
    // - g1..g6 : 小1..小6
    // - g7..g9 : 中1..中3 => j1..j3
    // - g10    : 高1      => h1
    if (n >= 1 && n <= 6) return `g${n}`;
    if (n >= 7 && n <= 9) return `j${n - 6}`;
    if (n === 10) return "h1";
    return null;
      }
      if (type === "hiragana") return "hira";
      if (type === "katakana") return "kata";
      if (type === "alphabet") return "abc";
      return null;
    }
    
    function goalTargetFromTitle(title, total) {
      const t = String(title ?? "");
      if (!t) return null;
      // 学年
      if (t.endsWith("のはじまり")) return { kind: "first", target: 1, unit: "回" };
      if (t.endsWith("の半分")) return { kind: "half", target: ceilHalf(total), unit: "こ" };
      if (t.endsWith("コンプリート")) return { kind: "complete", target: total, unit: "こ" };
      // かな/英字
      if (t.endsWith("デビュー")) return { kind: "first", target: 1, unit: "回" };
      if (t.endsWith("名人")) return { kind: "half", target: ceilHalf(total), unit: "こ" };
      if (t.endsWith("皆伝")) return { kind: "complete", target: total, unit: "こ" };
      if (t === "ABCマスター") return { kind: "half", target: ceilHalf(total), unit: "こ" };
      return null;
    }

    function labelFromKanjiSelectedRangeId(selectedRangeId) {
        const s = String(selectedRangeId ?? "");
        const m = s.match(/kanji_g(\d+)/);
        if (!m) return null;
        const n = Number(m[1]);
        if (n >= 1 && n <= 6) return `小${n}`;
        if (n >= 7 && n <= 9) return `中${n - 6}`;
        if (n === 10) return "高1";
        return null;
      }
      
      function milestoneTitlesForCurrentRange(selectedRangeId, type) {
        if (type === "kanji") {
          const label = labelFromKanjiSelectedRangeId(selectedRangeId);
          if (!label) return [];
          return [`${label}のはじまり`, `${label}の半分`, `${label}コンプリート`];
        }
        if (type === "hiragana") return ["ひらがなデビュー", "ひらがな名人", "ひらがな皆伝"];
        if (type === "katakana") return ["カタカナデビュー", "カタカナ名人", "カタカナ皆伝"];
        if (type === "alphabet") return ["ABCデビュー", "ABCマスター", "ABC皆伝"];
        return [];
      }
      
      function pickEasiestUnowned(list, limit = 1) {
        return [...list]
          .sort((a, b) => {
            const aw = rarityWeight(a.rarity);
            const bw = rarityWeight(b.rarity);
            if (aw !== bw) return aw - bw; // N→R→SR
            return String(a.title).localeCompare(String(b.title), "ja");
          })
          .slice(0, limit);
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

      // ✅ 現在範囲の「母数」と「クリア数」を取得（rangeItemsに寄せて母数ズレを防止）
      const selectedRangeId = ctx?.selectedRangeId ?? "kanji_g1";
      let rangeInfo = { type: getRangeType(selectedRangeId), total: 0, cleared: 0 };
      try {
        const { type, items } = await loadRangeItems(selectedRangeId);
        const total = Array.isArray(items) ? items.length : 0;
        let cleared = 0;
        for (const it of items || []) {
          const id = it?.id;
          if (!id) continue;
          const key = makeProgressKey(type, id);
          if (ctx?.progress?.cleared?.[key]) cleared++;
        }
        rangeInfo = { type, total, cleared };
      } catch {
        // 取得できない場合は表示だけ続行（カードはヒント表示のみになる）
      }

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


     // ✅ つぎの目標（v2 Step3）
      // 1) いまの範囲のマイルストーン（未取得）を最優先
      // 2) 次にプレイ系（performance）の“取りやすい未取得”を1つ
      // 3) 残りは「現在のフィルタカテゴリ」を尊重しつつ、取りやすい未取得で埋める
      const nextGoals = [];
      const pushUnique = (it) => {
        if (!it) return;
        if (nextGoals.some((x) => x.title === it.title)) return;
        nextGoals.push(it);
      };

      const allDisplay = display; // フィルタ前の全体
      const allLocked = allDisplay.filter((x) => !x.isOwned);

      // 1) 現在範囲のマイルストーン
      const milestoneTitles = milestoneTitlesForCurrentRange(selectedRangeId, rangeInfo.type);
      for (const t of milestoneTitles) {
        const it = allLocked.find((x) => x.title === t);
        pushUnique(it);
        if (nextGoals.length >= 3) break;
      }

      // 2) プレイ系から1つ（未取得）
      if (nextGoals.length < 3) {
        const perfLocked = allLocked.filter((x) => (x.category ?? "other") === "performance");
        const [pick] = pickEasiestUnowned(perfLocked, 1);
        pushUnique(pick);
      }

      // 3) 残り：フィルタに寄せる（ただしフィルタがallなら全体）
      if (nextGoals.length < 3) {
        const pool =
          filterMode && filterMode !== "all"
            ? allLocked.filter((x) => (x.category ?? "other") === filterMode)
            : allLocked;
        for (const it of pickEasiestUnowned(pool, 6)) {
          pushUnique(it);
          if (nextGoals.length >= 3) break;
        }
      }

        const rangeShort = rangeShortFromSelectedId(selectedRangeId, rangeInfo.type);


      const nextGoalsHtml =
        nextGoals.length === 0
          ? `<div class="tb-empty">このカテゴリの称号は、ぜんぶ手に入れたよ。</div>`
          : nextGoals
              .map((it) => {
                const meta = it.meta || {};
                const rr = meta.rarity ? `<span class="tb-rarity tb-r-${meta.rarity}">${meta.rarity}</span>` : "";
                const rrL = rarityLabel(meta.rarity);
                const hint = meta.hint ? meta.hint : "ヒント：？？？";

                // ✅ 「いまの範囲」に関係するマイルストーンだけ、残り表示を出す
                // - grade: rangeId が g1..g10
                // - script: rangeId が hira/kata/abc
                const canShowRemain =
                  !!rangeShort &&
                  (meta.category === "grade" || meta.category === "script") &&
                  String(meta.rangeId ?? "") === String(rangeShort) &&
                  Number.isFinite(rangeInfo.total) &&
                  rangeInfo.total > 0;

                let remainText = "";
                let barHtml = "";
                if (canShowRemain) {
                  const goal = goalTargetFromTitle(meta.title, rangeInfo.total);
                  if (goal) {
                    const need = Math.max(0, goal.target - (rangeInfo.cleared ?? 0));
                    if (goal.kind === "first") {
                      remainText = need <= 0 ? "もう達成！" : "あと1回クリア";
                    } else {
                      remainText = need <= 0 ? "もう達成！" : `あと ${need}${goal.unit}`;
                    }
                    // ✅ 進行度バー（Step5）
                    const cur = Math.min(goal.target, Math.max(0, rangeInfo.cleared ?? 0));
                    const pct = goal.target > 0 ? Math.round((cur / goal.target) * 100) : 0;
                    barHtml = `
                      <div class="tb-goal-bar">
                        <div class="tb-goal-bar-fill" style="width:${pct}%"></div>
                      </div>
                      <div class="tb-goal-bar-text">${cur}/${goal.target}</div>
                    `;
                  }
                }
                return `
                  <button
                    type="button"
                    class="tb-goal-card"
                    data-goal-title="${escapeAttr(meta.title)}"
                    data-goal-category="${escapeAttr(meta.category ?? "")}"
                  >
                    <div class="tb-goal-top">
                      <div class="tb-goal-title">？？？ ${rr}</div>
                      ${rrL ? `<div class="tb-goal-rlabel">${rrL}</div>` : ``}
                    </div>
                    <div class="tb-goal-hint">ヒント：${escapeAttr(hint)}</div>
                    ${remainText ? `<div class="tb-goal-remain">${escapeAttr(remainText)}</div>` : ``}
                    ${barHtml ? `<div class="tb-goal-progress">${barHtml}</div>` : ``}</div>
                  </button>
                `;
              })
              .join("");


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

          <div class="tb-now">
            <div class="tb-now-chip">${escapeAttr(labelFromSelectedRangeId(selectedRangeId))}</div>
            <div class="tb-now-sub">
              ${rangeInfo.total > 0 ? `この範囲：${rangeInfo.cleared}/${rangeInfo.total} クリア` : "「つぎの目標」を3つ出すよ。"}
            </div>
          </div>

          <div class="tb-goals">
            <div class="tb-section-title">つぎの目標</div>
            <div class="tb-goal-grid">${nextGoalsHtml}</div>
          </div>

          <div class="tb-filter">
            <button type="button" class="tb-filter-btn ${filterMode === "all" ? "active" : ""}" data-filter="all">ぜんぶ <span class="tb-count">${total}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "performance" ? "active" : ""}" data-filter="performance">あそび <span class="tb-count">${countsByCategory.performance ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "master" ? "active" : ""}" data-filter="master">たつじん <span class="tb-count">${countsByCategory.master ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "script" ? "active" : ""}" data-filter="script">もじ <span class="tb-count">${countsByCategory.script ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "grade" ? "active" : ""}" data-filter="grade">学年 <span class="tb-count">${countsByCategory.grade ?? 0}</span></button>
            <button type="button" class="tb-filter-btn ${filterMode === "milestone" ? "active" : ""}" data-filter="milestone">とくべつ <span class="tb-count">${countsByCategory.milestone ?? 0}</span></button>
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
              まだの称号（あと${lockedList.length}こ）
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
        const goalTitle = btn.dataset.goalTitle;
        const goalCategory = btn.dataset.goalCategory;
 

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

                  // =========================
        // v2 Step4: 目標カードの導線（✅ onClick の中で処理する）
        // =========================
        if (goalTitle) {
          // 1) 学年・文字マイルストーン → 学習へ（そのままホームへ戻して開始）
          if (goalCategory === "grade" || goalCategory === "script") {
            nav.go("home", { selectedRangeId: selectedRangeId ?? ctx.selectedRangeId ?? null });
            return;
          }

          // 2) プレイ系 → 図鑑内フィルタ
          if (goalCategory === "performance") {
            saveTitleBookFilter("performance");
            saveTitleBookSort("recommend");
            rerender();
            return;
          }

          // 3) その他 → おすすめ順
          saveTitleBookSort("recommend");
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
