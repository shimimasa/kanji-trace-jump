// src/screens/DexScreen.js
import { isCleared, getWeakScore } from "../lib/progressStore.js";
import { makeProgressKey } from "../lib/progressKey.js";
import { loadRangeItems } from "../lib/rangeItems.js";
import { KANA_EXAMPLES } from "../../public/data/examples/kanaExamples.js";
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

function pickCharForDex(it) {
    return it?.char ?? it?.text ?? it?.kana ?? it?.kanji ?? it?.letter ?? it?.symbol ?? "";
  }
  
  function isSmallKanaChar(ch) {
    return ["ぁ","ぃ","ぅ","ぇ","ぉ","ゃ","ゅ","ょ","っ","ゎ","ァ","ィ","ゥ","ェ","ォ","ャ","ュ","ョ","ッ","ヮ","ー"].includes(ch);
  }
  
  // Dex用：exampleが無い時だけ、かなの「ことば（例）」を補完
  function getExampleWithFallback(type, it) {
    const raw = getExample(it);
    if (raw) return raw;
  
    // かなだけ補完（拗音/促音/長音など小書きは触らない）
    if (type !== "hiragana" && type !== "katakana") return "";
  
    const ch = pickCharForDex(it);
    if (!ch) return "";
    if (isSmallKanaChar(ch)) return ""; // 方針：小書き/長音はストップ
  
    return KANA_EXAMPLES[ch] ?? "";
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

  function getExampleBlockMeta(type) {
      // Dexの「例」欄の見え方を type ごとに最適化
      switch (type) {
        case "alphabet":
          return { label: "例（単語）", empty: "（例の単語データがまだありません）" };
        case "hiragana":
        case "katakana":
        case "romaji":
          return { label: "ことば（例）", empty: "（ことば（例）のデータがまだありません）" };
        case "kanji":
        default:
          return { label: "例文", empty: "（例文データがまだありません）" };
      }
    }

// ============================
// Dex tags & notices (type-safe, no yoon/sokuon synthesis)
// ============================

function pickChar(it) {
  return it?.char ?? it?.text ?? it?.kana ?? it?.kanji ?? it?.letter ?? it?.symbol ?? "";
}

function isSmallKana(ch) {
  return ["ぁ","ぃ","ぅ","ぇ","ぉ","ゃ","ゅ","ょ","っ","ゎ","ァ","ィ","ゥ","ェ","ォ","ャ","ュ","ョ","ッ","ヮ"].includes(ch);
}

function isYoonSmall(ch) {
  return ["ゃ","ゅ","ょ","ャ","ュ","ョ"].includes(ch);
}

function isSokuonSmall(ch) {
  return ["っ","ッ"].includes(ch);
}

function isDakutenKana(ch) {
  return ["が","ぎ","ぐ","げ","ご","ざ","じ","ず","ぜ","ぞ","だ","ぢ","づ","で","ど","ば","び","ぶ","べ","ぼ","ガ","ギ","グ","ゲ","ゴ","ザ","ジ","ズ","ゼ","ゾ","ダ","ヂ","ヅ","デ","ド","バ","ビ","ブ","ベ","ボ","ヴ"].includes(ch);
}

function isHandakutenKana(ch) {
  return ["ぱ","ぴ","ぷ","ぺ","ぽ","パ","ピ","プ","ペ","ポ"].includes(ch);
}

function isChoOn(ch) {
  return ch === "ー";
}

function getAlphabetCaseTag(letter) {
  if (!letter || typeof letter !== "string") return null;
  const c = letter;
  if (c.toUpperCase() === c && c.toLowerCase() !== c) return "大文字";
  if (c.toLowerCase() === c && c.toUpperCase() !== c) return "小文字";
  return null;
}

function buildDexTags({ type, rangeId, it }) {
  const tags = [];

  // 1) type tag (optional)
  // tags.push(getTypeLabel(type));

  // 2) range-based tags (safe & deterministic)
  if (type === "hiragana" || type === "katakana") {
    const rid = String(rangeId || "");
    if (rid.includes("small")) tags.push("小書き");
    if (rid.includes("dakuten")) tags.push("濁点");
    if (rid.includes("handakuten")) tags.push("半濁点");
    if (rid.includes("_row_")) tags.push("基本");
  }
  if (type === "alphabet") {
    const rid = String(rangeId || "");
    if (rid.includes("upper")) tags.push("大文字");
    if (rid.includes("lower")) tags.push("小文字");
  }

  // 3) char-based tags (fallback / extra)
  const ch = pickChar(it);
  if (type === "hiragana" || type === "katakana") {
    if (isSmallKana(ch) && !tags.includes("小書き")) tags.push("小書き");
    if (isDakutenKana(ch) && !tags.includes("濁点")) tags.push("濁点");
    if (isHandakutenKana(ch) && !tags.includes("半濁点")) tags.push("半濁点");
    if (isChoOn(ch) && !tags.includes("長音")) tags.push("長音");
  }
  if (type === "alphabet") {
    const ctag = getAlphabetCaseTag(ch);
    if (ctag && !tags.includes(ctag)) tags.push(ctag);
  }

  // keep stable order
  const order = ["基本","濁点","半濁点","小書き","長音","大文字","小文字"];
  tags.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return tags;
}

function buildDexNotices({ type, rangeId, it }) {
  const notices = [];
  const ch = pickChar(it);

  if (type === "hiragana" || type === "katakana") {
    if (isYoonSmall(ch)) {
      notices.push("小さい「ゃ・ゅ・ょ」は、前の文字とくっついて音が変わるよ（例：き＋ゃ＝きゃ）。");
    }
    if (isSokuonSmall(ch)) {
      notices.push("小さい「っ」は、つぎの音がつまるよ（例：がっこう の「っ」）。");
    }
    if (isChoOn(ch)) {
      notices.push("「ー」は、前の音をのばす記号だよ（例：ケーキ の「ー」）。");
    }
    // rangeId-based reminder (even if char is not small itself)
    const rid = String(rangeId || "");
    if (rid.includes("small") && !isSmallKana(ch)) {
      notices.push("この範囲は「小書き」の文字だよ。前の文字と組み合わせることが多いよ。");
    }
  }

  if (type === "alphabet") {
    const rid = String(rangeId || "");
    if (rid.includes("upper")) notices.push("大文字の形をおぼえよう。教科書や見出しでよく使うよ。");
    if (rid.includes("lower")) notices.push("小文字の形をおぼえよう。英単語の中でよく使うよ。");
  }

  return notices;
}


export function DexScreen(ctx, nav) {
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
        
        const ex = getExampleWithFallback(type, it);
        const info = buildDexInfo(type, it);
        const hasInfo = Array.isArray(info.rows) && info.rows.length > 0;
        const hasExample = !!ex;
        const typeLabel = getTypeLabel(type);
        const exMeta = getExampleBlockMeta(type);
        const tags = buildDexTags({ type, rangeId: range?.id, it });
        const notices = buildDexNotices({ type, rangeId: range?.id, it });
        const showMaster = type === "kanji";

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
              ${
                                tags.length
                                  ? `
                                    <div class="dexTags">
                                      ${tags.map((t) => `<span class="dexTag">${escapeHtml(t)}</span>`).join("")}
                                    </div>
                                  `
                                  : ""
                              }
              <div class="dexMiniStats muted" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <span>挑戦 <b>${attempts}</b></span>
                <span>失敗 <b>${fails}</b></span>
                ${accuracy == null ? "" : `<span>正答率 <b>${accuracy}%</b></span>`}
              </div>
              ${
                showMaster
                  ? `
                    <div class="dexMasterBox">
                      <div class="dexMasterHead">
                        <div class="dexMasterTitle">MASTER</div>
                        ${masterOk ? `<div class="dexMasterBadge ok">✓</div>` : `<div class="dexMasterBadge">—</div>`}
                      </div>
                      <div class="dexMasterRow">
                        <div class="dexMasterStat"><span>挑戦</span><b>${masterAttempts}</b></div>
                        <div class="dexMasterStat"><span>合格</span><b>${masterPasses}</b></div>
                      </div>
                      <div class="dexMasterReason muted">
                        ${
                          masterAttempts > 0
                            ? `（順番× ${mm.WRONG_ORDER ?? 0} / 線× ${mm.BAD_SHAPE ?? 0} / 短× ${mm.TOO_SHORT ?? 0} / 始× ${mm.START_OFF ?? 0} / 外× ${mm.FAR_FROM_STROKE ?? 0}）`
                            : `（Masterの失敗内訳はまだありません）`
                        }
                      </div>
                    </div>
                  `
                  : ""
              }
              ${
                hasInfo
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
                                notices.length
                                  ? `
                                    <div class="dexNotice">
                                      <div class="dexNoticeTitle">⚠ ここに注意</div>
                                      <ul class="dexNoticeList">
                                        ${notices.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
                                      </ul>
                                    </div>
                                  `
                                  : ""
                              }
              ${
                hasExample
                  ? `
                    <div class="dexExample">
                      <div class="dexExampleLabel">${escapeHtml(exMeta.label)}</div>
                      <div class="dexExampleText">${escapeHtml(ex)}</div>
                    </div>
                  `
                  : `
                    <div class="dexExample muted">${escapeHtml(exMeta.empty)}</div>
                  `
              }

              <div class="dexActions">
                <button class="btn primary bigBtn" data-action="practice" type="button">この文字を練習する</button>
                ${
                  showMaster
                    ? `<button class="btn bigBtn" data-action="master" type="button">MASTERで練習</button>`
                    : ``
                }
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

        if (t.closest('[data-action="practice"]')) {
          const it = view[index];
          // ✅ その1文字だけ練習（クリア後に図鑑へ戻る）
          nav.go("game", {
                selectedRangeId: selected,
                singleId: it.id,
                mode: "kid",
                returnTo: "dex",
                returnFrom: ctx.from ?? "progress",
              });
          return;
        }

         // ✅ 図鑑から Master モードで single 練習
        if (t.closest('[data-action="master"]')) {
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
