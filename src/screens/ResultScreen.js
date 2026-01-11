// src/screens/ResultScreen.js
export function ResultScreen(ctx, nav) {
    return {
      async mount() {
        const el = document.createElement("div");
        el.className = "screen result";
  
        const r = ctx.lastResult;
  
        el.innerHTML = `
          <div class="card">
            <h1>けっか</h1>
            <div>タイム：<b>${r?.timeText ?? "-:--"}</b></div>
            <div>せいこうりつ：<b>${r?.accuracy ?? 0}%</b></div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
              <button id="replay" class="btn">もういちど</button>
              <button id="next" class="btn primary">つぎの5もじ</button>
              <button id="progress" class="btn">クリアしたもの</button>
              <button id="home" class="btn">ホーム</button>
            </div>
          </div>
        `;
  
        const onReplay = () => {
          // そのセット先頭へ戻したいなら setStart を渡す（必要なら後で）
          nav.go("game", { startFromId: null });
        };
        const onNext = () => {
          // nextStart は startTraceGame から渡してる
          // 「次のセット先頭の漢字IDへ飛ぶ」をするには、範囲データからID解決が必要。
          // いったんは “Game側で nextStart idx を受け取る” にするのが安全。
          nav.go("game", { startFromIdx: ctx.nextStart ?? null });
        };
        const onProg = () => nav.go("progress");
        const onHome = () => nav.go("home");
  
        el.querySelector("#replay").addEventListener("click", onReplay);
        el.querySelector("#next").addEventListener("click", onNext);
        el.querySelector("#progress").addEventListener("click", onProg);
        el.querySelector("#home").addEventListener("click", onHome);
  
        return {
          el,
          cleanup() {
            el.querySelector("#replay").removeEventListener("click", onReplay);
            el.querySelector("#next").removeEventListener("click", onNext);
            el.querySelector("#progress").removeEventListener("click", onProg);
            el.querySelector("#home").removeEventListener("click", onHome);
          }
        };
      }
    };
  }
  