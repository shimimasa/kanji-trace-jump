import "./style.css";

let data = null;
let idx = 0;

// 今なぞるべき画（1-based）
let strokeIndex = 1;

// pointer tracking
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

function formatStrokeNums(count) {
  const nums = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
  return nums.slice(0, count).join(" ");
}

function getStrokeD(s) {
  return s?.d || s?.path || s?.svgPath || s?.svg || s?.data || "";
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
  void wrap.offsetWidth;
  wrap.classList.add("tracePulse");
}

function onKanjiComplete() {
  const info = document.getElementById("smallInfo");
  if (info) info.textContent += " できた！";

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

function renderCurrentKanji() {
  cleanupTraceState();

  const wrap = document.getElementById("svgWrap");
  const info = document.getElementById("smallInfo");
  const item = data.items[idx];

  strokeIndex = 1;

  info.textContent = `${item.kanji}（${idx + 1} / ${data.items.length}）  ${formatStrokeNums(item.strokes.length)}`;

  wrap.innerHTML = "";

  const hasAnyPath = item.strokes.some((s) => !!getStrokeD(s));
  if (!hasAnyPath) {
    wrap.textContent = "SVGデータが見つかりません（jsonのstrokesに d を入れてください）";
    return;
  }

  const svg = svgEl("svg", {
    viewBox: "0 0 100 100",
    preserveAspectRatio: "xMidYMid meet",
    "aria-label": `kanji ${item.kanji}`
  });

  // 1) 薄い全ストローク
  item.strokes.forEach((s) => {
    const d = getStrokeD(s);
    if (!d) return;
    svg.appendChild(svgEl("path", { d, class: "strokeBase" }));
  });

  // 2) 今の線を濃く
  const next = item.strokes.find((s) => s.index === strokeIndex);
  if (next) {
    const d = getStrokeD(next);
    if (d) svg.appendChild(svgEl("path", { d, class: "strokeActive", "data-active": "1" }));
  }

  // 3) 当たり判定（透明）
  item.strokes.forEach((s) => {
    const d = getStrokeD(s);
    if (!d) return;

    const hit = svgEl("path", {
      d,
      class: "strokeHit",
      "data-index": String(s.index)
    });

    hit.addEventListener("pointerdown", (e) => handlePointerDown(e, item));
    hit.addEventListener("pointermove", (e) => handlePointerMove(e, item));
    hit.addEventListener("pointerup", (e) => handlePointerUp(e, item));
    hit.addEventListener("pointercancel", () => cleanupTraceState());
    hit.addEventListener("pointerleave", (e) => handlePointerLeave(e, item));

    svg.appendChild(hit);
  });

  wrap.appendChild(svg);
}

function renderActiveOnly(item) {
  const wrap = document.getElementById("svgWrap");
  const svg = wrap.querySelector("svg");
  if (!svg) return;

  const oldActive = svg.querySelector('path[data-active="1"]');
  if (oldActive) oldActive.remove();

  const next = item.strokes.find((s) => s.index === strokeIndex);
  if (!next) return;

  const d = getStrokeD(next);
  if (!d) return;

  const activePath = svgEl("path", { d, class: "strokeActive", "data-active": "1" });

  const firstHit = svg.querySelector(".strokeHit");
  if (firstHit) svg.insertBefore(activePath, firstHit);
  else svg.appendChild(activePath);

  bounceStage();
}

function handlePointerDown(e, item) {
  const idxTouched = Number(e.target.dataset.index);
  if (idxTouched !== strokeIndex) return;

  if (activePointerId !== null) return;

  isTracing = true;
  activePointerId = e.pointerId;
  activeTarget = e.target;

  try {
    activeTarget.setPointerCapture(activePointerId);
  } catch (_) {}

  bounceStage();
}

function handlePointerMove(e, _item) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;
}

function handlePointerLeave(e, _item) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;
}

function handlePointerUp(e, item) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;

  const idxTouched = Number(e.target.dataset.index);
  if (idxTouched !== strokeIndex) {
    cleanupTraceState();
    return;
  }

  cleanupTraceState();
  pulseChara();

  strokeIndex += 1;

  if (strokeIndex > item.strokes.length) {
    onKanjiComplete();
    return;
  }

  renderActiveOnly(item);
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
