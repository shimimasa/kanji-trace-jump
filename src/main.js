// src/main.js
// 目的：SVGストロークを「なぞる」ことで書き順どおりに進める
// 修正点：Pointer Capture を導入し、ドラッグ中の pointermove 取りこぼしを防止

const DATA_PATH = "/data/kanji_g1_min5.json"; // public/data 配下

// 5文字（あなたの現状）を SVG ストローク（ポリライン）で再現
// 座標系は viewBox="0 0 100 100"
const SVG_STROKES = {
  "木": [
    [{ x: 20, y: 30 }, { x: 80, y: 30 }], // ①横
    [{ x: 50, y: 12 }, { x: 50, y: 88 }], // ②縦
    [{ x: 50, y: 52 }, { x: 25, y: 85 }], // ③左はらい
    [{ x: 50, y: 52 }, { x: 75, y: 85 }], // ④右はらい
  ],
  "山": [
    [{ x: 30, y: 18 }, { x: 30, y: 82 }], // ①左たて
    [{ x: 50, y: 28 }, { x: 50, y: 82 }, { x: 70, y: 82 }], // ②中たて→下よこ（まとめ）
    [{ x: 70, y: 18 }, { x: 70, y: 82 }], // ③右たて
  ],
  "川": [
    [{ x: 34, y: 18 }, { x: 34, y: 82 }], // ①左
    [{ x: 50, y: 18 }, { x: 50, y: 82 }], // ②中
    [{ x: 66, y: 18 }, { x: 66, y: 82 }], // ③右
  ],
  "口": [
    [{ x: 28, y: 30 }, { x: 72, y: 30 }], // ①上よこ
    [{ x: 28, y: 30 }, { x: 28, y: 72 }], // ②左たて
    [{ x: 72, y: 30 }, { x: 72, y: 72 }, { x: 28, y: 72 }], // ③右たて→下よこ
  ],
  "人": [
    [{ x: 54, y: 22 }, { x: 36, y: 82 }], // ①左はらい
    [{ x: 54, y: 22 }, { x: 74, y: 82 }], // ②右はらい
  ],
};

const TOLERANCE = 10; // 近い判定（px相当：viewBox 100基準）
const START_TOL = 14; // 書き始めの近さ
const MIN_HIT_RATE = 0.7; // これ以上の割合が線に近ければ成功
const MIN_DRAW_LEN_RATE = 0.45; // これ以上描いていれば成功（線長比）

// DOM
const elStars = document.getElementById("stars");
const elMode = document.getElementById("mode");
const elLabel = document.getElementById("kanjiLabel");
const elArea = document.getElementById("kanjiArea");
const elStrokeButtons = document.getElementById("strokeButtons");
const elPrev = document.getElementById("prevBtn");
const elNext = document.getElementById("nextBtn");
const elError = document.getElementById("error");

let items = []; // データ読み込み
let idx = 0;

let strokeIndex = 0; // 今なぞるべきストローク
let done = []; // boolean[]
let svg = null;

// トレース中
let drawing = false;
let points = [];
let tracePathEl = null;

boot();

async function boot() {
  try {
    items = await loadData();
  } catch (e) {
    showError(`データ読み込み失敗: ${String(e?.message ?? e)}`);
    items = fallbackItems();
  }

  if (!Array.isArray(items) || items.length === 0) {
    showError("データなし");
    items = fallbackItems();
  }

  elPrev.addEventListener("click", () => move(-1));
  elNext.addEventListener("click", () => move(1));

  render();
}

