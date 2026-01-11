// src/screens/KanjiDexScreen.js
import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { isCleared } from "../lib/progressStore.js";

function makeItemId(rangeId, itemId) {
  return `${rangeId}::${itemId}`;
}

export function KanjiDexScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen dex";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find(x => x.id === selected);

      const base = import.meta.env.BASE_URL ?? "/";
      const url = new URL(range.source, new URL(base, window.location.href)).toString();
      const res = await fetch(url);
      const items = await res.json();

      const getLabel = (it) =>
        it?.label ?? it?.kanji ?? it?.kana ?? it?.char ?? it?.text ?? it?.id ?? "？";

      let index = 0;
      if (ctx.focusId) {
        const found = items.findIndex((x) => x?.id === ctx.focusId);
        if (found >= 0) index = found;
      }

      const render = () => {
        const it = items[index];
        const label = getLabel(it);
        const cleared = isCleared(ctx.progress, makeItemId(range.id, it.id));

        el.innerHTML = `
          <div class="dexBoard">
            <div class="dexHead">
              <div>
                <div class="dexTitle">図鑑</div>
                <div class="dexMeta">範囲：<b>${range?.label ?? "未選択"}</b></div>
              </div>
              <div class="dexHeadActions">
                <button id="back" class="btn" type="button">もどる</button>
              </div>
            </div>

            <div class="dexCard">
              <div class="dexChar">${label}</div>
              <div class="dexStatus">${cleared ? "✓ クリア済み" : "未クリア"}</div>

              <div class="dexActions">
                <button id="practice" class="btn primary big" type="button">この文字を練習する</button>
              </div>

              <div class="dexNav">
                <button id="prev" class="btn" type="button">まえ</button>
                <div class="dexIndex">${index + 1} / ${items.length}</div>
                <button id="next" class="btn" type="button">つぎ</button>
              </div>
            </div>
          </div>
        `;
      };

      const goBack = () => {
        // どこから来ても、指定があればそこへ
        if (ctx.from === "progress") nav.go("progress");
        else nav.go("home");
      };

      const onClick = (e) => {
        const t = e.target;
        if (t.closest("#back")) { goBack(); return; }
        if (t.closest("#practice")) {
          const it = items[index];
          nav.go("game", { selectedRangeId: selected, startFromId: it.id });
          return;
        }
        if (t.closest("#prev")) { index = Math.max(0, index - 1); render(); return; }
        if (t.closest("#next")) { index = Math.min(items.length - 1, index + 1); render(); return; }
      };

      render();
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
