// src/screens/GameScreen.js
import { startTraceGame } from "../game/startTraceGame.js";
import { recordReviewSession, saveProgress, saveResumeState, clearResumeState } from "../lib/progressStore.js";
import { getRangeType } from "../lib/rangeItems.js";
import { makeProgressKey } from "../lib/progressKey.js";
export function GameScreen(ctx, nav) {
  let game = null;
  let allowResumeSave = true; // Resultへ行く時などは false にして保存しない
  // 復習ナビ（single練習終了時に startTraceGame から返ってくる）
  let lastReviewNav = null;
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen game";

      const mode = ctx.mode ?? "kid"; // "kid" | "master"
      // ✅ single練習（図鑑から来た）判定
      const isSinglePractice = !!ctx.singleId && ctx.returnTo === "dex";

      // 旧 index.html のDOMをここで生成（あなたの既存CSSを活かす）
      const setSize = Math.max(1, Math.min(20, Number(ctx?.playSettings?.setSize ?? 5)));
      const goalText = isSinglePractice ? "もくひょう：1もじ" : `もくひょう：${setSize}もじ`;
      el.innerHTML = `
        <div class="hud">
          <div id="stars" class="stars" aria-label="進捗"></div>
          <div class="hud-right">
            <div id="mode" class="mode">${goalText}</div>
            <button id="masterToggle" class="masterToggle" type="button"
              aria-pressed="${mode === "master" ? "true" : "false"}"
              title="MASTERモード切替">
              MASTER
            </button>
            ${
                              isSinglePractice
                                ? `<button id="dexBackBtn" class="iconBtn" type="button" aria-label="もどる">↩</button>`
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
          </div>

          <p id="hint" class="caption">なぞって、書き順どおりに進めよう。</p>
          <div id="error" class="error" role="status" aria-live="polite"></div>
        </div>
      `;

      const homeBtn = el.querySelector("#homeBtn");
            const dexBackBtn = el.querySelector("#dexBackBtn");
            const prevBtn = el.querySelector("#prevBtn");
    const nextBtn = el.querySelector("#nextBtn");

            const onHome = () => {
              const ok = window.confirm("ホームにもどりますか？\n（つづきは せーぶ されます）");
              if (!ok) return;
              nav.go("home", { selectedRangeId: ctx.selectedRangeId });
            };
            const onDexBack = () => {
              const ok = window.confirm("図鑑にもどりますか？\n（つづきは せーぶ されます）");
              if (!ok) return;
              nav.go("dex", {
                selectedRangeId: ctx.selectedRangeId,
                focusId: ctx.singleId,
                from: ctx.returnFrom ?? "progress",
              });
            };
      
            homeBtn?.addEventListener("click", onHome);
            dexBackBtn?.addEventListener("click", onDexBack);

            // ✅ MASTER切替：画面を再マウントして startTraceGame を作り直す（事故が少ない）
      const masterToggle = el.querySelector("#masterToggle");
      const onToggleMaster = () => {
        const nextMode = (ctx.mode ?? "kid") === "master" ? "kid" : "master";
        nav.go("game", { ...ctx, mode: nextMode });
      };
      masterToggle?.addEventListener("click", onToggleMaster);

            // ✅ 復習中の「まえ/つぎ」は review キュー移動にする（未クリア巡回）
            const isReviewActive = !!ctx.review?.active;

            // 復習開始直後（lastReviewNavがまだ無い）でも動くように、ローカルでnext/prevを計算
            const calcLocalReviewNav = () => {
                const rv = ctx?.review;
                if (!rv?.active || !Array.isArray(rv.queue) || rv.queue.length === 0) return null;
  
                const q = rv.queue;
                const n = q.length;
                const cur = Number.isFinite(rv.index) ? rv.index : 0;
                const onlyUnc = !!rv.onlyUncleared;
                const type = getRangeType(ctx.selectedRangeId);
  
                const isClearedById = (id) => {
                  const key = makeProgressKey(type, id);
                  return !!ctx?.progress?.cleared?.[key];
                };
                const accept = (id) => !onlyUnc || !isClearedById(id);
  
                const step = (dir) => {
                  for (let k = 1; k <= n; k++) {
                    const i = (cur + dir * k + n) % n;
                    const id = q[i];
                    if (accept(id)) return { index: i, id };
                  }
                  return { index: null, id: null };
                };
  
                const next = step(+1);
                const prev = step(-1);
                return {
                  curIndex: cur,
                  curId: q[cur],
                  nextIndex: next.index,
                  nextId: next.id,
                  prevIndex: prev.index,
                  prevId: prev.id,
                  onlyUncleared: onlyUnc,
                  done: next.id == null,
                };
              };
  
              // 初期化（復習に入った瞬間から prev/next を効かせる）
              if (isReviewActive && !lastReviewNav) {
                lastReviewNav = calcLocalReviewNav();
              }
            const onReviewPrev = () => {
              if (!isReviewActive) return;
              const navInfo = lastReviewNav ?? calcLocalReviewNav();
              const review = ctx.review;
              if (!review || !navInfo || !navInfo.prevId || !Number.isFinite(navInfo.prevIndex)) return;
              nav.go("game", {
                selectedRangeId: ctx.selectedRangeId,
                review: { ...review, index: navInfo.prevIndex },
                singleId: navInfo.prevId,
                mode: "kid",
                returnTo: "review",
                returnFrom: ctx.returnFrom ?? "progress",
              });
            };
            const onReviewNext = () => {
              if (!isReviewActive) return;
              const navInfo = lastReviewNav ?? calcLocalReviewNav();
              const review = ctx.review;
              if (!review || !navInfo || !navInfo.nextId || !Number.isFinite(navInfo.nextIndex)) return;
              nav.go("game", {
                selectedRangeId: ctx.selectedRangeId,
                review: { ...review, index: navInfo.nextIndex },
                singleId: navInfo.nextId,
                mode: "kid",
                returnTo: "review",
                returnFrom: ctx.returnFrom ?? "progress",
              });
            };
      
            if (isReviewActive) {
              // UI文言も復習寄りに（任意・軽量）
              prevBtn && (prevBtn.textContent = "まえ（復習）");
              nextBtn && (nextBtn.textContent = "つぎ（復習）");
              prevBtn?.addEventListener("click", onReviewPrev);
              nextBtn?.addEventListener("click", onReviewNext);
            }

      game = startTraceGame({
        rootEl: el,
        ctx,
        selectedRangeId: ctx.selectedRangeId,
        startFromId: ctx.startFromId,
        startFromIdx: ctx.startFromIdx,
        singleId: ctx.singleId,
        mode: ctx.mode ?? "kid",
        onSetFinished: ({ result, nextStart, history, mode, singleId, reviewNav }) => {
                              // ✅ 復習ナビを保持（まえ/つぎボタンで使う）
                              if (reviewNav) lastReviewNav = reviewNav;
                    // ✅ single練習（復習モード）
                    if (mode === "single" && ctx.review?.active) {
                      const review = ctx.review;
                      const id = singleId ?? ctx.singleId;
          
                      // 失敗数（result.failは「判定失敗（ストローク）」が入る想定）
                      const fails = Number.isFinite(result?.fail) ? result.fail : 0;
                      review.mistakes[id] = (review.mistakes[id] ?? 0) + fails;
                      review.cleared.push(id);
          
                       // ✅ 次の遷移先（未クリア巡回に対応）
                      const onlyUnc = !!review.onlyUncleared;
                      const hasNav = !!reviewNav && Number.isFinite(reviewNav.nextIndex) && !!reviewNav.nextId;
                      const nextIndex = onlyUnc && hasNav ? reviewNav.nextIndex : (review.index ?? 0) + 1;
                      const nextId = onlyUnc && hasNav ? reviewNav.nextId : review.queue?.[nextIndex];

                      // ✅ 終了判定
                      // - onlyUncleared: 次が無い（done）なら終了
                      // - 通常: 末尾まで行ったら終了（従来通り）
                      const shouldFinish =
                        (onlyUnc && (!!reviewNav?.done || !nextId)) ||
                        (!onlyUnc && nextIndex >= review.queue.length);

                      if (shouldFinish) {
                        // 終了 → 結果画面
                        const totalFails = Object.values(review.mistakes).reduce((a, b) => a + (b ?? 0), 0);
                        
                        
              // ✅ 永続化（直近30件）
              recordReviewSession(ctx.progress, {
                rangeId: ctx.selectedRangeId,
                total: review.queue.length,
                clearedCount: review.cleared.length,
                totalFails,
                policy: review.policy,
                onlyUncleared: review.onlyUncleared,
              });
              saveProgress(ctx.progress);
                        
                        
                        nav.go("reviewResult", {
                          reviewResult: {
                            startedAt: review.startedAt,
                            total: review.queue.length,
                            clearedCount: review.cleared.length,
                            totalFails,
                            mistakes: review.mistakes,
                            labels: review.labels,
                          },
                        });
                        return;
                      }
          
                      // 次の問題へ
                      nav.go("game", {
                        selectedRangeId: ctx.selectedRangeId,
                        review: { ...review, index: nextIndex },
                        singleId: nextId,
                        returnTo: "review",
                        returnFrom: ctx.returnFrom ?? "progress",
                      });
                      return;
                    }
          
                    // ✅ single練習（通常：図鑑へ戻る）
                    if (mode === "single") {
                      nav.go("dex", {
                        selectedRangeId: ctx.selectedRangeId,
                        focusId: singleId ?? ctx.singleId,
                        from: ctx.returnFrom ?? "progress",
                      });
                      return;
                    }
          
                    // 通常はResult画面へ
                    // ✅ ScreenManagerがctxを置換する実装でも、
                    // Result側で selectedRangeId / nextStart が欠けないように明示的に渡す
                    // 通常はResult画面へ（＝セット完了。途中再開は不要）
                    allowResumeSave = false;
                    clearResumeState();
                    nav.go("result", { lastResult: result, nextStart, history });
                  },
      });

      if (!game || !game.ready) {
           throw new Error("[GameScreen] startTraceGame() did not return { ready }");
         }
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
          homeBtn?.removeEventListener("click", onHome);
          dexBackBtn?.removeEventListener("click", onDexBack);
          // 復習ボタン解除
          if (isReviewActive) {
              prevBtn?.removeEventListener("click", onReviewPrev);
              nextBtn?.removeEventListener("click", onReviewNext);
            }
            lastReviewNav = null;

          masterToggle?.removeEventListener("click", onToggleMaster);
          // ✅ 途中セーブ（通常プレイのみ）
          try {
              if (allowResumeSave && game?.getState) {
                const st = game.getState();
                if (st?.resumable) {
                  saveResumeState({
                    selectedRangeId: st.selectedRangeId,
                    mode: st.mode,
                    idx: st.idx,
                    strokeIndex: st.strokeIndex,
                    done: st.done,
                    failStreak: st.failStreak,
                    playSettings: st.playSettings,
                    playSession: st.playSession,
                  });
                }
              }
            } catch {}
  
            game?.stop?.();
          game = null;
        }
      };
    }
  };
}
