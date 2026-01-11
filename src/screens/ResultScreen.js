// src/screens/ResultScreen.js
export function ResultScreen(ctx, nav) {
    return {
      async mount() {
        const el = document.createElement("div");
        el.className = "screen result";
  
        const r = ctx.lastResult ?? null;
        const hist = Array.isArray(ctx.history) ? ctx.history : [];
  
        const histHtml = hist.slice(0, 5).map((h, i) => {
          const t = h?.timeText ?? "-:--";
          const a = Number.isFinite(h?.accuracy) ? h.accuracy : 0;
          const rk = h?.rank ?? "-";
          return `<div class="final-hist-row">${i + 1}. ${t} / ${a}% / ${rk}</div>`;
        }).join("");
  
        el.innerHTML = `
          <div class="card">
            <h1>けっか</h1>
  
            ${
              r?.title
                ? `<div style="margin:6px 0;">称号：<b>${r.title}</b></div>`
                : ``
            }
  
            ${
              r
                ? `
                  <div class="rank-row">
                    <span class="rank-badge rank-${r.rank ?? "C"}">ランク ${r.rank ?? "-"}</span>
                  </div>
                  <div class="comment-row">
                    <span class="comment-text">${r.comment ?? ""}</span>
                  </div>
  
                  <div class="final-stats">
                    <div class="final-stat"><span>タイム</span><b>${r.timeText ?? "-:--"}</b></div>
                    <div class="final-stat pb"><span>じこベスト</span><b>${r.personalBestText ?? "-:--"}${r.isNewPB ? ' <em class="pb-new">NEW!</em>' : ""}</b></div>
                    <div class="final-stat"><span>せいこうりつ</span><b>${r.accuracy ?? 0}%</b></div>
                    <div class="final-stat"><span>せいこう/しこう</span><b>${r.success ?? 0}/${r.attempts ?? 0}</b></div>
                    <div class="final-stat"><span>きゅうさい</span><b>${r.rescued ?? 0}</b></div>
                    <div class="final-stat"><span>セット</span><b>${(r.setLen ?? 5)}もじ</b></div>
                  </div>
                `
                : `<div>（結果データなし）</div>`
            }
  
            ${histHtml ? `<div class="final-hist"><div class="final-hist-title">さいきん5かい</div>${histHtml}</div>` : ""}
  
            <div class="final-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <button id="replay" class="btn">もういちど</button>
              <button id="next" class="btn primary">つぎの5もじ</button>
              <button id="progress" class="btn">クリアしたもの</button>
              <button id="home" class="btn">ホーム</button>
            </div>
          </div>
        `;
  
        const onReplay = () => {
          // 同じセット先頭に戻したいなら setStart を使う
          const setStart = Number.isFinite(r?.setStart) ? r.setStart : null;
          nav.go("game", { startFromIdx: setStart ?? null, startFromId: null });
        };
  
        const onNext = () => {
          const nextStart = Number.isFinite(ctx.nextStart) ? ctx.nextStart : 0;
          nav.go("game", { startFromIdx: nextStart, startFromId: null });
        };
  
        const onProgress = () => nav.go("progress");
        const onHome = () => nav.go("home");
  
        el.querySelector("#replay").addEventListener("click", onReplay);
        el.querySelector("#next").addEventListener("click", onNext);
        el.querySelector("#progress").addEventListener("click", onProgress);
        el.querySelector("#home").addEventListener("click", onHome);
  
        return {
          el,
          cleanup() {
            el.querySelector("#replay").removeEventListener("click", onReplay);
            el.querySelector("#next").removeEventListener("click", onNext);
            el.querySelector("#progress").removeEventListener("click", onProgress);
            el.querySelector("#home").removeEventListener("click", onHome);
          }
        };
      }
    };
  }
  