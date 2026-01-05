import "./style.css";

/**
 * Day2 目標
 * - “タップだけで成功”を禁止し、一定距離をなぞった場合のみ成功にする
 * - iPad/スマホでスクロール等が邪魔しないように touch-action を整える（CSS側）
 */

const DATA_URL = "/kanji_g1_min5.json";

// -------------------- state --------------------
let items = [];
let idx = 0;

let current = null; // { kanji, strokes:[{ svg, strokeKey? }], ... }

let strokeIndex = 0;

let isTracing = false;
let activePointerId = null;
let activeTarget = null;

let traceStartX = 0;
let traceStartY = 0;
let traceLastX = 0;
let traceLastY = 0;
let traceDist = 0;
let traceStartT = 0;

// 「タップだけ」で進んでしまうのを防ぐ（iPad指なぞり想定）
const MIN_TRACE_DIST = 24; // px
const MIN_TRACE_TIME = 120; // ms

// -------------------- dom --------------------
const app = document.querySelector("#app");

// UI build
function buildAppShell() {
  app.innerHTML = `
    <div class="hud">
      <div class="stars" id="stars">☆☆☆☆☆</div>
      <div class="goal" id="goal">もくひょう：5もじ</div>
    </div>

    <div class="center">
      <div class="titleRow">
        <div class="kanjiTitle" id="kanjiTitle">—</div>
      </div>

      <div class="svgWrap" id="svgWrap"></div>

      <div class="controls">
        <button class="btn" id="prevBtn">まえ</button>
        <button class="btn" id="nextBtn">つぎ</button>
      </div>
    </div>
  `;

  document.querySelector("#prevBtn").addEventListener("click", () => {
    idx = Math.max(0, idx - 1);
    loadCurrent();
  });
  document.querySelector("#nextBtn").addEventListener("click", () => {
    idx = Math.min(items.length - 1, idx + 1);
    loadCurrent();
  });
}

