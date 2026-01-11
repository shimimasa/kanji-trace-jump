export function ResultScreen(ctx, nav) {
    return {
      async mount() {
        const el = document.createElement("div");
        el.className = "screen result";
  
        const r = ctx.lastResult ?? null;
  
        el.innerHTML = `
          <h1>けっか</h1>
          <div class="card">
            <div>${r ? "セットクリア！" : "（結果データなし）"}</div>
          </div>
          <button id="replay">もういちど</button>
          <button id="next">つぎの5もじ</button>
          <button id="book">クリアしたもの</button>
          <button id="home">ホーム</button>
        `;
  
        const onReplay = () => nav.go("game", { replay: true });
        const onNext = () => nav.go("game", { advanceSet: true });
        const onBook = () => nav.go("progress");
        const onHome = () => nav.go("home");
  
        el.querySelector("#replay").addEventListener("click", onReplay);
        el.querySelector("#next").addEventListener("click", onNext);
        el.querySelector("#book").addEventListener("click", onBook);
        el.querySelector("#home").addEventListener("click", onHome);
  
        return {
          el,
          cleanup() {
            el.querySelector("#replay").removeEventListener("click", onReplay);
            el.querySelector("#next").removeEventListener("click", onNext);
            el.querySelector("#book").removeEventListener("click", onBook);
            el.querySelector("#home").removeEventListener("click", onHome);
          }
        };
      }
    };
  }
  