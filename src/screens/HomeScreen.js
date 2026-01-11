import { CONTENT_MANIFEST } from "../data/contentManifest.js";

export function HomeScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen home";
      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find(x => x.id === selected);

      el.innerHTML = `
        <div class="card">
          <h1>KANJI TRACE JUMP</h1>
          <div>いまの範囲：<b>${range?.label ?? "未選択"}</b></div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
            <button id="start" class="btn primary">スタート</button>
            <button id="range" class="btn">範囲をえらぶ</button>
            <button id="progress" class="btn">クリアしたもの</button>
          </div>
        </div>
      `;

      const onStart = () => nav.go("game", { selectedRangeId: selected });
      const onRange = () => nav.go("rangeSelect");
      const onProg = () => nav.go("progress");

      el.querySelector("#start").addEventListener("click", onStart);
      el.querySelector("#range").addEventListener("click", onRange);
      el.querySelector("#progress").addEventListener("click", onProg);

      return {
        el,
        cleanup() {
          el.querySelector("#start").removeEventListener("click", onStart);
          el.querySelector("#range").removeEventListener("click", onRange);
          el.querySelector("#progress").removeEventListener("click", onProg);
        }
      };
    }
  };
}
