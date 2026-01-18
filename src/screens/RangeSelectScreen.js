import { CONTENT_MANIFEST, groupByType } from "../data/contentManifest.js";

const TYPE_LABEL = {
  kanji: "漢字",
  hiragana: "ひらがな",
  katakana: "カタカナ",
  alphabet: "アルファベット",
};

// 表示順（カテゴリの導線順に固定）
const TYPE_ORDER = ["hiragana", "katakana", "alphabet", "kanji"];

// タイル（チップ）用の短縮ラベル
function compactLabel(item) {
  const label = String(item?.label ?? "");
  const type = item?.type;

  // まず「（...）」があれば中身を抽出
  const m = label.match(/（([^）]+)）/);
  const inner = m ? m[1].trim() : "";

  // ひらがな/カタカナ：あ行/か行…、小さい つゃゅょ 等は中身だけ
  if (type === "hiragana" || type === "katakana") {
    if (!inner) return label;
    // 「小さい つゃゅょ」→「小つゃゅょ」みたいに少し圧縮
    return inner
      .replace(/^小さい\s*/g, "小")
      .replace(/\s+/g, "");
  }

  // アルファベット：小文字/大文字
  if (type === "alphabet") {
    if (inner) return inner.replace(/\s+/g, "");
    // 念のため括弧がない場合も短縮
    if (label.includes("小文字")) return "小文字";
    if (label.includes("大文字")) return "大文字";
    return label;
  }

  // 漢字：小1/小2… 中1… 高校/常用拡張 など → 括弧の中身を優先
  if (type === "kanji") {
    if (inner) return inner.replace(/\s+/g, "");
    return label.replace(/^漢字\s*/g, "").trim();
  }

  // その他：括弧があれば中身、なければ元のlabel
  return inner || label;
}
export function RangeSelectScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen range";

      const grouped = groupByType(CONTENT_MANIFEST);
      const current = ctx.selectedRangeId ?? "kanji_g1";
      const currentItem = CONTENT_MANIFEST.find(x => x.id === current);

      el.innerHTML = `
        <div class="card rangeCard">
          <div class="rangeHeader">
            <h1 class="rangeTitle">範囲をえらぶ</h1>
            <div class="rangeNow">
              <div class="muted rangeNowLabel">いまの範囲</div>
              <div class="rangeNowValue">${currentItem?.label ?? "未選択"}</div>
            </div>
          </div>

          <div id="list" class="rangeList"></div>

          <div class="rangeFooter">
            <button id="back" class="btn">もどる</button>
          </div>
        </div>
      `;

      const list = el.querySelector("#list");
      
      const types = TYPE_ORDER
        .filter((t) => Array.isArray(grouped[t]) && grouped[t].length > 0)
        .concat(Object.keys(grouped).filter((t) => !TYPE_ORDER.includes(t))); // 未知typeも末尾に出す

       // 現在選択中のtypeを自動で開く
      const currentType = (CONTENT_MANIFEST.find(x => x.id === current)?.type) ?? null;

      list.innerHTML = types.map(type => {
        const items = [...(grouped[type] ?? [])]
          .sort((a, b) => String(a?.label ?? "").localeCompare(String(b?.label ?? ""), "ja"))
          .map(item => {
            const checked = item.id === current ? "checked" : "";
            const chipText = compactLabel(item);
            return `
              <label class="rangeItem" data-range-item>
                <input class="rangeRadio" type="radio" name="range" value="${item.id}" ${checked}/>
                <span class="rangeChip" title="${item.label}">${chipText}</span>
              </label>
            `;
          }).join("");

        const openAttr = (type === currentType) ? "open" : "";
        return `
          <details class="rangeGroup" ${openAttr}>
            <summary class="rangeGroupHead">
              <span class="rangeGroupTitle">${TYPE_LABEL[type] ?? type}</span>
              <span class="rangeGroupHint" aria-hidden="true">▶</span>
            </summary>
            <div class="rangeGrid">${items}</div>
          </details>
        `;
      }).join("");

      // ✅ Accordion: 同時に開けるのは1つだけ（縦伸び防止）
      const onToggle = (e) => {
        const target = e.target;
                // toggle は details から飛んでくる想定
                if (!target || target.tagName !== "DETAILS") return;
                if (!target.classList.contains("rangeGroup")) return;
        
                // 開いた時だけ、他を閉じる
                if (target.open) {
                  const all = el.querySelectorAll("details.rangeGroup");
                  all.forEach((d) => {
                    if (d !== target) d.open = false;
                  });
                }
              };

      const onChange = (e) => {
        const v = e.target?.value;
        if (!v) return;
        nav.ctx.selectedRangeId = v;

        // 画面上部の「いまの範囲」を即更新（体感が良くなる）
        const picked = CONTENT_MANIFEST.find(x => x.id === v);
        const now = el.querySelector(".rangeNowValue");
        if (now) now.textContent = picked?.label ?? v;
      };
      const onBack = () => nav.go("home");

      el.addEventListener("change", onChange);
      // ✅ toggle はバブリングしないことがあるため capture で拾う
      el.addEventListener("toggle", onToggle, true);
      el.querySelector("#back").addEventListener("click", onBack);

      return {
        el,
        cleanup() {
          el.removeEventListener("change", onChange);
          el.removeEventListener("toggle", onToggle, true);
          el.querySelector("#back").removeEventListener("click", onBack);
        }
      };
    }
  };
}
