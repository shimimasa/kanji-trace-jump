// src/main.js
// Day2: 書き順なぞり（かんたん判定つき）

const APP = document.querySelector("#app");

const state = {
  items: [],
  index: 0,
  strokeIndex: 0,
  done: new Set(), // stroke indices done for current kanji
  tracing: false,
  tracePoints: [],
  // elements
  els: {},
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function parseNumbersFromPath(d) {
  const nums = d.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums) return [];
  return nums.map(Number);
}

function computeBBoxFromStrokes(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    const nums = parseNumbersFromPath(s.d);
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = nums[i], y = nums[i + 1];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    el.setAttribute(k, String(v));
  }
  return el;
}

function getBaseUrl() {
  // Vite: import.meta.env.BASE_URL is safe in dev/build.
  // Fallback to "/".
  try {
    const b = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
    return b && typeof b === "string" ? b : "/";
  } catch {
    return "/";
  }
}

async function loadData() {
  const base = getBaseUrl().replace(/\/?$/, "/");
  const url = base + "data/kanji_g1_min5.json"; // public/data/...
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`データ読み込み失敗: HTTP ${res.status} (${url})`);
  const json = await res.json();
  if (!json || !Array.isArray(json.items)) throw new Error("データ形式が不正です（itemsがありません）");
  return json.items;
}

function buildUI() {
  APP.innerHTML = `
    <div class="app">
      <div class="hud">
        <div class="stars" aria-label="stars">☆☆☆☆☆</div>
        <div class="objective">もくひょう：5もじ</div>
      </div>

      <div class="titleRow">
        <div class="kanjiTitle">
          <span class="kanjiLabel" id="kanjiLabel">-</span>
          <span class="progressLabel" id="progressLabel">(0/0)</span>
        </div>
      </div>

      <div class="stage">
        <div class="svgWrap" id="svgWrap"></div>
      </div>

      <div class="strokeDots" id="strokeDots"></div>

      <div class="nav">
        <button class="btn" id="prevBtn" type="button" disabled>まえ</button>
        <button class="btn primary" id="nextBtn" type="button" disabled>つぎ</button>
      </div>

      <div class="status" id="statusText"></div>
    </div>
  `;

  state.els.kanjiLabel = document.getElementById("kanjiLabel");
  state.els.progressLabel = document.getElementById("progressLabel");
  state.els.svgWrap = document.getElementById("svgWrap");
  state.els.strokeDots = document.getElementById("strokeDots");
  state.els.prevBtn = document.getElementById("prevBtn");
  state.els.nextBtn = document.getElementById("nextBtn");
  state.els.statusText = document.getElementById("statusText");

  state.els.prevBtn.addEventListener("click", () => moveIndex(-1));
  state.els.nextBtn.addEventListener("click", () => moveIndex(+1));
}

function setStatus(msg = "", kind = "") {
  state.els.statusText.textContent = msg;
  state.els.statusText.dataset.kind = kind;
}

function moveIndex(delta) {
  const next = clamp(state.index + delta, 0, state.items.length - 1);
  if (next === state.index) return;
  state.index = next;
  resetKanjiProgress();
  render();
}

function resetKanjiProgress() {
  state.strokeIndex = 0;
  state.done = new Set();
  state.tracing = false;
  state.tracePoints = [];
}

function render() {
  const item = state.items[state.index];
  if (!item) {
    state.els.kanjiLabel.textContent = "-";
    state.els.progressLabel.textContent = "(0/0)";
    state.els.svgWrap.textContent = "データなし";
    state.els.strokeDots.textContent = "";
    state.els.prevBtn.disabled = true;
    state.els.nextBtn.disabled = true;
    setStatus("データなし", "error");
    return;
  }

  state.els.kanjiLabel.textContent = item.kanji ?? "-";
  state.els.progressLabel.textContent = `(${state.index + 1}/${state.items.length})`;

  state.els.prevBtn.disabled = state.index === 0;
  // 次の漢字に進めるのは、全ストローク完了後
  const allDone = state.done.size >= (item.strokesCount || item.strokes.length || 0);
  state.els.nextBtn.disabled = !allDone;
  state.els.nextBtn.classList.toggle("primary", allDone);

  renderStrokeDots(item);
  renderKanjiSVG(item);

  if (allDone) {
    setStatus("クリア！「つぎ」で次の漢字へ。", "ok");
  } else {
    setStatus("なぞって、書き順どおりに進めよう。", "");
  }
}

