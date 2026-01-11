import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { isCleared } from "../lib/progressStore.js";

export function ProgressScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen progress";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find(x => x.id === selected);

      el.innerHTML = `
        <h1>クリアしたもの</h1>
        <div class="card">
          <div>範囲：<b>${range?.label ?? "未選択"}</b></div>
          <div>総クリア数：<b>${ctx.progress?.stats?.totalCleared ?? 0}</b></div>
        </div>
        <div id="grid" class="grid"></div>
        <button id="back">もどる</button>
      `;

      // ここは「範囲のデータ(JSON)を読んで一覧化」する
      // 今のkanji_g1_proto.jsonが items を持っている前提で、最低限の実装例：
      const base = import.meta.env.BASE_URL ?? "/";
      const url = new URL(range.source, new URL(base, window.location.href)).toString();
      const res = await fetch(url);
      const data = await res.json();

      // data.items の形はあなたのJSONに合わせて調整してください
      const items = data.items ?? data.kanjiList ?? [];
      const grid = el.querySelector("#grid");

      grid.innerHTML = items.map((it) => {
        const itemId = makeItemId(range.id, it.id ?? it.kanji ?? it.label ?? "");
        const cleared = isCleared(ctx.progress, itemId);
        const label = it.kanji ?? it.label ?? it.id ?? "？";
        return `<button class="chip ${cleared ? "cleared" : ""}" data-id="${itemId}">${label}</button>`;
      }).join("");

      const onChip = (e) => {
        const btn = e.target.closest("button[data-id]");
        if (!btn) return;
        // 押したらその文字から練習に入る、みたいな導線も可能
        nav.go("game", { selectedRangeId: selected, startFromItemId: btn.dataset.id });
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

function makeItemId(rangeId, raw) {
  return `${rangeId}::${String(raw)}`;
}
