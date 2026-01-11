import { groupByType, CONTENT_MANIFEST } from "../data/contentManifest.js";

export function HomeScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen home";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const selectedRange = CONTENT_MANIFEST.find(x => x.id === selected);

      el.innerHTML = `
        <h1>Kanji Trace Jump</h1>

        <div class="card">
          <div>いまの範囲：<b>${selectedRange?.label ?? "未選択"}</b></div>
          <button id="start">スタート</button>
          <button id="range">範囲をえらぶ</button>
          <button id="progress">クリアしたもの</button>
        </div>

        <div class="card">
          <h2>追加予定（例）</h2>
          <div class="muted">漢字（小1〜中3）・ひらがな・カタカナ・ローマ字・アルファベット</div>
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
    },
  };
}
