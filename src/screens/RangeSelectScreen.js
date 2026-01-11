import { CONTENT_MANIFEST, groupByType } from "../data/contentManifest.js";

export function RangeSelectScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen range";

      const grouped = groupByType(CONTENT_MANIFEST);
      const types = Object.keys(grouped);

      el.innerHTML = `
        <h1>範囲をえらぶ</h1>
        <div id="list"></div>
        <button id="back">もどる</button>
      `;

      const list = el.querySelector("#list");
      list.innerHTML = types.map(type => {
        const items = grouped[type]
          .map(item => {
            const checked = (ctx.selectedRangeId ?? "kanji_g1") === item.id ? "checked" : "";
            return `
              <label class="row">
                <input type="radio" name="range" value="${item.id}" ${checked} />
                <span>${item.label}</span>
              </label>
            `;
          }).join("");
        const title =
          type === "kanji" ? "漢字" :
          type === "hiragana" ? "ひらがな" :
          type === "katakana" ? "カタカナ" :
          type === "romaji" ? "ローマ字" :
          type === "alphabet" ? "アルファベット" : type;

        return `<div class="card"><h2>${title}</h2>${items}</div>`;
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
