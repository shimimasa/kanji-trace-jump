import "./style.css";

let data = null;
let idx = 0;

// Day2: 現在なぞるべき画（1-based）
let strokeIndex = 1;

// pointer tracking（形判定しないが、最低限の「触った」事実は取る）
let isTracing = false;
let activePointerId = null;
let activeTarget = null;

async function loadKanjiData() {
  const res = await fetch("/data/kanji_g1_min5.json");
  if (!res.ok) throw new Error("failed to load kanji data");
  return await res.json();
}

function el(tag, className, attrs = {}) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function svgEl(tag, attrs = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function starsText(doneCount, total) {
  const filled = "★".repeat(doneCount);
  const empty = "☆".repeat(Math.max(0, total - doneCount));
  return filled + empty;
}

function buildAppShell() {
  const app = document.querySelector("#app");
  app.innerHTML = "";

  const hud = el("header", "hud");
  hud.innerHTML = `
    <div id="stars" class="stars">${starsText(0, 5)}</div>
    <div class="goal">もくひょう：5もじ</div>
  `;

  const stage = el("section", "stage");

  const info = el("div", "smallInfo");
  info.id = "smallInfo";
  info.textContent = "";

  const wrap = el("div", "svgWrap");
  wrap.id = "svgWrap";

  const ground = el("div", "ground");
  ground.innerHTML = `
    <div class="platform"></div>
    <div id="chara" class="chara">●</div>
  `;

  const controls = el("footer", "controls");
  controls.innerHTML = `
    <button id="prevBtn">まえ</button>
    <button id="nextBtn">つぎ</button>
  `;

  stage.appendChild(info);
  stage.appendChild(wrap);
  stage.appendChild(ground);

  app.appendChild(hud);
  app.appendChild(stage);
  app.appendChild(controls);
}

function cleanupTraceState() {
  isTracing = false;
  activePointerId = null;
  activeTarget = null;
}

function pulseChara() {
  const chara = document.getElementById("chara");
  if (!chara) return;
  chara.animate(
    [
      { transform: "translateY(20px) scale(1)" },
      { transform: "translateY(8px) scale(1.02)" },
      { transform: "translateY(20px) scale(1)" }
    ],
    { duration: 280, iterations: 1 }
  );
}

function bounceStage() {
  const wrap = document.getElementById("svgWrap");
  if (!wrap) return;
  wrap.classList.remove("tracePulse");
  // reflow
  void wrap.offsetWidth;
  wrap.classList.add("tracePulse");
}

function onKanjiComplete() {
  // Day2: クリア演出（最小）
  const info = document.getElementById("smallInfo");
  if (info) info.textContent += " できた！";

  // ちょい派手ジャンプ
  const chara = document.getElementById("chara");
  if (chara) {
    chara.animate(
      [
        { transform: "translateY(20px) scale(1)" },
        { transform: "translateY(-10px) scale(1.05)" },
        { transform: "translateY(20px) scale(1)" }
      ],
      { duration: 420, iterations: 1 }
    );
  }
}

function formatStrokeNums(count) {
  const nums = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
  return nums.slice(0, count).join(" ");
}

function renderCurrentKanji() {
  cleanupTraceState();

  const wrap = document.getElementById("svgWrap");
  const info = document.getElementById("smallInfo");
  const item = data.items[idx];

  // ステージ切り替え時は1画目から
  strokeIndex = 1;

  info.textContent = `${item.kanji}（${idx + 1} / ${data.items.length}）  ${formatStrokeNums(item.strokes.length)}`;

  wrap.innerHTML = "";

    // --- viewBoxをストロークから自動計算（座標系ズレ対策） ---
    const tmpSvg = svgEl("svg", { viewBox: "0 0 10 10" });
    // 一瞬DOMに入れないと getBBox が取れない環境があるのでラッパに仮挿入
    wrap.appendChild(tmpSvg);
  
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
    item.strokes.forEach((s) => {
      const p = svgEl("path", { d: s.d });
      tmpSvg.appendChild(p);
      try {
        const b = p.getBBox();
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      } catch (_) {
        // getBBoxが取れない場合は後でフォールバック
      }
      p.remove();
    });
  
    tmpSvg.remove();
  
    // フォールバック（BBox取れなかった場合）
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      minX = 0; minY = 0; maxX = 100; maxY = 100;
    }
  
    // 余白（線の太さ分）
    const pad = 12;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  
    const vb = `${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`;
  
    const svg = svgEl("svg", {
      viewBox: vb,
      "aria-label": `kanji ${item.kanji}`,
      preserveAspectRatio: "xMidYMid meet"
    });
  

  // 1) 見た目：薄い全ストローク
  item.strokes.forEach((s) => {
    svg.appendChild(svgEl("path", { d: s.d, class: "strokeBase" }));
  });

  // 2) 見た目：現在の線を濃く
  const active = item.strokes.find((s) => s.index === strokeIndex);
  if (active) {
    svg.appendChild(svgEl("path", { d: active.d, class: "strokeActive", "data-active": "1" }));
  }

  // 3) 当たり判定：透明ストローク（各線）
  //    ただし、イベント側で strokeIndex を見て弾く
  item.strokes.forEach((s) => {
    const hit = svgEl("path", {
      d: s.d,
      class: "strokeHit",
      "data-index": String(s.index)
    });

    // pointer events（タブレット向け）
    hit.addEventListener("pointerdown", (e) => handlePointerDown(e, item));
    hit.addEventListener("pointermove", (e) => handlePointerMove(e, item));
    hit.addEventListener("pointerup", (e) => handlePointerUp(e, item));
    hit.addEventListener("pointercancel", () => cleanupTraceState());
    hit.addEventListener("pointerleave", (e) => handlePointerLeave(e, item));

    svg.appendChild(hit);
  });

  wrap.appendChild(svg);
}

