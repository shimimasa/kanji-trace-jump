import { CONTENT_MANIFEST, groupByType } from "../data/contentManifest.js";

const TYPE_LABEL = {
  kanji: "漢字",
  hiragana: "ひらがな",
  katakana: "カタカナ",
  romaji: "ローマ字",
  alphabet: "アルファベット",
};

// 表示順（カテゴリの導線順に固定）
const TYPE_ORDER = ["hiragana", "katakana", "alphabet", "romaji", "kanji"];

export function RangeSelectScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen range";

      const grouped = groupByType(CONTENT_MANIFEST);
      const current = ctx.selectedRangeId ?? "kanji_g1";

      el.innerHTML = `
        <div class="card">
          <h1>範囲をえらぶ</h1>
          <div id="list"></div>
          <div style="margin-top:12px;">
            <button id="back" class="btn">もどる</button>
          </div>
        </div>
      `;

      const list = el.querySelector("#list");
      
      const types = TYPE_ORDER
        .filter((t) => Array.isArray(grouped[t]) && grouped[t].length > 0)
        .concat(Object.keys(grouped).filter((t) => !TYPE_ORDER.includes(t))); // 未知typeも末尾に出す

      list.innerHTML = types.map(type => {
        const items = [...(grouped[type] ?? [])]
          .sort((a, b) => String(a?.label ?? "").localeCompare(String(b?.label ?? ""), "ja"))
          .map(item => {
          const checked = item.id === current ? "checked" : "";
          return `
            <label class="row">
              <input type="radio" name="range" value="${item.id}" ${checked}/>
              <span>${item.label}</span>
            </label>
          `;
        }).join("");
        return `<div class="subcard"><h2>${TYPE_LABEL[type] ?? type}</h2>${items}</div>`;
      }).join("");

      const onChange = (e) => {
        const v = e.target?.value;
        if (!v) return;
        nav.ctx.selectedRangeId = v;
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
