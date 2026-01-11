// src/screens/GameScreen.js
import { startTraceGame } from "../game/startTraceGame.js";

export function GameScreen(ctx, nav) {
  let game = null;

  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen game";

      // 旧 index.html のDOMをここで生成（あなたの既存CSSを活かす）
      el.innerHTML = `
        <div class="hud">
          <div id="stars" class="stars" aria-label="進捗"></div>
          <div id="mode" class="mode">もくひょう：5もじ</div>
          <button id="teacherToggle" class="teacherToggle" type="button" aria-pressed="false">先生</button>
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
      const onQuit = () => nav.go("home");
      quit.addEventListener("click", onQuit);

      game = startTraceGame({
        rootEl: el,
        ctx,
        selectedRangeId: ctx.selectedRangeId,
        startFromId: ctx.startFromId,
        startFromIdx: ctx.startFromIdx,
        onSetFinished: ({ result, nextStart, history }) => {
          // Result画面へ
          nav.go("result", { lastResult: result, nextStart, history });
        },
      });

      await game.ready;

      return {
        el,
        cleanup() {
          quit.removeEventListener("click", onQuit);
          game?.stop?.();
          game = null;
        }
      };
    }
  };
}
