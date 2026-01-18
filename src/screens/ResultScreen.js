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
          return `<div class="final-hist-row">${i + 1}. <b>${t}</b> <span class="muted">/ ${a}% / ${rk}</span></div>`;
        }).join("");
  
        el.innerHTML = `
          <div class="resultBoard">
            <div class="resultHeader">
              <div class="resultTitle">
                <div class="resultTitleMain">けっか</div>
                <div class="resultTitleSub muted">${r?.title ? `称号：<b>${r.title}</b>` : ""}</div>
              </div>
              <div class="resultRankWrap">
                <div class="resultRankBadge rank-${r?.rank ?? "C"}">
                  <div class="resultRankLabel">RANK</div>
                  <div class="resultRankValue">${r?.rank ?? "-"}</div>
                </div>
              </div>
            </div>

            <div class="resultComment">
              ${r?.comment ? `<div class="commentBubble">${r.comment}</div>` : `<div class="commentBubble muted">（結果データなし）</div>`}
            </div>

            <div class="resultHighlights">
              <div class="highlightCard">
                <div class="hLabel">タイム</div>
                <div class="hValue">${r?.timeText ?? "-:--"}</div>
              </div>
              <div class="highlightCard ${r?.isNewPB ? "isPB" : ""}">
                <div class="hLabel">じこベスト</div>
                <div class="hValue">
                  ${r?.personalBestText ?? "-:--"}
                  ${r?.isNewPB ? `<span class="pbChip">NEW!</span>` : ""}
                </div>
              </div>
            </div>

            <div class="resultStatsGrid">
              <div class="statPill"><span>せいこうりつ</span><b>${r?.accuracy ?? 0}%</b></div>
              <div class="statPill"><span>せいこう/しこう</span><b>${r?.success ?? 0}/${r?.attempts ?? 0}</b></div>
              <div class="statPill"><span>きゅうさい</span><b>${r?.rescued ?? 0}</b></div>
              <div class="statPill"><span>セット</span><b>${(r?.setLen ?? 5)}もじ</b></div>
            </div>

            ${histHtml ? `
              <div class="resultHistory">
                <div class="resultHistoryTitle">さいきん5かい</div>
                <div class="resultHistoryList">${histHtml}</div>
              </div>
            ` : ""}

           <div class="resultActions">
              <button id="next" class="btn primary big">つぎの${r?.setLen ?? 5}もじ</button>
              <div class="resultActionsSub">
                <button id="replay" class="btn">もういちど</button>
                <button id="progress" class="btn">クリアしたもの</button>
                <button id="titlebook" class="btn">称号ずかん</button>
                <button id="home" class="btn">ホーム</button>
              </div>
            </div>
          </div>
         `;
    
  
        const onReplay = () => {
          // 同じセット先頭に戻したいなら setStart を使う
          const setStart = Number.isFinite(r?.setStart) ? r.setStart : null;
          nav.go("game", {
                        selectedRangeId: ctx.selectedRangeId,
                        startFromIdx: setStart ?? null,
                        startFromId: null,
                      });
        };
  
        const onNext = () => {
          const nextStart = Number.isFinite(ctx.nextStart) ? ctx.nextStart : 0;
          nav.go("game", {
                        selectedRangeId: ctx.selectedRangeId,
                        startFromIdx: nextStart,
                        startFromId: null,
                      });
        };
  
        const onProgress = () => nav.go("progress", { selectedRangeId: ctx.selectedRangeId });
        const onTitleBook = () => nav.go("titleBook", { from: "result" });
        const onHome = () => nav.go("home", { selectedRangeId: ctx.selectedRangeId });
  
        const replayBtn = el.querySelector("#replay");
        const nextBtn = el.querySelector("#next");
        const progressBtn = el.querySelector("#progress");
        const titleBookBtn = el.querySelector("#titlebook");
        const homeBtn = el.querySelector("#home");
        // （titlebook は現状 listener を付けてないので、ここでは必須にしない）

        const missing = [];
        if (!replayBtn) missing.push("#replay");
        if (!nextBtn) missing.push("#next");
        if (!progressBtn) missing.push("#progress");
        if (!titleBookBtn) missing.push("#titlebook");
        if (!homeBtn) missing.push("#home");
        if (missing.length) {
          console.error("[ResultScreen] DOM missing:", missing, "current HTML:", el.innerHTML);
          throw new Error(`[ResultScreen] 必須ボタンが見つかりません: ${missing.join(", ")}`);
        }

        replayBtn.addEventListener("click", onReplay);
        nextBtn.addEventListener("click", onNext);
        progressBtn.addEventListener("click", onProgress);
        titleBookBtn.addEventListener("click", onTitleBook);
        homeBtn.addEventListener("click", onHome);

        return {
          el,
          cleanup() {
            replayBtn.removeEventListener("click", onReplay);
            nextBtn.removeEventListener("click", onNext);
            progressBtn.removeEventListener("click", onProgress);
            titleBookBtn.removeEventListener("click", onTitleBook);
            homeBtn.removeEventListener("click", onHome);
          }
        };
      }
    };
  }
  