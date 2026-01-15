import { CONTENT_MANIFEST, groupByType } from "../data/contentManifest.js";

const TYPE_LABEL = {
  kanji: "漢字",
  hiragana: "ひらがな",
  katakana: "カタカナ",
  alphabet: "アルファベット",
};

// 表示順（カテゴリの導線順に固定）
const TYPE_ORDER = ["hiragana", "katakana", "alphabet", "kanji"];

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
            return `
              <label class="rangeItem" data-range-item>
                <input class="rangeRadio" type="radio" name="range" value="${item.id}" ${checked}/>
                <span class="rangeChip">${item.label}</span>
              </label>
            `;
          }).join("");

        const openAttr = (type === currentType) ? "open" : "";
        return `
          <details class="rangeGroup" ${openAttr}>
            <summary class="rangeGroupHead">
              <span class="rangeGroupTitle">${TYPE_LABEL[type] ?? type}</span>
              <span class="rangeGroupHint muted">タップしてひらく</span>
            </summary>
            <div class="rangeGrid">${items}</div>
          </details>
        `;
      }).join("");

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
      el.querySelector("#back").addEventListener("click", onBack);

      return {
        el,
        cleanup() {
          el.removeEventListener("change", onChange);
          el.querySelector("#back").removeEventListener("click", onBack);
        }
      };
    }
  };
}