function renderStrokeDots(item) {
  const n = item.strokesCount || (item.strokes ? item.strokes.length : 0);
  state.els.strokeDots.innerHTML = "";
  if (!n) return;

  for (let i = 0; i < n; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dot";
    btn.textContent = String(i + 1);
    if (state.done.has(i)) btn.classList.add("done");
    if (i === state.strokeIndex) btn.classList.add("active");

    // Day2は「正解のストロークを追う」体験が重要なので、ジャンプは無効（混乱する）
    // 代わりに「ヒント表示」: 押したストロークを一瞬強調する
    btn.addEventListener("click", () => flashHintStroke(i));
    state.els.strokeDots.appendChild(btn);
  }
}

function flashHintStroke(i) {
  const hint = state.els.svgWrap.querySelector(`path[data-stroke="${i}"].strokeBase`);
  if (!hint) return;
  hint.classList.add("hint");
  window.setTimeout(() => hint.classList.remove("hint"), 350);
}

function renderKanjiSVG(item) {
  state.els.svgWrap.innerHTML = "";

  const strokes = item.strokes || [];
  if (!strokes.length) {
    state.els.svgWrap.textContent = "データなし";
    return;
  }

  const { minX, minY, maxX, maxY } = computeBBoxFromStrokes(strokes);
  const pad = 6;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = (maxX - minX) + pad * 2;
  const vbH = (maxY - minY) + pad * 2;

  const svg = svgEl("svg", {
    class: "kanjiSvg",
    viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
    role: "img",
    "aria-label": "kanji",
  });

  // ガイド（薄い全ストローク）
  const gBase = svgEl("g", { class: "layer" });
  strokes.forEach((s, idx) => {
    const cls = state.done.has(idx) ? "strokeDone" : "strokeBase";
    const p = svgEl("path", { d: s.d, class: cls, "data-stroke": String(idx) });
    gBase.appendChild(p);
  });

  // 現在のストローク（太め）
  const currentIndex = clamp(state.strokeIndex, 0, strokes.length - 1);
  const current = strokes[currentIndex];
  const active = svgEl("path", { d: current.d, class: "strokeActive" });

  // 当たり判定（見えない太い線）
  const hit = svgEl("path", { d: current.d, class: "strokeHit" });

  // ユーザーのなぞり（リアルタイム表示）
  const trace = svgEl("path", { class: "tracePath", d: "" });

  svg.appendChild(gBase);
  svg.appendChild(active);
  svg.appendChild(trace);
  svg.appendChild(hit);

  // pointer events
  attachTracingHandlers(svg, hit, trace, active, strokes, currentIndex);

  state.els.svgWrap.appendChild(svg);
}

