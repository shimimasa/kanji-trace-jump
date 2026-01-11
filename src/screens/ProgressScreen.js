import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { isCleared } from "../lib/progressStore.js";

function makeItemId(rangeId, itemId) {
  return `${rangeId}::${itemId}`;
}

export function ProgressScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen progress";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find(x => x.id === selected);

      el.innerHTML = `
        <div class="progressBoard">
          <div class="progressHead">
            <div>
              <div class="progressTitle">クリアしたもの</div>
              <div class="progressMeta">範囲：<b>${range?.label ?? "未選択"}</b></div>
            </div>
            <div class="progressHeadActions">
            <button id="reviewStart" class="btn" type="button">復習</button>
              <button id="titlebook" class="btn" type="button">称号ずかん</button>
              <button id="back" class="btn" type="button">もどる</button>
            </div>
          </div>

          <div class="progressBarWrap">
            <div class="progressBar">
              <div id="barFill" class="progressBarFill" style="width:0%"></div>
            </div>
            <div id="barText" class="progressBarText">達成率 -%</div>
          </div>

          <div id="reviewSummary" class="reviewSummaryCard"></div>

          <div class="progressTabs" role="tablist" aria-label="表示フィルタ">
            <button id="filterAll" class="tab active" type="button" data-filter="all" role="tab">全部</button>
            <button id="filterUncleared" class="tab" type="button" data-filter="uncleared" role="tab">未クリア</button>
            <button id="filterCleared" class="tab" type="button" data-filter="cleared" role="tab">クリア済み</button>
          </div>

          <div id="grid" class="tileGrid" aria-label="一覧"></div>
        </div>
      `;

      // 配列JSON対応
      const base = import.meta.env.BASE_URL ?? "/";
      const url = new URL(range.source, new URL(base, window.location.href)).toString();
      const res = await fetch(url);
      const items = await res.json(); // ← 配列

      const grid = el.querySelector("#grid");
      const barFill = el.querySelector("#barFill");
      const barText = el.querySelector("#barText");
      const reviewSummary = el.querySelector("#reviewSummary");
      // フィルタ状態（デフォルト：全部）
      let filter = "all"; // "all" | "uncleared" | "cleared"

      // label対応（kanji以外にも使える）
      const getLabel = (it) => {
        return (
          it?.label ??
          it?.kanji ??
          it?.kana ??
          it?.char ??
          it?.text ??
          it?.id ??
          "？"
        );
      };

      const computeRangeProgress = () => {
                let clearedCount = 0;
                for (const it of items) {
                  const key = makeItemId(range.id, it.id);
                  if (isCleared(ctx.progress, key)) clearedCount++;
                }
                const total = items.length || 0;
                const pct = total > 0 ? Math.round((clearedCount / total) * 100) : 0;
                return { clearedCount, total, pct };
              };

      const renderGrid = () => {
        const { clearedCount, total, pct } = computeRangeProgress();
        if (barFill) barFill.style.width = `${pct}%`;
        if (barText) barText.textContent = `達成率 ${pct}%（${clearedCount}/${total}）`;

        // ✅ 直近の復習（最新3件）表示
        if (reviewSummaryEl) {
            const list = Array.isArray(ctx.progress?.reviewSessions) ? ctx.progress.reviewSessions : [];
            const latest = list.slice(0, 3);
            if (!latest.length) {
              reviewSummaryEl.innerHTML = `
                <div class="reviewSummaryTitle">直近の復習</div>
                <div class="muted">まだ復習の記録がありません。</div>
              `;
           } else {
              const rows = latest.map((s, i) => {
                const d = new Date(s.at ?? Date.now());
                const dateText = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                return `
                  <div class="reviewRowLine">
                    <div class="reviewRowLeft">
                      <div class="reviewRowMain">${i + 1}. <b>${dateText}</b></div>
                      <div class="reviewRowSub muted">出題 ${s.total ?? "-"} / クリア ${s.clearedCount ?? "-"} / ミス ${s.totalFails ?? "-"}</div>
                    </div>
                    <div class="reviewRowTag">${(s.policy === "mist") ? "ミス多い" : (s.policy === "uncleared") ? "未クリア" : "バランス"}</div>
                  </div>
                `;
              }).join("");
              reviewSummaryEl.innerHTML = `
                <div class="reviewSummaryTitle">直近の復習</div>
                <div class="reviewSummaryList">${rows}</div>
              `;
            }
          }
        const html = items
          .filter((it) => {
            const key = makeItemId(range.id, it.id);
            const cleared = isCleared(ctx.progress, key);
            if (filter === "cleared") return cleared;
            if (filter === "uncleared") return !cleared;
            return true;
          })
          .map((it) => {
            const itemKey = makeItemId(range.id, it.id);
            const cleared = isCleared(ctx.progress, itemKey);
            const label = getLabel(it);
            return `
              <div class="tile ${cleared ? "cleared" : ""}" data-item="${it.id}">
                <button class="tileMain" type="button" data-action="practice" data-item="${it.id}">
                  <div class="tileChar">${label}</div>
                  <div class="tileBadge">${cleared ? "✓" : ""}</div>
                </button>
                <button class="tileBook" type="button" title="図鑑" aria-label="図鑑" data-action="dex" data-item="${it.id}">📘</button>
              </div>
            `;
          })
          .join("");

          grid.innerHTML = html || `<div class="emptyNote">表示する項目がありません。</div>`;
          
                  // タブの見た目（active）
                  const allBtn = el.querySelector("#filterAll");
                  const unBtn = el.querySelector("#filterUncleared");
                  const clBtn = el.querySelector("#filterCleared");
                  [allBtn, unBtn, clBtn].forEach((b) => b && b.classList.remove("active"));
                  if (filter === "all") allBtn?.classList.add("active");
                  if (filter === "uncleared") unBtn?.classList.add("active");
                  if (filter === "cleared") clBtn?.classList.add("active");
      };

      // 初回描画
      renderGrid();

      const onFilter = (e) => {
        const btn = e.target.closest("button[data-filter]");
        if (!btn) return;
        filter = btn.dataset.filter || "all";
        renderGrid();
      };

      const onClick = (e) => {
                // フィルタタブ
                const tab = e.target.closest("button[data-filter]");
                if (tab) {
                  filter = tab.dataset.filter || "all";
                  renderGrid();
                  return;
                }
                // タイルアクション
                const actionBtn = e.target.closest("button[data-action][data-item]");
                if (actionBtn) {
                  const id = actionBtn.dataset.item;
                  const action = actionBtn.dataset.action;
                  if (action === "practice") {
                    // ✅ タイルタップは“図鑑を開く”に変更（練習は図鑑から）
                    nav.go("dex", { selectedRangeId: selected, focusId: id, from: "progress" });
                    return;
                  }
                  if (action === "dex") {
                    nav.go("dex", { selectedRangeId: selected, focusId: id, from: "progress" });
                    return;
                  }
                }
                // 上部ボタン
                const backBtn = e.target.closest("#back");
                if (backBtn) { nav.go("home"); return; }
                const tbBtn = e.target.closest("#titlebook");
                if (tbBtn) { nav.go("titleBook", { from: "progress" }); return; }
                const dexBtn = e.target.closest("#dex");
                if (dexBtn) { nav.go("dex", { selectedRangeId: selected, from: "progress" }); return; }
                const reviewBtn = e.target.closest("#reviewStart");
                        if (reviewBtn) { nav.go("reviewStart", { selectedRangeId: selected, from: "progress" }); return; }
                       };
              
        
              el.addEventListener("click", onClick);
      return {
        el,
        cleanup() {
            el.removeEventListener("click", onClick);
        }
      };
    }
  };
}
