// src/screens/KanjiDexScreen.js
import { isCleared, getWeakScore } from "../lib/progressStore.js";
import { makeProgressKey } from "../lib/progressKey.js";
import { loadRangeItems } from "../lib/rangeItems.js";

function makeItemId(type, itemId) {
    return makeProgressKey(type, itemId);
  }

function getLabel(it) {
  return it?.label ?? it?.kanji ?? it?.kana ?? it?.char ?? it?.text ?? it?.id ?? "？";
}

function getTypeLabel(type) {
    switch (type) {
      case "hiragana": return "ひらがな";
      case "katakana": return "カタカナ";
      case "alphabet": return "アルファベット";
      case "romaji": return "ローマ字";
      case "kanji":
      default: return "漢字";
    }
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

function getRomaji(it) {
    return it?.romaji ?? it?.hepburn ?? it?.roman ?? it?.reading ?? it?.pronunciation ?? "";
  }
  
  function getTip(it) {
    return it?.tip ?? it?.tips ?? it?.note ?? it?.memo ?? it?.hint ?? "";
  }
  
  function getAlphabetNameJp(it) {
    // 例: "エー", "ビー" など。データが増えたら拾えるよう候補を広めに
    return it?.nameJp ?? it?.jpName ?? it?.nameJP ?? it?.yomi ?? it?.pronounce ?? it?.kana ?? "";
  }
  
  function getAlphabetWord(it) {
    // 例: "A = apple" など
    return it?.word ?? it?.exampleWord ?? it?.example ?? it?.ex ?? "";
  }
  
  function buildDexInfo(type, it) {
    const rows = [];
  
    if (type === "kanji") {
      const on = getReadingOn(it);
      const kun = getReadingKun(it);
      if (on || kun) {
        rows.push({ label: "音", value: on || "—" });
        rows.push({ label: "訓", value: kun || "—" });
      }
      return { rows, extra: null, emptyText: "（読みデータがまだありません）" };
    }
  
    if (type === "hiragana" || type === "katakana" || type === "romaji") {
      const romaji = getRomaji(it);
      const tip = getTip(it);
      if (romaji) rows.push({ label: "ローマ字", value: romaji });
      if (tip) rows.push({ label: "ポイント", value: tip });
      return { rows, extra: null, emptyText: "（ローマ字/ポイントがまだありません）" };
    }
  
    if (type === "alphabet") {
      const nameJp = getAlphabetNameJp(it);
      const word = getAlphabetWord(it);
      if (nameJp) rows.push({ label: "よみ", value: nameJp });
      if (word) rows.push({ label: "ことば", value: word });
      return { rows, extra: null, emptyText: "（読み/ことばのデータがまだありません）" };
    }
  
    return { rows: [], extra: null, emptyText: "（情報がまだありません）" };
  }

export function KanjiDexScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen dex";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
      // ✅ rangeの母数をゲームと一致させる（行セット/学年/traceable）
      const { range, type, items } = await loadRangeItems(selected);

      // --- Dex state ---
      let onlyUncleared = false; // 未クリアだけ
      let sortMode = "default";  // "default" | "review" | "mist"
      let view = [];             // フィルタ/ソート後の配列
      let index = 0;

      const getLastAt = (it) => {
        // 復習ソート用：最後にクリアした時刻（なければ0）
        const key = makeItemId(type, it.id)
;
        return ctx.progress?.cleared?.[key]?.clearedAt ?? 0;
      };

      const getMistScore = (it) => {
                const key = makeItemId(type, it.id)
;
                return getWeakScore(ctx.progress, key);
              };

      const buildView = () => {
        let arr = items.slice();

        if (onlyUncleared) {
          arr = arr.filter((it) => !isCleared(ctx.progress, makeItemId(type, it.id)
));
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

        const cleared = isCleared(ctx.progress, makeItemId(type, it.id)
);
        
        const pKey = makeItemId(type, it.id)
;
        const pItem = ctx.progress?.items?.[pKey] ?? null;
        const attempts = pItem?.attempts ?? 0;
        const fails = pItem?.fails ?? 0;
        const accuracy = attempts > 0 ? Math.max(0, Math.min(100, Math.round(((attempts - fails) / attempts) * 100))) : null;

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
        
        const ex = getExample(it);
        const info = buildDexInfo(type, it);
        const hasInfo = Array.isArray(info.rows) && info.rows.length > 0;
        const hasExample = !!ex;
        const typeLabel = getTypeLabel(type);

        el.innerHTML = `
          <div class="dexBoard">
            <div class="dexHead">
              <div>
                <div class="dexTitle">図鑑</div>
                <div class="dexMeta">範囲：<b>${range?.label ?? "未選択"}</b> <span class="muted">/ ${typeLabel}</span></div>
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
              <div class="dexMiniStats muted" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <span>挑戦 <b>${attempts}</b></span>
                <span>失敗 <b>${fails}</b></span>
                ${accuracy == null ? "" : `<span>正答率 <b>${accuracy}%</b></span>`}
              </div>
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
                hasinfo
                  ? `
                    <div class="dexInfo">
                      ${info.rows
                        .map(
                          (r) => `
                            <div class="dexInfoRow">
                              <div class="dexInfoLabel">${escapeHtml(r.label)}</div>
                              <div class="dexInfoValue">${escapeHtml(r.value)}</div>
                            </div>
                          `
                        )
                        .join("")}
                    </div>
                  `
                  : `
                    <div class="dexInfo muted">${escapeHtml(info.emptyText || "（情報がまだありません）")}</div>
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
                <button id="practiceMaster" class="btn big" type="button">MASTERで練習</button>
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

         // ✅ 図鑑から Master モードで single 練習
        if (t.closest("#practiceMaster")) {
            const it = view[index];
            nav.go("game", {
              selectedRangeId: selected,
              singleId: it.id,
              mode: "master",
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
