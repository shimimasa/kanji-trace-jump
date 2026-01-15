// src/screens/HomeScreen.js
import { CONTENT_MANIFEST } from "../data/contentManifest.js";

export function HomeScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen home";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find((x) => x.id === selected);

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

          <div class="homeGrid">
            <button class="btn" data-action="review" type="button">📝 ふくしゅう</button>
            <button class="btn" data-action="progress" type="button">⭐ きろく</button>
            <button class="btn" data-action="dex" type="button">📚 ずかん</button>
            <button class="btn" data-action="titleBook" type="button">🏆 タイトル</button>
          </div>

          <div class="homeFooter muted">
            まちがえても だいじょうぶ。ゆっくり なぞろう。
          </div>
        </div>
        

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
            <button id="start" class="btn primary" type="button">スタート</button>
            <button id="range" class="btn" type="button">範囲をえらぶ</button>
            <button id="progress" class="btn" type="button">クリアしたもの</button>
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
            nav.go("game", {
              selectedRangeId,
              mode: "kid",
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

      return {
        el,
        cleanup() {
          el.removeEventListener("click", onClick);
        },
      };
    },
  };
}
