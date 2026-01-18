import { CONTENT_MANIFEST } from "../data/contentManifest.js";
 
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
           </div>
 
           <div class="homeRange">
             <div class="homeRangeLabel muted">いまの範囲</div>
             <div class="homeRangeRow">
               <div class="homeRangeName">${range?.label ?? "未選択"}</div>
               <button class="btn" data-action="range" type="button">えらぶ</button>
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
                     <option value="fixed" ${curOrder==="fixed"?"selected":""}>いつもどおり</option>
                     <option value="random" ${curOrder==="random"?"selected":""}>ランダム</option>
                   </select>
                 </label>
                 <div class="muted" style="font-weight:800; font-size:12px; line-height:1.4;">
                   ランダムは、同じ学年（範囲）の中から毎回ちがう順番で出ます。
                 </div>
               </div>
             </div>
           </div>
 
           <div class="homeGrid">
             <button class="btn" data-action="review" type="button">📝 ふくしゅう</button>
             <button class="btn" data-action="progress" type="button">🐾 きろく</button>
             <button class="btn" data-action="dex" type="button">📚 ずかん</button>
             <button class="btn" data-action="titleBook" type="button">🏆 タイトル</button>
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