function handlePointerDown(e, item) {
  // 触って良いのは「今の線」だけ
  const idxTouched = Number(e.target.dataset.index);
  if (idxTouched !== strokeIndex) return;

  // 2本指などを避ける：最初のpointerだけ追う
  if (activePointerId !== null) return;

  isTracing = true;
  activePointerId = e.pointerId;
  activeTarget = e.target;

  try {
    // pointer captureでタッチが外れても追える
    activeTarget.setPointerCapture(activePointerId);
  } catch (_) {}

  // “触れた”フィードバック（最小）
  bounceStage();
}

function handlePointerMove(e, _item) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;
  // Day2: 形判定なし。moveは「触ってる」維持のためだけ。
}

function handlePointerLeave(e, _item) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;
  // 指が外れても即失敗にしない（優しさ）
  // ただし pointerup が来ない端末もあるので、ここでは何もしない。
}

function handlePointerUp(e, item) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;

  const idxTouched = Number(e.target.dataset.index);
  // 念のため：今の線以外なら無効
  if (idxTouched !== strokeIndex) {
    cleanupTraceState();
    return;
  }

  // 成功：次の線へ
  cleanupTraceState();
  pulseChara();

  strokeIndex += 1;

  // 全部終わった？
  if (strokeIndex > item.strokes.length) {
    onKanjiComplete();
    // Day2は自動で次へ進めない（子どもが達成感を味わう時間）
    // ここで「つぎ」を押してもらう設計
    return;
  }

  // 次の線を濃くするため再描画
  renderActiveOnly(item);
}

function renderActiveOnly(item) {
  // 既存SVGの中で「濃い線」を差し替える（全部描き直さず軽量）
  const wrap = document.getElementById("svgWrap");
  const svg = wrap.querySelector("svg");
  if (!svg) return;

  // 古いactiveを削除
  const oldActive = svg.querySelector('path[data-active="1"]');
  if (oldActive) oldActive.remove();

  // 新しいactiveを追加（見た目層の後ろ、hitの前に入れたい）
  const next = item.strokes.find((s) => s.index === strokeIndex);
  if (!next) return;

  const activePath = svgEl("path", { d: next.d, class: "strokeActive", "data-active": "1" });

  // 追加位置：strokeBase群の後、strokeHit群の前
  // hitの最初の要素を見つけて、その手前にinsert
  const firstHit = svg.querySelector(".strokeHit");
  if (firstHit) {
    svg.insertBefore(activePath, firstHit);
  } else {
    svg.appendChild(activePath);
  }

  bounceStage();
}

function bindControls() {
  document.getElementById("prevBtn").addEventListener("click", () => {
    idx = clamp(idx - 1, 0, data.items.length - 1);
    renderCurrentKanji();
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    idx = clamp(idx + 1, 0, data.items.length - 1);
    renderCurrentKanji();
  });
}

async function boot() {
  buildAppShell();
  data = await loadKanjiData();
  bindControls();
  renderCurrentKanji();
}

boot().catch((e) => {
  console.error(e);
  alert("データの読みこみにしっぱいしました");
});
