import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { loadResumeState, saveResumeState, clearResumeState } from "../lib/progressStore.js"; 
 
export function HomeScreen(ctx, nav) {
   return {
     async mount() {
       const el = document.createElement("div");
       el.className = "screen home";

       // ✅ 背景は全画面共通（bg-app）に統一
      // ScreenManager側で付けるが、念のためHomeでも保険で付与
      document.documentElement.classList.add("bg-app");
      document.body.classList.add("bg-app");
 
       // ✅ 背景は ScreenManager 側で全画面共通（bg-app）に統一

       const selected = ctx.selectedRangeId ?? "kanji_g1";
       const range = CONTENT_MANIFEST.find((x) => x.id === selected);
       const rangeLabel = range?.label ?? "えらんでね";

       // ✅ つづき（途中セーブ）を読む
       const resume = loadResumeState();
       const hasResume = !!resume && resume.selectedRangeId === (ctx.selectedRangeId ?? selected);

       // play settings（全画面共通）
       const ps = (ctx.playSettings ||= { setSize: 5, order: "fixed" });
       const curSetSize = Number.isFinite(Number(ps.setSize)) ? Number(ps.setSize) : 5;
       const curOrder = (ps.order === "random") ? "random" : "fixed";

       // ✅ HomeのDOMはここで確実に生成（クリック委譲で壊れにくく）
       el.innerHTML = `
         <div class="card homeCard">
           <div class="homeHero">
             <div class="homeTitle">ねこなぞり</div>
             <div class="homeSubtitle">ねこで なぞって おぼえる</div>
             <div class="homeKinds muted">ひらがな・カタカナ・アルファベット・漢字</div>
           </div>
 
           <div class="homePrimary">
             <button class="btn primary bigBtn" data-action="play" type="button">
               ▶ はじめる
             </button>
             ${
                             hasResume
                               ? `<button class="btn bigBtn" data-action="resume" type="button">▶ つづきから</button>
                               <button class="btn bigBtn saveBtn" data-action="save" type="button">💾 せーぶ</button>
                                  <div class="muted" style="margin-top:6px; font-weight:900; font-size:12px; opacity:.75;">
                                    ✅ せーぶ されてるよ
                                  </div>`
                               : ``
                           }
                           <div id="saveToast" class="saveToast" aria-live="polite" role="status"></div>
             <div class="homePlayMeta muted">
              いまは：<b>${rangeLabel}</b> ・ <b>${curSetSize}もじ</b> ・ <b>${curOrder === "random" ? "ランダム" : "そのまま"}</b>
           </div>
 
           <div class="homeRange">
             <div class="homeRangeLabel muted">いまのもじ</div>
             <div class="homeRangeRow">
               <div class="homeRangeName">${rangeLabel}</div>
             </div>
             <div class="homeRangeActions">
               <button class="btn small ghost" data-action="range" type="button" aria-label="もじをえらぶ">
                 もじを えらぶ
               </button>
             </div>
           </div>

           <div class="homeRange" style="margin-top:12px;">
             <div class="homeRangeLabel muted">あそびかた</div>
             <div class="homeRangeRow" style="align-items:flex-start;">
               <div style="flex:1; display:grid; gap:10px;">
                 <label style="display:flex; justify-content:space-between; gap:10px; align-items:center; font-weight:900;">
                   <span>1セットの もじ数</span>
                   <select id="setSize" class="btn" style="min-width:140px; height:44px; font-size:16px;">
                     ${[1,3,5,10,15].map(n => `<option value="${n}" ${n===curSetSize?"selected":""}>${n}もじ</option>`).join("")}
                   </select>
                 </label>
                 <label style="display:flex; justify-content:space-between; gap:10px; align-items:center; font-weight:900;">
                   <span>ならびかえ</span>
                   <select id="orderPolicy" class="btn" style="min-width:140px; height:44px; font-size:16px;">
                     <option value="fixed" ${curOrder==="fixed"?"selected":""}>そのまま</option>
                     <option value="random" ${curOrder==="random"?"selected":""}>ランダム</option>
                   </select>
                 </label>
                 <div class="muted" style="font-weight:800; font-size:12px; line-height:1.4;">
                   ランダムは、この中から まいかい ちがう じゅんばんで でます。
               </div>
             </div>
           </div>
 
           <div class="homeGrid">
             <button class="btn" data-action="review" type="button">📝 ふくしゅう</button>
             <button class="btn" data-action="progress" type="button">🐾 きろく</button>
             <button class="btn" data-action="dex" type="button">📚 ずかん</button>
             <button class="btn" data-action="titleBook" type="button">🏆 しょうごう</button>
           </div>
 
           <div class="homeFooter muted">
             まちがえても だいじょうぶ。ゆっくり なぞろう。
           </div>
         </div>
       `;
 
       // ✅ querySelectorして個別にaddEventListenerしない（null事故を根絶）
       const onClick = (e) => {
         const btn = e.target.closest("[data-action]");
         if (!btn) return;
         const action = btn.dataset.action;
 
         // 共通：選択中の範囲を維持
         const selectedRangeId = ctx.selectedRangeId ?? selected;
 
         switch (action) {
           case "play":
            // ✅ 新しくはじめる：途中セーブは消す
             clearResumeState();
             ctx.resumeCandidate = null;
            // ✅ ランダム順の「同一セッション内固定」を実現するため、開始時にセッションを切る
             if ((ctx.playSettings?.order ?? "fixed") === "random") {
                 ctx.playSession = { id: Date.now(), rangeId: selectedRangeId, order: "random", ids: null };
               } else {
                 ctx.playSession = null;
               }
             nav.go("game", {
               selectedRangeId,
               mode: "kid",
                // ✅ Homeからの開始は「前回のResult由来の開始位置」を持ち込まない
               startFromIdx: null,
               startFromId: null,
               // 余計な文脈を持ち込まない
               singleId: null,
               returnTo: null,
             });
             break;
             case "resume": {
                           if (!hasResume) return;
                           // ✅ 復元候補を ctx に積む（startTraceGame が render() 内で適用する）
                           ctx.resumeCandidate = resume;
                           // ランダム順の順序も維持したいので playSession を復元
                           if (resume.playSession) ctx.playSession = resume.playSession;
                           if (resume.playSettings) ctx.playSettings = resume.playSettings;
              
                           nav.go("game", {
                             selectedRangeId,
                             mode: resume.mode ?? "kid",
                             startFromIdx: Number.isFinite(resume.idx) ? resume.idx : null,
                             startFromId: null,
                             singleId: null,
                             returnTo: null,
                           });
                           break;
                         }
                         case "save": {
                                       if (!hasResume) return;
                                       // ✅ 既存の途中セーブを「今の時刻で更新」して、子どもに“セーブした”を見せる
                                       try { saveResumeState(resume); } catch {}
                                       const toast = el.querySelector("#saveToast");
                                       if (toast) {
                                         toast.textContent = "✅ せーぶしたよ";
                                         toast.classList.remove("show");
                                         void toast.offsetWidth;
                                         toast.classList.add("show");
                                         setTimeout(() => toast.classList.remove("show"), 1200);
                                       }
                                       if (navigator.vibrate) navigator.vibrate(25);
                                       break;
                                     }  
           case "range":
             nav.go("rangeSelect", { selectedRangeId });
             break;
           case "review":
             nav.go("reviewStart", { selectedRangeId });
             break;
           case "progress":
             nav.go("progress", { selectedRangeId });
             break;
           case "dex":
             nav.go("dex", { selectedRangeId });
             break;
           case "titleBook":
             nav.go("titleBook", { selectedRangeId });
             break;
         }
       };
 
       el.addEventListener("click", onClick);

       // ✅ 設定UI（select）の変更はここで吸う
       const setSizeEl = el.querySelector("#setSize");
       const orderEl = el.querySelector("#orderPolicy");
       const onSettingsChange = () => {
         const nextSet = Math.max(1, Math.min(20, Number(setSizeEl?.value ?? curSetSize)));
         const nextOrder = (orderEl?.value === "random") ? "random" : "fixed";
         ctx.playSettings = { ...(ctx.playSettings ?? {}), setSize: nextSet, order: nextOrder };
         // 設定を変えたらセッションは破棄（結果→次へ で順序がズレるのを防ぐ）
         ctx.playSession = null;
       };
       setSizeEl?.addEventListener("change", onSettingsChange);
       orderEl?.addEventListener("change", onSettingsChange);
 
       return {
         el,
         cleanup() {
           el.removeEventListener("click", onClick);
           setSizeEl?.removeEventListener("change", onSettingsChange);
           orderEl?.removeEventListener("change", onSettingsChange);
           // ✅ 背景は ScreenManager 側で全画面共通（bg-app）に統一
         },
       };
     },
   };
 }