function attachTracingHandlers(svg, hitPath, tracePath, activePath, strokes, currentIndex) {
  const onDown = (ev) => {
    // 既に完了済みなら無視
    if (state.done.has(currentIndex)) return;

    ev.preventDefault();
    ev.stopPropagation();

    state.tracing = true;
    state.tracePoints = [];
    tracePath.setAttribute("d", "");
    tracePath.classList.remove("bad");
    tracePath.classList.remove("good");

    // pointer capture（移動が外れても追跡）
    try {
      hitPath.setPointerCapture(ev.pointerId);
    } catch {}

    const pt = clientToSvgPoint(svg, ev.clientX, ev.clientY);
    state.tracePoints.push(pt);
    tracePath.setAttribute("d", `M ${pt.x} ${pt.y}`);
  };

  const onMove = (ev) => {
    if (!state.tracing) return;
    ev.preventDefault();

    const pt = clientToSvgPoint(svg, ev.clientX, ev.clientY);
    const last = state.tracePoints[state.tracePoints.length - 1];
    // 近すぎる点は間引く
    if (last && dist(pt, last) < 0.7) return;

    state.tracePoints.push(pt);

    // update trace path
    const d = buildPathFromPoints(state.tracePoints);
    tracePath.setAttribute("d", d);
  };

  const onUp = (ev) => {
    if (!state.tracing) return;
    ev.preventDefault();
    state.tracing = false;

    const result = evaluateTrace(activePath, state.tracePoints);
    if (result.pass) {
      tracePath.classList.add("good");
      // mark done and advance
      state.done.add(currentIndex);
      state.strokeIndex = clamp(currentIndex + 1, 0, strokes.length - 1);

      window.setTimeout(() => render(), 180);
    } else {
      tracePath.classList.add("bad");
      setStatus("うーん、ちがうかも。もういちど！", "warn");
      window.setTimeout(() => {
        tracePath.setAttribute("d", "");
        tracePath.classList.remove("bad");
      }, 450);
    }
  };

  hitPath.addEventListener("pointerdown", onDown, { passive: false });
  svg.addEventListener("pointermove", onMove, { passive: false });
  svg.addEventListener("pointerup", onUp, { passive: false });
  svg.addEventListener("pointercancel", onUp, { passive: false });
}

function clientToSvgPoint(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;

  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;

  return {
    x: vb.x + nx * vb.width,
    y: vb.y + ny * vb.height,
  };
}

function buildPathFromPoints(points) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}

function evaluateTrace(activePath, points) {
  // Day2は厳しすぎると止まるので「ゆるめ判定」
  if (!points || points.length < 8) return { pass: false };

  let pathLen = 0;
  try {
    pathLen = activePath.getTotalLength();
  } catch {
    // getTotalLengthが取れない環境は超ゆる判定
    return { pass: points.length >= 14 };
  }

  const sampleN = 90;
  const samples = [];
  for (let i = 0; i <= sampleN; i++) {
    const p = activePath.getPointAtLength((pathLen * i) / sampleN);
    samples.push({ x: p.x, y: p.y });
  }

  // start/end 方向チェック（逆方向を弾く）
  const start = samples[0];
  const end = samples[samples.length - 1];
  const dStart = dist(points[0], start);
  const dEnd = dist(points[0], end);
  const reversed = dEnd < dStart;

  // 近さ判定
  let sum = 0;
  let maxD = 0;
  const nearestIndex = [];

  for (const pt of points) {
    let best = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < samples.length; i++) {
      const dd = dist(pt, samples[i]);
      if (dd < best) {
        best = dd;
        bestIdx = i;
      }
    }
    nearestIndex.push(bestIdx);
    sum += best;
    maxD = Math.max(maxD, best);
  }

  const avg = sum / points.length;

  // カバレッジ：ストロークのどれくらいをなぞったか（0..1）
  const minIdx = Math.min(...nearestIndex);
  const maxIdx = Math.max(...nearestIndex);
  const coverage = (maxIdx - minIdx) / sampleN;

  // 単調性：大きな逆戻りが少ない
  let backSteps = 0;
  for (let i = 1; i < nearestIndex.length; i++) {
    if (nearestIndex[i] < nearestIndex[i - 1] - 6) backSteps++;
  }

  // しきい値（ゆるめ）
  const avgOK = avg <= 3.2;
  const maxOK = maxD <= 9.0;
  const coverageOK = coverage >= 0.35;
  const directionOK = !reversed && dist(points[points.length - 1], end) <= 10.5;
  const monotoneOK = backSteps <= 2;

  const pass = avgOK && maxOK && coverageOK && directionOK && monotoneOK;

  return { pass, avg, maxD, coverage, backSteps, reversed };
}

// boot
(async function init() {
  buildUI();
  setStatus("データ読み込み中…", "");
  try {
    state.items = await loadData();
    if (!state.items.length) throw new Error("items が空です");
    resetKanjiProgress();
    render();
  } catch (e) {
    console.error(e);
    state.els.svgWrap.textContent = "データなし";
    setStatus(String(e?.message ?? e), "error");
  }
})();

