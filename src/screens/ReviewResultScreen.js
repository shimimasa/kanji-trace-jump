// src/screens/ReviewResultScreen.js
export function ReviewResultScreen(ctx, nav) {
    return {
      async mount() {
        const el = document.createElement("div");
        el.className = "screen review";
  
        const review = ctx.reviewResult ?? null;
  
        const topMistakes = (() => {
          if (!review?.mistakes) return [];
          const entries = Object.entries(review.mistakes);
          entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
          return entries.slice(0, 3);
        })();
  
        el.innerHTML = `
          <div class="reviewBoard">
            <div class="reviewHead">
              <div>
                <div class="reviewTitle">復習の結果</div>
                <div class="reviewMeta muted">${review ? `かかった時間：${formatMs(Date.now() - review.startedAt)}` : ""}</div>
              </div>
              <div class="reviewHeadActions">
                <button id="toProgress" class="btn" type="button">一覧へ</button>
                <button id="toHome" class="btn" type="button">ホーム</button>
              </div>
            </div>
  
            <div class="reviewCard">
              ${
                review
                  ? `
                    <div class="reviewSummary">
                      <div class="sumBox"><span>出題</span><b>${review.total}</b></div>
                      <div class="sumBox"><span>クリア</span><b>${review.clearedCount}</b></div>
                      <div class="sumBox"><span>ミス合計</span><b>${review.totalFails}</b></div>
                    </div>
  
                    <div class="reviewSection">
                      <div class="reviewLabel">苦手TOP3（ミス多い）</div>
                      <div class="reviewList">
                        ${
                          topMistakes.length
                            ? topMistakes
                                .map(([id, n], i) => `<div class="reviewRow">${i + 1}. <b>${id}</b> <span class="muted">ミス ${n}</span></div>`)
                                .join("")
                            : `<div class="muted">ミスはありませんでした！</div>`
                        }
                      </div>
                    </div>
  
                    <div class="reviewActions">
                      <button id="retry" class="btn primary big" type="button">もう一度復習</button>
                    </div>
                  `
                  : `<div class="muted">結果データがありません。</div>`
              }
            </div>
          </div>
        `;
  
        const onClick = (e) => {
          const t = e.target;
          if (t.closest("#toProgress")) nav.go("progress");
          if (t.closest("#toHome")) nav.go("home");
          if (t.closest("#retry")) nav.go("reviewStart", { from: "progress" });
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
  
  function formatMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  