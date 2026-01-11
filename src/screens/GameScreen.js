// src/screens/GameScreen.js
import { startTraceGame } from "../game/startTraceGame.js";

export function GameScreen(ctx, nav) {
  let game = null;

  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen game";

      // ✅ single練習（図鑑から来た）判定
      const isSinglePractice = !!ctx.singleId && ctx.returnTo === "dex";

      // 旧 index.html のDOMをここで生成（あなたの既存CSSを活かす）
      el.innerHTML = `
        <div class="hud">
          <div id="stars" class="stars" aria-label="進捗"></div>
          <div class="hud-right">
            <div id="mode" class="mode">もくひょう：5もじ</div>
            <button id="teacherToggle" class="teacherToggle" type="button" aria-pressed="false">先生</button>
            ${
                              isSinglePractice
                                ? `<button id="dexBackBtn" class="iconBtn" type="button" aria-label="図鑑へもどる">📘</button>`
                                : `<button id="homeBtn" class="iconBtn" type="button" aria-label="ホームへ">🏠</button>`
                            }
          </div>
        </div>

        <div class="main">
          <div class="topline">
            <div id="kanjiLabel" class="title"></div>
          </div>

          <div class="stage">
            <div id="kanjiArea" class="kanji-area" aria-label="漢字トレースエリア"></div>
          </div>

          <div class="stroke-ui">
            <div id="strokeButtons" class="stroke-buttons" aria-label="書き順"></div>
          </div>

          <div class="nav">
            <button id="prevBtn" class="btn" type="button">まえ</button>
            <button id="nextBtn" class="btn primary" type="button">つぎ</button>
            <button id="quitBtn" class="btn" type="button">やめる</button>
          </div>

          <p id="hint" class="caption">なぞって、書き順どおりに進めよう。</p>
          <div id="error" class="error" role="status" aria-live="polite"></div>
        </div>
      `;

      const quit = el.querySelector("#quitBtn");
      if (!quit) {
        // ここで落とすと「何が足りないか」が分かる
        console.error("[GameScreen] DOM missing. expected #quitBtn. current HTML:", el.innerHTML);
        throw new Error("[GameScreen] #quitBtn が見つかりません（DOM生成/ID不一致の可能性）");
      }
      const onQuit = () => {
                // 誤タップ防止：single練習なら図鑑へ、通常ならホームへ
                const ok = window.confirm(
                  isSinglePractice
                    ? "図鑑にもどりますか？\n（プレイ中の進み具合は保存されません）"
                    : "ホームにもどりますか？\n（プレイ中の進み具合は保存されません）"
                );
                if (!ok) return;
                if (isSinglePractice) {
                  nav.go("dex", {
                    selectedRangeId: ctx.selectedRangeId,
                    focusId: ctx.singleId,
                    from: ctx.returnFrom ?? "progress",
                  });
                } else {
                  nav.go("home");
                }
              };
      quit.addEventListener("click", onQuit);

      const homeBtn = el.querySelector("#homeBtn");
            const dexBackBtn = el.querySelector("#dexBackBtn");
      
            const onHome = () => {
              const ok = window.confirm("ホームにもどりますか？\n（プレイ中の進み具合は保存されません）");
              if (!ok) return;
              nav.go("home");
            };
            const onDexBack = () => {
              const ok = window.confirm("図鑑にもどりますか？\n（プレイ中の進み具合は保存されません）");
              if (!ok) return;
              nav.go("dex", {
                selectedRangeId: ctx.selectedRangeId,
                focusId: ctx.singleId,
                from: ctx.returnFrom ?? "progress",
              });
            };
      
            homeBtn?.addEventListener("click", onHome);
            dexBackBtn?.addEventListener("click", onDexBack);
      


      game = startTraceGame({
        rootEl: el,
        ctx,
        selectedRangeId: ctx.selectedRangeId,
        startFromId: ctx.startFromId,
        startFromIdx: ctx.startFromIdx,
        singleId: ctx.singleId,
                onSetFinished: ({ result, nextStart, history, mode, singleId }) => {
                  // ✅ single練習なら図鑑に戻す
                  if (mode === "single") {
                    nav.go("dex", {
                      selectedRangeId: ctx.selectedRangeId,
                      focusId: singleId ?? ctx.singleId,
                      from: ctx.returnFrom ?? "progress",
                    });
                    return;
                  }
                  // 通常はResult画面へ
                  nav.go("result", { lastResult: result, nextStart, history });
            },
      });

      await game.ready;

      // ✅ modeTextを反映（フェード）
      const modeEl = el.querySelector("#mode");
      if (modeEl && game?.modeText) {
        modeEl.classList.remove("modeFade");
        // reflowでアニメ再発火
        void modeEl.offsetWidth;
        modeEl.textContent = game.modeText;
        modeEl.classList.add("modeFade");
      }


      return {
        el,
        cleanup() {
          quit.removeEventListener("click", onQuit);
          homeBtn?.removeEventListener("click", onHome);
          dexBackBtn?.removeEventListener("click", onDexBack);
          game?.stop?.();
          game = null;
        }
      };
    }
  };
}