async function loadData() {
  const res = await fetch(DATA_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${DATA_PATH})`);
  const json = await res.json();

  // 期待：配列 [{kanji:"木", strokesCount:4}, ...]
  if (Array.isArray(json)) return json;

  // もし {items:[...]} 形式なら吸収
  if (json && Array.isArray(json.items)) return json.items;

  throw new Error("JSON形式が想定と違います（配列でも items でもない）");
}

function fallbackItems() {
  return [
    { kanji: "木", strokesCount: 4 },
    { kanji: "山", strokesCount: 3 },
    { kanji: "川", strokesCount: 3 },
    { kanji: "口", strokesCount: 3 },
    { kanji: "人", strokesCount: 2 },
  ];
}

function move(delta) {
  idx = clamp(idx + delta, 0, items.length - 1);
  strokeIndex = 0;
  done = [];
  render();
}

function render() {
  clearError();

  const item = items[idx];
  const k = item?.kanji ?? "?";

  // stars
  renderStars(idx, items.length);

  // label
  elLabel.textContent = `${k} (${idx + 1}/${items.length})`;

  // strokes definition
  const strokes = SVG_STROKES[k];
  if (!strokes) {
    // svgが無い場合は表示だけ（将来拡張用）
    elArea.innerHTML = `<div style="font-size:96px; opacity:.35; font-weight:700;">${escapeHtml(k)}</div>`;
    elStrokeButtons.innerHTML = "";
    elPrev.disabled = idx === 0;
    elNext.disabled = idx === items.length - 1;
    return;
  }

  // init done
  done = new Array(strokes.length).fill(false);
  strokeIndex = 0;

  // buttons
  renderStrokeButtons(strokes.length);

  // svg build
  elArea.innerHTML = "";
  svg = buildSvgForKanji(strokes);
  elArea.appendChild(svg);

  // controls
  elPrev.disabled = idx === 0;
  // 「つぎ」は全ストローク完了 or 最終ページなら disabled の運用にしたいなら変更可
  elNext.disabled = idx === items.length - 1;

  // attach trace logic
  attachTraceHandlers(svg, strokes);

  pulse(svg);
}

function renderStars(current, total) {
  const max = 5;
  const ratio = total <= 1 ? 1 : current / (total - 1);
  const filled = Math.round(ratio * (max - 1)) + 1; // 1〜5
  const s = [];
  for (let i = 0; i < max; i++) s.push(i < filled ? "★" : "☆");
  elStars.textContent = s.join("");
}

function renderStrokeButtons(n) {
  elStrokeButtons.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "strokeBtn";
    b.textContent = String(i + 1);

    // 今のストロークだけ強調
    if (i === strokeIndex) b.classList.add("active");

    // 既に終わったもの
    if (done[i]) b.classList.add("done");

    // ユーザーが勝手に飛ばせないように、ボタン自体は無効（表示だけ）
    b.disabled = true;

    elStrokeButtons.appendChild(b);
  }
}

function buildSvgForKanji(strokes) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 100 100");
  s.setAttribute("class", "kanjiSvg");
  s.setAttribute("aria-label", "漢字ストローク");

  // 各ストローク（ベース表示）
  strokes.forEach((poly, i) => {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", polyToPathD(poly));
    p.dataset.strokeIndex = String(i);

    // ベースは薄いグレー
    p.setAttribute("class", "stroke-base");
    s.appendChild(p);
  });

  // 現在ストロークを濃く表示するためのオーバーレイ
  const active = document.createElementNS(ns, "path");
  active.setAttribute("class", "stroke-active");
  active.setAttribute("d", polyToPathD(strokes[0]));
  active.dataset.role = "active";
  s.appendChild(active);

  // クリック当たり判定（見えない太線）
  strokes.forEach((poly, i) => {
    const hit = document.createElementNS(ns, "path");
    hit.setAttribute("d", polyToPathD(poly));
    hit.dataset.strokeIndex = String(i);
    hit.setAttribute("class", "stroke-hit");
    s.appendChild(hit);
  });

  // トレース線（ユーザーがなぞっている軌跡）
  tracePathEl = document.createElementNS(ns, "path");
  tracePathEl.setAttribute("class", "trace-line");
  tracePathEl.setAttribute("d", "");
  tracePathEl.dataset.role = "trace";
  s.appendChild(tracePathEl);

  return s;
}

function attachTraceHandlers(svgEl, strokes) {
  // 重要：前回の trace をリセット
  drawing = false;
  points = [];
  if (tracePathEl) tracePathEl.setAttribute("d", "");

  const onDown = (e) => {
    // 右クリック等除外
    if (e.button != null && e.button !== 0) return;

    // 書き順：いまの strokeIndex 以外の線の上で開始したら無視
    const targetStroke = getStrokeIndexFromEvent(e);
    if (targetStroke !== strokeIndex) return;

    drawing = true;
    points = [];
    const p = toSvgPoint(svgEl, e.clientX, e.clientY);
    points.push(p);
    updateTracePath(points);

    // ★ここが肝：ドラッグ中にSVG外へ少し出ても move を拾える
    try {
      svgEl.setPointerCapture(e.pointerId);
    } catch (_) {
      // 一部環境で失敗しても動作は継続
    }

    e.preventDefault();
  };

  const onMove = (e) => {
    if (!drawing) return;
    const p = toSvgPoint(svgEl, e.clientX, e.clientY);
    points.push(p);
    updateTracePath(points);
    e.preventDefault();
  };

  const finish = (e) => {
    if (!drawing) return;
    drawing = false;

    // Pointer Capture解除
    try {
      svgEl.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const ok = judgeTrace(points, strokes[strokeIndex]);
    // トレース線は毎回消す（残したいなら消さなくてOK）
    points = [];
    updateTracePath(points);

    if (ok) {
      done[strokeIndex] = true;
      strokeIndex++;

      if (strokeIndex >= strokes.length) {
        // 1文字完了：自動で次へ進めたいならここで move(1)
        // 今は「つぎ」ボタンで進む運用にしておく
        strokeIndex = strokes.length - 1; // 末尾に固定表示
      }

      // UI更新
      refreshSvgStates(svgEl, strokes);
      renderStrokeButtons(strokes.length);
      pulse(svgEl);
    } else {
      // 不正解：軽いフィードバック
      shake(svgEl);
    }

    e.preventDefault();
  };

  svgEl.addEventListener("pointerdown", onDown, { passive: false });
  svgEl.addEventListener("pointermove", onMove, { passive: false });
  svgEl.addEventListener("pointerup", finish, { passive: false });
  svgEl.addEventListener("pointercancel", finish, { passive: false });
}

function refreshSvgStates(svgEl, strokes) {
  // done stroke: stroke-base を濃くする（または別クラスに）
  const basePaths = Array.from(svgEl.querySelectorAll("path.stroke-base"));
  basePaths.forEach((p) => {
    const i = Number(p.dataset.strokeIndex);
    if (Number.isFinite(i) && done[i]) p.classList.add("done");
    else p.classList.remove("done");
  });

  // active overlay
  const active = svgEl.querySelector('path[data-role="active"]');
  if (!active) return;

  const nextIdx = clamp(strokeIndex, 0, strokes.length - 1);
  active.setAttribute("d", polyToPathD(strokes[nextIdx]));
}

function getStrokeIndexFromEvent(e) {
  const t = e.target;
  if (!t) return null;
  const ds = t.dataset?.strokeIndex;
  if (ds == null) return null;
  const n = Number(ds);
  return Number.isFinite(n) ? n : null;
}

function updateTracePath(pts) {
  if (!tracePathEl) return;
  if (!pts || pts.length === 0) {
    tracePathEl.setAttribute("d", "");
    return;
  }
  tracePathEl.setAttribute("d", polyToPathD(pts));
}

function judgeTrace(drawnPoints, strokePoly) {
  if (!drawnPoints || drawnPoints.length < 6) return false;

  // start near
  const start = drawnPoints[0];
  const s0 = strokePoly[0];
  if (dist(start, s0) > START_TOL) return false;

  // 描画の長さが短すぎると不合格
  const strokeLen = polyLength(strokePoly);
  const drawnLen = polyLength(drawnPoints);
  if (strokeLen <= 0 || drawnLen < strokeLen * MIN_DRAW_LEN_RATE) return false;

  // 点が線に近い割合
  let hit = 0;
  for (const p of drawnPoints) {
    const d = distancePointToPolyline(p, strokePoly);
    if (d <= TOLERANCE) hit++;
  }
  const rate = hit / drawnPoints.length;
  return rate >= MIN_HIT_RATE;
}

// --- Geometry helpers ---

function toSvgPoint(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return { x, y };
}

function polyToPathD(poly) {
  if (!poly || poly.length === 0) return "";
  const [p0, ...rest] = poly;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` + rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

function polyLength(poly) {
  let len = 0;
  for (let i = 1; i < poly.length; i++) len += dist(poly[i - 1], poly[i]);
  return len;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function distancePointToPolyline(p, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    best = Math.min(best, distancePointToSegment(p, poly[i - 1], poly[i]));
  }
  return best;
}

function distancePointToSegment(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);

  const t = c1 / c2;
  const px = a.x + t * vx;
  const py = a.y + t * vy;
  return Math.hypot(p.x - px, p.y - py);
}

// --- UI helpers ---

function showError(msg) {
  if (elError) elError.textContent = msg;
}
function clearError() {
  if (elError) elError.textContent = "";
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function pulse(el) {
  if (!el) return;
  el.classList.remove("tracePulse");
  // reflow
  void el.offsetWidth;
  el.classList.add("tracePulse");
}
function shake(el) {
  if (!el) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(-2px)" },
      { transform: "translateX(2px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 180, easing: "ease-out" }
  );
}

