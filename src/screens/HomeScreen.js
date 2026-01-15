// src/screens/HomeScreen.js
import { CONTENT_MANIFEST } from "../data/contentManifest.js";

export function HomeScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen home";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find((x) => x.id === selected);

      // ✅ HomeのDOMはここで確実に生成（IDはこの3つを固定）
      el.innerHTML = `
        <div class="card">
          <h1>ねこなぞり</h1>

        <div class="muted" style="margin-top:6px; text-align:center;">
          ひらがな・カタカナ・アルファベット・漢字を、ねこでなぞってあそぼう！
        </div>

          <div style="margin:8px 0;">
            いまの範囲：<b>${range?.label ?? "未選択"}</b>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
            <button id="start" class="btn primary" type="button">スタート</button>
            <button id="range" class="btn" type="button">範囲をえらぶ</button>
            <button id="progress" class="btn" type="button">クリアしたもの</button>
          </div>
        </div>
      `;

      // ✅ querySelectorして個別にaddEventListenerしない（null事故を根絶）
      const onClick = (e) => {
        const btn = e.target?.closest?.("button");
        if (!btn) return;

        if (btn.id === "start") {
          nav.go("game", { selectedRangeId: selected });
          return;
        }
        if (btn.id === "range") {
          nav.go("rangeSelect");
          return;
        }
        if (btn.id === "progress") {
          nav.go("progress");
          return;
        }
      };

      el.addEventListener("click", onClick);

      return {
        el,
        cleanup() {
          el.removeEventListener("click", onClick);
        },
      };
    },
  };
}
