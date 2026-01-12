// src/screens/KanjiDexScreen.js
import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { isCleared, getWeakScore } from "../lib/progressStore.js";

function makeItemId(rangeId, itemId) {
  return `${rangeId}::${itemId}`;
}

function getLabel(it) {
  return it?.label ?? it?.kanji ?? it?.kana ?? it?.char ?? it?.text ?? it?.id ?? "？";
}

function getReadingOn(it) {
  // データが揃ったら即反映されるよう「候補」を広めに
  return it?.on ?? it?.onyomi ?? it?.onYomi ?? it?.readingOn ?? it?.yomiOn ?? "";
}

function getReadingKun(it) {
  return it?.kun ?? it?.kunyomi ?? it?.kunYomi ?? it?.readingKun ?? it?.yomiKun ?? "";
}

function getExample(it) {
  return it?.example ?? it?.exampleSentence ?? it?.reibun ?? it?.sentence ?? it?.ex ?? "";
}

export function KanjiDexScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen dex";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      const range = CONTENT_MANIFEST.find((x) => x.id === selected);

      const base = import.meta.env.BASE_URL ?? "/";
      const url = new URL(range.source, new URL(base, window.location.href)).toString();
      const res = await fetch(url);
      const items = await res.json();

      // --- Dex state ---
      let onlyUncleared = false; // 未クリアだけ
      let sortMode = "default";  // "default" | "review" | "mist"
      let view = [];             // フィルタ/ソート後の配列
      let index = 0;

      const getLastAt = (it) => {
        // 復習ソート用：最後にクリアした時刻（なければ0）
        const key = makeItemId(range.id, it.id);
        return ctx.progress?.cleared?.[key]?.clearedAt ?? 0;
      };

      const getMistScore = (it) => {
                const key = makeItemId(range.id, it.id);
                return getWeakScore(ctx.progress, key);
              };

      const buildView = () => {
        let arr = items.slice();

        if (onlyUncleared) {
          arr = arr.filter((it) => !isCleared(ctx.progress, makeItemId(range.id, it.id)));
        }

        if (sortMode === "review") {
          // 最近やってない順（古い→新しい）
          arr.sort((a, b) => getLastAt(a) - getLastAt(b));
        } else if (sortMode === "mist") {
          // 失敗率：高い順（ミス数を主軸）
          arr.sort((a, b) => getMistScore(b) - getMistScore(a));
        } else {
          // デフォルト：データ順（JSON順）
        }

        view = arr.length ? arr : items.slice(); // 空になったらfallback（操作不能を避ける）
      };

      const clampIndex = () => {
        if (view.length <= 0) index = 0;
        else index = Math.max(0, Math.min(view.length - 1, index));
      };

      const setIndexById = (id) => {
        if (!id) return;
        const found = view.findIndex((x) => x?.id === id);
        if (found >= 0) index = found;
      };

      // 初期：focusIdがあればそこへ
      buildView();
      if (ctx.focusId) {
        // まず items の中で位置を見つけ、viewにも反映
        // （未クリアフィルタ中に focusId が消える可能性があるので setIndexById は後）
        const raw = items.find((x) => x?.id === ctx.focusId);
        if (raw) {
          // viewに存在するならそこへ
          setIndexById(ctx.focusId);
        }
      }
      clampIndex();

      const render = () => {
        clampIndex();
        const it = view[index];
        const label = getLabel(it);

        const cleared = isCleared(ctx.progress, makeItemId(range.id, it.id));
        const pKey = makeItemId(range.id, it.id);
        const pItem = ctx.progress?.items?.[pKey] ?? null;
        const masterAttempts = pItem?.masterAttempts ?? 0;
        const masterPasses = pItem?.masterPasses ?? 0;
        const masterOk = masterPasses > 0;
        const mm = pItem?.masterMistakes ?? {};
        const mistakeRows = [
          ["WRONG_ORDER", "順番×"],
          ["BAD_SHAPE", "線×"],
          ["TOO_SHORT", "短×"],
          ["START_OFF", "始×"],
          ["FAR_FROM_STROKE", "外×"],
        ]
          .map(([k, label]) => ({ k, label, v: Number(mm?.[k] ?? 0) }))
          .filter((x) => x.v > 0);
        const on = getReadingOn(it);
        const kun = getReadingKun(it);
        const ex = getExample(it);

        const hasReading = !!(on || kun);
        const hasExample = !!ex;

        el.innerHTML = `
          <div class="dexBoard">
            <div class="dexHead">
              <div>
                <div class="dexTitle">図鑑</div>
                <div class="dexMeta">範囲：<b>${range?.label ?? "未選択"}</b></div>
              </div>
              <div class="dexHeadActions">
              <button id="review" class="btn" type="button">復習</button>
                <button id="back" class="btn" type="button">もどる</button>
              </div>
            </div>

            <div class="dexTools">
              <button id="toggleUncleared" class="tab ${onlyUncleared ? "active" : ""}" type="button">
                未クリアだけ
              </button>
              <button id="sortDefault" class="tab ${sortMode === "default" ? "active" : ""}" type="button">
                通常
              </button>
              <button id="sortReview" class="tab ${sortMode === "review" ? "active" : ""}" type="button">
                復習（最近やってない順）
              </button>
              <button id="sortMist" class="tab ${sortMode === "mist" ? "active" : ""}" type="button">
                復習（ミス多い順）
              </button>
            </div>

            <div class="dexCard">
              <div class="dexChar">${label}</div>
              <div class="dexStatus">${cleared ? "✓ クリア済み" : "未クリア"}</div>
<div class="dexMasterBox">
                <div class="dexMasterHead">
                  <div class="dexMasterTitle">MASTER</div>
                  ${masterOk ? `<div class="dexMasterBadge ok">✓</div>` : `<div class="dexMasterBadge">—</div>`}
                </div>
                <div class="dexMasterStats">
                  <div class="dexMasterStat"><span>挑戦</span><b>${masterAttempts}</b></div>
                  <div class="dexMasterStat"><span>合格</span><b>${masterPasses}</b></div>
                </div>
                ${
                  mistakeRows.length
                    ? `
                      <div class="dexMasterMist">
                        ${mistakeRows
                          .map((m) => `<div class="dexMistPill"><span>${m.label}</span><b>${m.v}</b></div>`)
                          .join("")}
                      </div>
                    `
                    : `<div class="dexMasterMist muted">（Masterの失敗内訳はまだありません）</div>`
                }
              </div>
              ${
                hasReading
                  ? `
                    <div class="dexInfo">
                      <div class="dexInfoRow">
                        <div class="dexInfoLabel">音</div>
                        <div class="dexInfoValue">${on || "—"}</div>
                      </div>
                      <div class="dexInfoRow">
                        <div class="dexInfoLabel">訓</div>
                        <div class="dexInfoValue">${kun || "—"}</div>
                      </div>
                    </div>
                  `
                  : `
                    <div class="dexInfo muted">（読みデータがまだありません）</div>
                  `
              }

              ${
                hasExample
                  ? `
                    <div class="dexExample">
                      <div class="dexExampleLabel">例文</div>
                      <div class="dexExampleText">${escapeHtml(ex)}</div>
                    </div>
                  `
                  : `
                    <div class="dexExample muted">（例文データがまだありません）</div>
                  `
              }

              <div class="dexActions">
                <button id="practice" class="btn primary big" type="button">この文字を練習する</button>
              </div>

              <div class="dexNav">
                <button id="prev" class="btn" type="button">まえ</button>
                <div class="dexIndex">${index + 1} / ${view.length}</div>
                <button id="next" class="btn" type="button">つぎ</button>
              </div>
            </div>
          </div>
        `;
      };

      const goBack = () => {
        if (ctx.from === "progress") nav.go("progress");
        else nav.go("home");
      };

      const onClick = (e) => {
        const t = e.target;

        if (t.closest("#back")) {
          goBack();
          return;
        }

        if (t.closest("#practice")) {
          const it = view[index];
          // ✅ その1文字だけ練習（クリア後に図鑑へ戻る）
          nav.go("game", {
                selectedRangeId: selected,
                singleId: it.id,
                returnTo: "dex",
                returnFrom: ctx.from ?? "progress",
              });
          return;
        }

        if (t.closest("#prev")) {
          index = Math.max(0, index - 1);
          render();
          return;
        }
        if (t.closest("#review")) {
                    nav.go("reviewStart", { selectedRangeId: selected, from: "dex" });
                    return;
                  }

        if (t.closest("#next")) {
          index = Math.min(view.length - 1, index + 1);
          render();
          return;
        }

        if (t.closest("#toggleUncleared")) {
          // フィルタ切替後も “今見ていたID” をなるべく維持
          const currentId = view[index]?.id;
          onlyUncleared = !onlyUncleared;
          buildView();
          setIndexById(currentId);
          clampIndex();
          render();
          return;
        }

        if (t.closest("#sortDefault")) {
          const currentId = view[index]?.id;
          sortMode = "default";
          buildView();
          setIndexById(currentId);
          clampIndex();
          render();
          return;
        }

        if (t.closest("#sortReview")) {
          const currentId = view[index]?.id;
          sortMode = "review";
          buildView();
          setIndexById(currentId);
          clampIndex();
          render();
          return;
        }
        if (t.closest("#sortMist")) {
                      const currentId = view[index]?.id;
                      sortMode = "mist";
                      buildView();
                      setIndexById(currentId);
                      clampIndex();
                      render();
                      return;
                    }
      };

      buildView();
      render();
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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