// -------------------- load --------------------
async function loadData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: ${res.status}`);
  const json = await res.json();
  // 想定: [{kanji, strokes:[{svg:{viewBox,width,height,paths:[]}, strokeKey?}], ...}]
  items = Array.isArray(json) ? json : json.items || [];
}

function updateHud() {
  const starsEl = document.querySelector("#stars");
  // とりあえず「進んだ数」を★として表示（最大5）
  const done = Math.min(5, idx + 1);
  const filled = "★★★★★".slice(0, done);
  const empty = "☆☆☆☆☆".slice(done);
  starsEl.textContent = filled + empty;
}

function loadCurrent() {
  current = items[idx];
  strokeIndex = 0;
  isTracing = false;
  activePointerId = null;
  activeTarget = null;
  renderCurrentKanji();
  updateHud();
}

// -------------------- render --------------------
function renderCurrentKanji() {
  const title = document.querySelector("#kanjiTitle");
  const wrap = document.querySelector("#svgWrap");

  if (!current) {
    title.textContent = "データなし";
    wrap.innerHTML = "";
    return;
  }

  const total = current.strokes?.length || 0;
  title.textContent = `${current.kanji} (${strokeIndex + 1}/${total})  ${circleSteps(total)}`;

  wrap.innerHTML = "";

  const svgData = current.strokes?.[strokeIndex]?.svg;
  const strokeKey = current.strokes?.[strokeIndex]?.strokeKey;

  if (!svgData) {
    wrap.innerHTML = `<div class="msg">SVGデータが見つかりません</div>`;
    return;
  }

  // SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (svgData.viewBox) svg.setAttribute("viewBox", svgData.viewBox);
  else {
    // fallback
    const w = svgData.width || 100;
    const h = svgData.height || 100;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  // まず「全ストローク薄表示（背景）」を描く（あれば）
  const allPaths = svgData.allPaths || null;

  if (Array.isArray(allPaths) && allPaths.length) {
    allPaths.forEach((d) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.classList.add("strokeBase");
      svg.appendChild(p);
    });
  }

  // このストロークの「当たり判定」パス一覧
  const paths = svgData.paths || [];
  if (!Array.isArray(paths) || paths.length === 0) {
    wrap.innerHTML = `<div class="msg">SVGデータが見つかりません（strokeのキーを確認）</div>`;
    return;
  }

  // クリック（タップ）用の太い透明パス（ヒット領域）
  // 見える線（strokeHit）は「成功時に色が変わる」用に別で描く
  paths.forEach((d, i) => {
    // visible line
    const vis = document.createElementNS("http://www.w3.org/2000/svg", "path");
    vis.setAttribute("d", d);
    vis.classList.add("strokeHit");
    vis.dataset.index = String(i);

    // hit area
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", d);
    hit.classList.add("strokeTouch");
    hit.dataset.index = String(i);

    // pointer listeners (Day2)
    hit.addEventListener("pointerdown", handlePointerDown);
    hit.addEventListener("pointermove", handlePointerMove);
    hit.addEventListener("pointerup", handlePointerUp);
    hit.addEventListener("pointercancel", handlePointerCancel);
    hit.addEventListener("pointerleave", handlePointerLeave);

    svg.appendChild(vis);
    svg.appendChild(hit);
  });

  wrap.appendChild(svg);

  // strokeKey がある場合は軽く表示（デバッグ用）
  if (strokeKey) {
    const dbg = document.createElement("div");
    dbg.className = "debugKey";
    dbg.textContent = `key: ${strokeKey}`;
    wrap.appendChild(dbg);
  }
}

function circleSteps(n) {
  // ①②③④⑤… を最大10程度
  const marks = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  const out = [];
  for (let i = 0; i < n; i++) out.push(marks[i] || "●");
  return out.join("");
}

// -------------------- trace handlers (Day2) --------------------
function handlePointerDown(e) {
  // ここで pointer を捕まえて “なぞり開始”
  isTracing = true;
  activePointerId = e.pointerId;
  activeTarget = e.target;

  // トレース距離（指/マウス移動量）を計測
  traceStartX = e.clientX;
  traceStartY = e.clientY;
  traceLastX = e.clientX;
  traceLastY = e.clientY;
  traceDist = 0;
  traceStartT = performance.now();

  // captureして pointerup を確実に取る
  try {
    activeTarget.setPointerCapture(activePointerId);
  } catch (_) {}

  // active表示（見える線を濃く）
  const idxTouched = Number(e.target.dataset.index);
  setActiveStroke(idxTouched);
}

function handlePointerMove(e) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;

  // 移動距離を加算（タップだけ判定を防ぐ）
  const dx = e.clientX - traceLastX;
  const dy = e.clientY - traceLastY;
  traceDist += Math.hypot(dx, dy);
  traceLastX = e.clientX;
  traceLastY = e.clientY;

  // Day2: 形判定なし。moveは「触ってなぞってる」感を作る役のみ
}

function handlePointerUp(e) {
  if (!isTracing) return;
  if (e.pointerId !== activePointerId) return;

  const elapsed = performance.now() - traceStartT;
  const enoughTrace = traceDist >= MIN_TRACE_DIST && elapsed >= MIN_TRACE_TIME;

  // pointerupは必ず発火する想定（capture済み）
  const idxTouched = Number(e.target.dataset.index);

  // 当たりストロークを「今のstrokeIndexの paths[0]...」として扱う
  // （このゲームでは paths をまとめて1ストロークとして扱っている想定）
  // → ここは「どれか1本でも触れたらOK」ではなく、
  //    “なぞりが発生した” ことを条件に進める
  if (Number.isNaN(idxTouched)) {
    cleanupTraceState();
    return;
  }

  // タップだけ（移動がほぼ無い）場合は成功扱いにしない
  if (!enoughTrace) {
    cleanupTraceState();
    // ちょいフィードバック（押した感は出す）
    pulseChara();
    return;
  }

  // 成功：次の線へ
  cleanupTraceState();
  pulseChara();

  strokeIndex += 1;

  const total = current.strokes?.length || 0;
  if (strokeIndex >= total) {
    // 次の漢字へ
    idx = Math.min(items.length - 1, idx + 1);
    loadCurrent();
  } else {
    renderCurrentKanji();
  }
}

function handlePointerCancel(e) {
  if (e.pointerId !== activePointerId) return;
  cleanupTraceState();
}

function handlePointerLeave(e) {
  // leaveは失敗扱いにはしない（iPadで指がズレやすい）
  // pointerupで判定する
}

function cleanupTraceState() {
  isTracing = false;
  activePointerId = null;
  if (activeTarget) {
    try {
      activeTarget.releasePointerCapture(activePointerId);
    } catch (_) {}
  }
  activeTarget = null;
  clearActiveStroke();
}

function setActiveStroke(i) {
  // strokeHit の i番目を強調
  const wrap = document.querySelector("#svgWrap");
  if (!wrap) return;
  wrap.querySelectorAll(".strokeHit").forEach((p) => p.classList.remove("strokeActive"));
  const target = wrap.querySelector(`.strokeHit[data-index="${i}"]`);
  if (target) target.classList.add("strokeActive");
}

function clearActiveStroke() {
  const wrap = document.querySelector("#svgWrap");
  if (!wrap) return;
  wrap.querySelectorAll(".strokeHit").forEach((p) => p.classList.remove("strokeActive"));
}

function pulseChara() {
  // 演出：中央の漢字タイトルを一瞬拡大
  const title = document.querySelector("#kanjiTitle");
  if (!title) return;
  title.classList.remove("pulse");
  // reflow
  void title.offsetWidth;
  title.classList.add("pulse");
}

// -------------------- boot --------------------
(async function boot() {
  buildAppShell();
  await loadData();
  if (!items.length) {
    document.querySelector("#svgWrap").innerHTML = `<div class="msg">データが空です</div>`;
    return;
  }
  loadCurrent();
})();
