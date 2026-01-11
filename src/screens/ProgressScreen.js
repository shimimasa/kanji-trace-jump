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
          <div id="grid" class="grid" style="margin-top:12px;"></div>
          <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button id="back" class="btn">もどる</button>
          </div>
        </div>
      `;

      // 配列JSON対応
      const base = import.meta.env.BASE_URL ?? "/";
      const url = new URL(range.source, new URL(base, window.location.href)).toString();
      const res = await fetch(url);
      const items = await res.json(); // ← 配列

      const grid = el.querySelector("#grid");
      grid.innerHTML = items.map((it) => {
        const itemKey = makeItemId(range.id, it.id);
        const cleared = isCleared(ctx.progress, itemKey);
        return `
          <button class="chip ${cleared ? "cleared" : ""}" data-item="${it.id}">
            ${it.kanji}
          </button>
        `;
      }).join("");

      const onChip = (e) => {
        const btn = e.target.closest("button[data-item]");
        if (!btn) return;
        // その漢字から開始（後でGameScreen側で対応）
        nav.go("game", { selectedRangeId: selected, startFromId: btn.dataset.item });
      };
      const onBack = () => nav.go("home");

      grid.addEventListener("click", onChip);
      el.querySelector("#back").addEventListener("click", onBack);

      return {
        el,
        cleanup() {
          grid.removeEventListener("click", onChip);
          el.querySelector("#back").removeEventListener("click", onBack);
        }
      };
    }
  };
}
