let data = null;
let idx = 0;

async function loadData() {
  const res = await fetch("./data/kanji_g1_min5.json");
  if (!res.ok) throw new Error("failed to load kanji data");
  return await res.json();
}

function formatStrokeRow(strokesCount) {
  const nums = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
  return nums.slice(0, strokesCount).join(" ");
}

function render() {
  const item = data.items[idx];
  document.getElementById("kanji").textContent = item.kanji;
  document.getElementById("strokeRow").textContent = formatStrokeRow(item.strokesCount);

  // Day1: ぷかぷか演出（超軽量）
  const chara = document.getElementById("chara");
  chara.animate(
    [{ transform: "translateY(18px)" }, { transform: "translateY(8px)" }, { transform: "translateY(18px)" }],
    { duration: 900, iterations: 1 }
  );
}

function clampIndex(n) {
  return Math.max(0, Math.min(data.items.length - 1, n));
}

async function boot() {
  data = await loadData();
  render();

  document.getElementById("prevBtn").addEventListener("click", () => {
    idx = clampIndex(idx - 1);
    render();
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    idx = clampIndex(idx + 1);
    render();
  });
}

boot().catch((e) => {
  console.error(e);
  alert("データの読みこみにしっぱいしました");
});
