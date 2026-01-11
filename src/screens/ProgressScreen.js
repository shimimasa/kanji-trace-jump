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
        <div class="card">
          <h1>クリアしたもの</h1>
          <div>範囲：<b>${range?.label ?? "未選択"}</b></div>
          <div>総クリア数：<b>${ctx.progress?.stats?.totalCleared ?? 0}</b></div>

          <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <span style="opacity:.75;">表示：</span>
            <button id="filterAll" class="btn" type="button" data-filter="all">全部</button>
            <button id="filterUncleared" class="btn" type="button" data-filter="uncleared">未クリア</button>
            <button id="filterCleared" class="btn" type="button" data-filter="cleared">クリア済み</button>
          </div>

          <div id="grid" class="grid" style="margin-top:12px;"></div>
          <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button id="back" class="btn">もどる</button>
            <button id="titlebook" class="btn">称号ずかん</button>
          </div>
        </div>
      `;

      // 配列JSON対応
      const base = import.meta.env.BASE_URL ?? "/";
      const url = new URL(range.source, new URL(base, window.location.href)).toString();
      const res = await fetch(url);
      const items = await res.json(); // ← 配列

      const grid = el.querySelector("#grid");
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

      const renderGrid = () => {
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
              <button class="chip ${cleared ? "cleared" : ""}" data-item="${it.id}">
                ${label}
              </button>
            `;
          })
          .join("");

        grid.innerHTML = html || `<div style="opacity:.7; padding:8px 0;">表示する項目がありません。</div>`;

        // ボタンの見た目（active）
        const allBtn = el.querySelector("#filterAll");
        const unBtn = el.querySelector("#filterUncleared");
        const clBtn = el.querySelector("#filterCleared");
        [allBtn, unBtn, clBtn].forEach((b) => b && b.classList.remove("primary"));
        if (filter === "all") allBtn?.classList.add("primary");
        if (filter === "uncleared") unBtn?.classList.add("primary");
        if (filter === "cleared") clBtn?.classList.add("primary");
      };

      // 初回描画
      renderGrid();

      const onChip = (e) => {
        const btn = e.target.closest("button[data-item]");
        if (!btn) return;
        // その漢字から開始（後でGameScreen側で対応）
        nav.go("game", { selectedRangeId: selected, startFromId: btn.dataset.item });
      };

      const onFilter = (e) => {
        const btn = e.target.closest("button[data-filter]");
        if (!btn) return;
        filter = btn.dataset.filter || "all";
        renderGrid();
      };

      const onBack = () => nav.go("home");
      const onTB = () => nav.go("titleBook", { from: "progress" });

      grid.addEventListener("click", onChip);
      el.addEventListener("click", onFilter);
      el.querySelector("#back").addEventListener("click", onBack);
      el.querySelector("#titlebook").addEventListener("click", onTB);
      return {
        el,
        cleanup() {
          grid.removeEventListener("click", onChip);
          el.removeEventListener("click", onFilter);
          el.querySelector("#back").removeEventListener("click", onBack);
          el.querySelector("#titlebook").removeEventListener("click", onTB);
        }
      };
    }
  };
}
