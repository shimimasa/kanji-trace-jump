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
          <div class="hud-right">
            <div id="mode" class="mode">もくひょう：5もじ</div>
            <button id="teacherToggle" class="teacherToggle" type="button" aria-pressed="false">先生</button>
            <button id="homeBtn" class="iconBtn" type="button" aria-label="ホームへ">🏠</button>
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
                // 誤タップ防止：プレイ中だけ確認
                const ok = window.confirm("ホームにもどりますか？\n（プレイ中の進み具合は保存されません）");
                if (!ok) return;
                nav.go("home");
              };
      quit.addEventListener("click", onQuit);


      const homeBtn = el.querySelector("#homeBtn");
      const onHome = () => {
        const ok = window.confirm("ホームにもどりますか？\n（プレイ中の進み具合は保存されません）");
        if (!ok) return;
        nav.go("home");
      };
      homeBtn?.addEventListener("click", onHome);
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
          homeBtn?.removeEventListener("click", onHome);
          game?.stop?.();
          game = null;
        }
      };
    }
  };
}
