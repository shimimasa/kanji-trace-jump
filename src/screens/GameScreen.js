export function GameScreen(ctx, nav) {
    return {
      async mount() {
        const el = document.createElement("div");
        el.className = "screen game";
  
        // 既存UIを流用するなら、今のindex.html構造をここへ移す or 部分的に作る
        el.innerHTML = `
          <div id="gameRoot">
            <canvas id="traceCanvas"></canvas>
            <div id="hud"></div>
            <button id="quit">やめる</button>
          </div>
        `;
  
        const quitBtn = el.querySelector("#quit");
        const onQuit = () => nav.go("home");
        quitBtn.addEventListener("click", onQuit);
  
        // TODO: ここで「既存のゲーム起動関数」を呼ぶ
        // const { stop } = startTraceGame({ ctx, el, onSetFinished: (result)=> nav.go("result", { lastResult: result }) })
  
        return {
          el,
          cleanup() {
            quitBtn.removeEventListener("click", onQuit);
            // stop?.(); // 既存ゲームのタイマー/イベント解除
          }
        };
      }
    };
  }
  