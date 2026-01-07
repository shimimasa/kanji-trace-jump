// src/main.js
// 目的：SVGストロークを「なぞる」ことで書き順どおりに進める
// 重要：Vite本番でCSS/JSONパスが壊れないように BASE_URL を使う
// 重要：Pointer Capture でドラッグ中の pointermove 取りこぼしを防止

import "./style.css";

// Viteのbase（例: "/" or "/kanji-trace-jump/"）を考慮して public/ 配下を読む
const BASE_PATH = import.meta.env.BASE_URL ?? "/";

// ✅ ここがポイント：base を「絶対URL」にする
const BASE_URL = new URL(BASE_PATH, window.location.href);

// public/data 配下
const DATA_PATH = new URL("data/kanji_g1_min5.json", BASE_URL).toString();

// 5文字（あなたの現状）を SVG ストローク（ポリライン）で再現
// 座標系は viewBox="0 0 100 100"
const SVG_STROKES = {
  木: [
    [{ x: 20, y: 30 }, { x: 80, y: 30 }], // ①横
    [{ x: 50, y: 12 }, { x: 50, y: 88 }], // ②縦
    [{ x: 50, y: 52 }, { x: 25, y: 85 }], // ③左はらい
    [{ x: 50, y: 52 }, { x: 75, y: 85 }], // ④右はらい
  ],
  山: [
    [{ x: 30, y: 18 }, { x: 30, y: 82 }], // ①左たて
    [{ x: 50, y: 28 }, { x: 50, y: 82 }, { x: 70, y: 82 }], // ②中たて→下よこ（まとめ）
    [{ x: 70, y: 18 }, { x: 70, y: 82 }], // ③右たて
  ],
  川: [
    [{ x: 34, y: 18 }, { x: 34, y: 82 }], // ①左
    [{ x: 50, y: 18 }, { x: 50, y: 82 }], // ②中
    [{ x: 66, y: 18 }, { x: 66, y: 82 }], // ③右
  ],
  口: [
    [{ x: 28, y: 30 }, { x: 72, y: 30 }], // ①上よこ
    [{ x: 28, y: 30 }, { x: 28, y: 72 }], // ②左たて
    [{ x: 72, y: 30 }, { x: 72, y: 72 }, { x: 28, y: 72 }], // ③右たて→下よこ
  ],
  人: [
    [{ x: 54, y: 22 }, { x: 36, y: 82 }], // ①左はらい
    [{ x: 54, y: 22 }, { x: 74, y: 82 }], // ②右はらい
  ],
};

// 小学生でも通りやすい“ゆるめ”設定（viewBox=100 基準）
// 厳しすぎると「1画目は通るのに2画目以降が始点チェックで弾かれる」事故が起きやすい。
// ここは“成功体験優先”で設定し、必要なら teacherMode で徐々に締める運用が安全。
const TOLERANCE = 14; // 線に近い判定
const START_TOL = 24; // 書き始めの近さ（端点付近ならOK）
const MIN_HIT_RATE = 0.5; // これ以上の割合が線に近ければ成功
const MIN_DRAW_LEN_RATE = 0.25; // これ以上描いていれば成功（線長比）

// DOM
const elStars = document.getElementById("stars");
const elMode = document.getElementById("mode");
const elLabel = document.getElementById("kanjiLabel");
const elArea = document.getElementById("kanjiArea");
const elStrokeButtons = document.getElementById("strokeButtons");
const elTeacherToggle = document.getElementById("teacherToggle");
const elPrev = document.getElementById("prevBtn");
const elNext = document.getElementById("nextBtn");
const elError = document.getElementById("error");

// ===========================
// Teacher Mode（表示だけ / UI切替だけ）
// ===========================
const TEACHER_MODE_LS_KEY = "kanjiTraceTeacherMode";
let teacherMode = false;

function applyTeacherMode() {
  document.documentElement.classList.toggle("teacher-mode", teacherMode);
  if (elTeacherToggle) {
    elTeacherToggle.setAttribute("aria-pressed", teacherMode ? "true" : "false");
  }

  // 表示文言（子どもは目標、先生はモードも分かる）
  if (elMode) {
    elMode.textContent = teacherMode ? "もくひょう：5もじ（先生）" : "もくひょう：5もじ";
  }
}

function toast(msg, ms = 900) {
  showError(msg);
  setTimeout(() => clearError(), ms);
}

function toggleTeacherMode() {
    teacherMode = !teacherMode;
    localStorage.setItem(TEACHER_MODE_LS_KEY, teacherMode ? "1" : "0");
    applyTeacherMode();
    toast(teacherMode ? "先生モード：ON" : "先生モード：OFF");
   }

let items = []; // データ読み込み
let idx = 0;

const SET_SIZE = 5;

function getSetInfo(i = idx) {
  const start = Math.floor(i / SET_SIZE) * SET_SIZE;
  const end = Math.min(start + SET_SIZE, items.length);
  const len = end - start; // 1〜5
  const pos = i - start;   // 0〜len-1
  return { start, end, len, pos };
}

let strokeIndex = 0; // 今なぞるべきストローク
let done = []; // boolean[]
let svg = null;

// 1文字クリア後の自動進行（演出の余韻用）
const AUTO_NEXT_DELAY_MS = 650;
let kanjiCompleted = false;

// トレース中
let drawing = false;
let points = [];
let tracePathEl = null;

boot();

async function boot() {
  // teacherMode 初期化（URL / localStorage）
  teacherMode = readTeacherMode();
  applyTeacherMode();
  // 先生用の“隠しトグル”：目標表示をダブルクリック or 長押し(900ms)
  if (elMode) {
    elMode.addEventListener("dblclick", () => toggleTeacherMode());
    let pressTimer = null;
    elMode.addEventListener("pointerdown", () => {
      pressTimer = setTimeout(() => toggleTeacherMode(), 900);
    });
    const cancel = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    };
    elMode.addEventListener("pointerup", cancel);
    elMode.addEventListener("pointercancel", cancel);
    elMode.addEventListener("pointerleave", cancel);
  }

  // ボタンからの切替（UIは teacher-mode の時だけ見える）
  if (elTeacherToggle) {
      elTeacherToggle.addEventListener("click", () => {
        toggleTeacherMode();
      });
    }
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

  // モード表示は applyTeacherMode() に一本化
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
  kanjiCompleted = false;

  const item = items[idx];
  const k = item?.kanji ?? "?";

  const set = getSetInfo(idx);
renderStars(set.pos, set.len);                // ★は0〜4（5個）で進む
elLabel.textContent = `${k} (${set.pos + 1}/${set.len})`; // 例：木 (1/5)


  const strokes = SVG_STROKES[k];
  if (!strokes) {
    elArea.innerHTML = `<div style="font-size:96px; opacity:.35; font-weight:700;">${escapeHtml(k)}</div>`;
    elStrokeButtons.innerHTML = "";
    elPrev.disabled = idx === 0;
    elNext.disabled = idx === items.length - 1;
    return;
  }

  done = new Array(strokes.length).fill(false);
  strokeIndex = 0;

  renderStrokeButtons(strokes.length);

  elArea.innerHTML = "";
  svg = buildSvgForKanji(strokes);
  elArea.appendChild(svg);
  resetCharForNewKanji(svg, strokes);

  elPrev.disabled = idx === 0;
  elNext.disabled = idx === items.length - 1;

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

  // ✅ 5つ揃った瞬間だけキラ
  if (filled === 5 && _lastStarFilled !== 5) {
    sparkleStars();
  }
  _lastStarFilled = filled;
 }

// ===========================
// Stars sparkle (on 5/5)
// ===========================
let _lastStarFilled = 0;

function sparkleStars() {
  if (!elStars) return;

  // 文字（★）自体のポップ演出
  elStars.classList.remove("starsSparkle");
  // reflow to restart animation
  void elStars.offsetWidth;
  elStars.classList.add("starsSparkle");

  // 小粒スパーク（8個）
  spawnStarSparks(8);
}

function spawnStarSparks(count = 8) {
  if (!elStars) return;
  const rect = elStars.getBoundingClientRect();
  // 星の中心（表示上の中心）を基準に飛ばす
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  for (let i = 0; i < count; i++) {
    const spark = document.createElement("span");
    spark.className = "star-spark";

    // 中心付近からランダムに散る
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 18;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;

    // 開始位置（中心±少し）
    const ox = cx + (Math.random() * 8 - 4);
    const oy = cy + (Math.random() * 6 - 3);
    spark.style.left = `${ox}px`;
    spark.style.top = `${oy}px`;
    spark.style.setProperty("--dx", `${dx}px`);
    spark.style.setProperty("--dy", `${dy}px`);

    elStars.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

function renderStrokeButtons(n) {
  elStrokeButtons.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stroke-btn";
    b.textContent = String(i + 1);

    if (i === strokeIndex) b.classList.add("is-active");
    if (done[i]) b.classList.add("is-done");

    // 表示のみ（飛ばし防止）
    b.disabled = true;

    elStrokeButtons.appendChild(b);
  }
}

// ===========================
// FX / Sound (minimal)
// ===========================
let _audioCtx = null;
function getAudioCtx() {
  if (_audioCtx) return _audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _audioCtx = new AC();
  return _audioCtx;
}

function playTone(freq = 660, duration = 0.07, type = "sine", gain = 0.04) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  // iOSなどでユーザー操作後にresumeが必要な場合
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playSuccessSfx() {
  // 軽い「ポン」
  playTone(784, 0.06, "sine", 0.05);
  playTone(988, 0.06, "sine", 0.04);
}

function playFailSfx() {
  // 失敗は音を出さない方針ならコメントアウトでもOK
  // ✅ 落下が主役：音は出さない（必要なら後で極小に）
  if (navigator.vibrate) navigator.vibrate(18);
}

function ensureFxLayer(svgEl) {
  const ns = "http://www.w3.org/2000/svg";
  let layer = svgEl.querySelector('[data-role="fx"]');
  if (layer) return layer;
  layer = document.createElementNS(ns, "g");
  layer.dataset.role = "fx";
  layer.setAttribute("class", "fx-layer");
  // traceの下に入れる（上に重なるのが嫌ならtraceの前）
  svgEl.appendChild(layer);
  return layer;
}

// ===========================
// Character (minimal circle)
// ===========================
function ensureCharLayer(svgEl) {
    const ns = "http://www.w3.org/2000/svg";
    let layer = svgEl.querySelector('[data-role="charLayer"]');
    if (layer) return layer;
    layer = document.createElementNS(ns, "g");
    layer.dataset.role = "charLayer";
    layer.setAttribute("class", "char-layer");
    svgEl.appendChild(layer);
    return layer;
  }
  
  function ensureChar(svgEl) {
    const ns = "http://www.w3.org/2000/svg";
    let c = svgEl.querySelector('[data-role="char"]');
    if (c) return c;
    const layer = ensureCharLayer(svgEl);
    c = document.createElementNS(ns, "circle");
    c.dataset.role = "char";
    c.setAttribute("r", "3.2");
    c.setAttribute("cx", "0");
    c.setAttribute("cy", "0");
    c.setAttribute("class", "char");
    // transformで位置を動かす
    c.setAttribute("transform", "translate(50 50)");
    layer.appendChild(c);
    return c;
  }

  // ===========================
 // Character (minimal circle)
 // ===========================
const CHAR_RIDE_OFFSET = 1.6; // viewBox(0-100)基準。1〜2px相当の“上に乗る”感
  
  function getStrokeAnchor(strokes, i) {
      // ✅ 「道（画）の中央」に着地させる：体験が気持ちよくなる
      const poly = strokes?.[i];
      if (!poly || poly.length < 2) return { x: 50, y: 50 };
    
      // 総延長
      let total = 0;
      const seg = [];
      for (let k = 0; k < poly.length - 1; k++) {
        const a = poly[k], b = poly[k + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        seg.push(d);
        total += d;
      }
      if (total <= 0.0001) return { x: poly[0].x, y: poly[0].y };
    
      // ✅ 通常は少し先（60%）、最後の画だけ中央（50%）
      const isLastStroke = (i === strokes.length - 1);
      const half = total * (isLastStroke ? 0.5 : 0.6);
      let acc = 0;
      for (let k = 0; k < seg.length; k++) {
        const d = seg[k];
        if (acc + d >= half) {
          const t = (half - acc) / d; // 0..1
          const a = poly[k], b = poly[k + 1];
          // 中央点
      let x = a.x + (b.x - a.x) * t;
      let y = a.y + (b.y - a.y) * t;

      // ✅ 法線方向に少しだけオフセットして「道の上」に乗せる
      // 接線（tangent）
      let tx = (b.x - a.x);
      let ty = (b.y - a.y);
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      // 法線（normal）: (-ty, tx)
      let nx = -ty;
      let ny = tx;
      // “上方向（yが小さい）”に揃える（nyが+なら下向きなので反転）
      if (ny > 0) { nx = -nx; ny = -ny; }

      x += nx * CHAR_RIDE_OFFSET;
      y += ny * CHAR_RIDE_OFFSET;

      return { x, y };
        }
        acc += d;
      }
      // 念のため最後
      const last = poly[poly.length - 1];
      return { x: last.x, y: last.y };
    }
  
  function setCharPos(svgEl, p) {
    const c = ensureChar(svgEl);
    c.setAttribute("transform", `translate(${p.x} ${p.y})`);
    svgEl.dataset.charX = String(p.x);
    svgEl.dataset.charY = String(p.y);
  }
  
  function getCharPos(svgEl) {
    const x = Number(svgEl.dataset.charX || "50");
    const y = Number(svgEl.dataset.charY || "50");
    return { x, y };
  }
  
  function resetCharForNewKanji(svgEl, strokes) {
    const p = getStrokeAnchor(strokes, 0);
    setCharPos(svgEl, p);
  }
  
  
 function charJumpTo(svgEl, to) {
   const c = ensureChar(svgEl);
   const base = getCharPos(svgEl); // ← これが未定義だった
   const mid = { x: (base.x + to.x) / 2, y: (base.y + to.y) / 2 - 8 };
   const down = { x: mid.x, y: mid.y + 10 }; // ← これが未定義だった（落下演出用）
 
   // 既存アニメが残っていても見た目破綻しないように
   c.getAnimations().forEach((a) => a.cancel());

  // ✅ ジャンプ中：少し大きく（1.08）／着地：ぷにっと潰す
  // ✅ 落下 → 復帰 → 着地ぷにっ
  c.animate(
      [
       // 0%: その場
      { transform: `translate(${base.x} ${base.y}) scale(1,1)` },
       // 45%: 落下（縦に伸びる）
      { transform: `translate(${down.x} ${down.y}) scale(0.92,1.10)` },
       // 78%: 元の位置に戻る
      { transform: `translate(${base.x} ${base.y}) scale(1,1)` },
       // 90%: ぷにっ（横に広がる）
      { transform: `translate(${base.x} ${base.y}) scale(1.12,0.88)` },
       // 100%: 戻る
      { transform: `translate(${base.x} ${base.y}) scale(1,1)` },
      ],
      { duration: 520, easing: "ease-out", fill: "forwards" }
    );
   // 最終位置を確定
  setTimeout(() => setCharPos(svgEl, to), 540);
 }

  
  
  function charFailDrop(svgEl) {
    const c = ensureChar(svgEl);
    const base = getCharPos(svgEl);
    const down = { x: base.x, y: base.y + 16 };
  
    c.getAnimations().forEach((a) => a.cancel());
  
    c.animate(
      [
        { transform: `translate(${base.x}px,${base.y}px) scale(1,1)` },
        { transform: `translate(${down.x}px,${down.y}px) scale(0.92,1.12)` },
        { transform: `translate(${base.x}px,${base.y}px) scale(1,1)` },
      ],
      { duration: 500, easing: "ease-out", fill: "forwards" }
    );
    // 位置は変わらない（復帰で戻る）
  }

function spawnSparks(svgEl, p, count = 10) {
  const ns = "http://www.w3.org/2000/svg";
  const layer = ensureFxLayer(svgEl);
  const { x, y } = p || { x: 50, y: 50 };

  for (let i = 0; i < count; i++) {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", x.toFixed(2));
    c.setAttribute("cy", y.toFixed(2));
    c.setAttribute("r", "1.2");
    c.setAttribute("class", "fx-spark");
    layer.appendChild(c);

    const a = Math.random() * Math.PI * 2;
    const d = 6 + Math.random() * 10; // 飛ぶ距離（viewBox=100想定）
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;

    // SVG要素でも Web Animations は動くブラウザが多い
    const anim = c.animate(
      [
        { transform: "translate(0px, 0px)", opacity: 0.95 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ],
      { duration: 280 + Math.random() * 120, easing: "ease-out", fill: "forwards" }
    );
    anim.onfinish = () => c.remove();
  }
}

function flashFail(svgEl) {
  if (!svgEl) return;
  svgEl.classList.add("failFlash");
  setTimeout(() => svgEl.classList.remove("failFlash"), 160);
}

// ===========================
// Hanamaru (final clear)
// ===========================
function showHanamaru(svgEl) {
  const ns = "http://www.w3.org/2000/svg";
  const layer = ensureFxLayer(svgEl);

  // グループ
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "hanamaru");
  g.setAttribute("transform", "translate(50 50) scale(0)");
  layer.appendChild(g);

  // 円（はなまる）
  const c = document.createElementNS(ns, "circle");
  c.setAttribute("cx", "0");
  c.setAttribute("cy", "0");
  c.setAttribute("r", "26");
  c.setAttribute("fill", "none");
  c.setAttribute("stroke", "#ff7a00");
  c.setAttribute("stroke-width", "6");
  c.setAttribute("stroke-linecap", "round");
  g.appendChild(c);

  // テキスト
  const t = document.createElementNS(ns, "text");
  t.setAttribute("x", "0");
  t.setAttribute("y", "10");
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("font-size", "18");
  t.setAttribute("font-weight", "700");
  t.setAttribute("fill", "#ff7a00");
  t.textContent = "はなまる！";
  g.appendChild(t);

  // アニメーション（ぽん → すこし弾む）
  g.animate(
    [
      { transform: "translate(50px,50px) scale(0)", opacity: 0 },
      { transform: "translate(50px,50px) scale(1.15)", opacity: 1 },
      { transform: "translate(50px,50px) scale(1)", opacity: 1 },
    ],
    { duration: 420, easing: "ease-out", fill: "forwards" }
  );

  // SE（少し特別）
  playTone(880, 0.08, "sine", 0.06);
  setTimeout(() => playTone(1175, 0.1, "sine", 0.05), 90);


  // ✅ 星も同時にキラる（連動）
  sparkleStars();
  // 1.2秒後に消す（次の遷移用）
  setTimeout(() => {
    g.remove();
  }, 1200);
}

let finalOverlay = null;

function closeFinalMenu() {
  if (finalOverlay) {
    finalOverlay.remove();
    finalOverlay = null;
  }
}

function showFinalMenu({ onReplay, onNextSet }) {
  closeFinalMenu();

  const wrap = document.createElement("div");
  wrap.className = "final-overlay";
  wrap.innerHTML = `
    <div class="final-card" role="dialog" aria-label="クリアメニュー">
      <div class="final-title">できた！</div>
      <div class="final-actions">
        <button type="button" class="btn" data-action="replay">もういちど</button>
        <button type="button" class="btn primary" data-action="next">つぎの5もじ</button>
      </div>
    </div>
  `;

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "replay") onReplay?.();
    if (action === "next") onNextSet?.();
  });

  document.body.appendChild(wrap);
  finalOverlay = wrap;
}



function buildSvgForKanji(strokes) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 100 100");
  s.setAttribute("class", "kanjiSvg");
  s.setAttribute("aria-label", "漢字ストローク");

  // ベース（薄いグレー）
  strokes.forEach((poly, i) => {
     // ✅ 足場（影）：doneになった画だけ表示する
    const shadow = document.createElementNS(ns, "path");
    shadow.setAttribute("d", polyToPathD(poly));
    shadow.dataset.strokeIndex = String(i);
    shadow.setAttribute("class", "stroke-shadow");
    s.appendChild(shadow);
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", polyToPathD(poly));
    p.dataset.strokeIndex = String(i);
    p.setAttribute("class", "stroke-base");
    s.appendChild(p);
  });

   // 先生用オーバーレイ（表示だけ）
  const teacherOverlay = document.createElementNS(ns, "g");
  teacherOverlay.setAttribute("class", "teacher-overlay");
  teacherOverlay.dataset.role = "teacherOverlay";
  strokes.forEach((poly, i) => {
    const p0 = poly?.[0];
    if (!p0) return;
    const { x, y } = p0;

    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("class", "teacher-start-dot");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", "3.2");
    teacherOverlay.appendChild(dot);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("class", "teacher-start-num");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y + 2.4));
    label.setAttribute("text-anchor", "middle");
    label.textContent = String(i + 1);
    teacherOverlay.appendChild(label);
  });
  s.appendChild(teacherOverlay);

  // 現在ストローク強調（濃い）
  const active = document.createElementNS(ns, "path");
  active.setAttribute("class", "stroke-active");
  active.setAttribute("d", polyToPathD(strokes[0]));
  active.dataset.role = "active";
  s.appendChild(active);

  // 当たり判定（透明の太線）
  strokes.forEach((poly, i) => {
    const hit = document.createElementNS(ns, "path");
    hit.setAttribute("d", polyToPathD(poly));
    hit.dataset.strokeIndex = String(i);
    hit.setAttribute("class", "stroke-hit");
    s.appendChild(hit);
  });

  // ユーザーの軌跡
  tracePathEl = document.createElementNS(ns, "path");
  tracePathEl.setAttribute("class", "trace-line");
  tracePathEl.setAttribute("d", "");
  tracePathEl.dataset.role = "trace";
  s.appendChild(tracePathEl);

  // キャラレイヤー（丸キャラ：後で画像差し替え可）
  const charLayer = document.createElementNS(ns, "g");
  charLayer.dataset.role = "charLayer";
  charLayer.setAttribute("class", "char-layer");
  s.appendChild(charLayer);

  const ch = document.createElementNS(ns, "circle");
  ch.dataset.role = "char";
  ch.setAttribute("class", "char");
  ch.setAttribute("r", "3.2");
  ch.setAttribute("cx", "0");
  ch.setAttribute("cy", "0");
  // 初期位置：1画目の開始点
  const p0 = getStrokeAnchor(strokes, 0);
  ch.setAttribute("transform", `translate(${p0.x} ${p0.y})`);
  s.dataset.charX = String(p0.x);
  s.dataset.charY = String(p0.y);
  charLayer.appendChild(ch);
  // FXレイヤー（成功/失敗演出用）
  // ※ build時に作っておくと毎回探さなくて済む
  const fx = document.createElementNS(ns, "g");
  fx.dataset.role = "fx";
  fx.setAttribute("class", "fx-layer");
  s.appendChild(fx);

  return s;
}

function emphasizeGoalShadow(svgEl, strokeIndex) {
    const p = svgEl.querySelector(
      `path.stroke-shadow[data-stroke-index="${strokeIndex}"]`
    );
    if (!p) return;
    p.classList.add("goal");
    // はなまる演出前に少し余韻を残して外す
    setTimeout(() => p.classList.remove("goal"), 700);
  }

function attachTraceHandlers(svgEl, strokes) {
  drawing = false;
  points = [];
  if (tracePathEl) tracePathEl.setAttribute("d", "");
  // 念のため（renderでbuild済みだが、再アタッチ時の保険）
  ensureChar(svgEl);

  const onDown = (e) => {
    if (kanjiCompleted) return;
    if (e.button != null && e.button !== 0) return;

    // stroke-hit上ならそれを優先して判定。外してても「線の近く」なら開始OKにする。
    const targetStroke = getStrokeIndexFromEvent(e); // null あり
    // 開始点チェック（ゆるめ）
    // ストローク点列が「逆順」になっているSVGがあり、先頭点だけを始点にすると
    // 2画目以降が永遠に始まらない、という症状が起きる。
    const p0 = toSvgPoint(svgEl, e.clientX, e.clientY);
    const poly = strokes[strokeIndex];
    if (!poly || poly.length < 2) return;
    const end0 = poly[0];
    const end1 = poly[poly.length - 1];
    const dEnd = Math.min(dist(p0, end0), dist(p0, end1));
    if (dEnd > START_TOL) return;

    if (targetStroke != null) {
      if (targetStroke !== strokeIndex) return;
    } else {
      // 当たりから外しても、今の画の線に近ければ開始OK（小学生向け）
      const d0 = distancePointToPolyline(p0, strokes[strokeIndex]);
      if (d0 > START_TOL) return;
    }

    drawing = true;
    points = [p0];
    updateTracePath(points);

    try {
      svgEl.setPointerCapture(e.pointerId);
    } catch (_) {}

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

    try {
      svgEl.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const ok = judgeTrace(points, strokes[strokeIndex]);
    const lastPoint = points.length ? points[points.length - 1] : null;

    // 軌跡は毎回消す
    points = [];
    updateTracePath(points);

    if (ok) {
      done[strokeIndex] = true;
      strokeIndex++;

       // ✅ 最後の画に着地したら「ゴールの道」を強調
      if (strokeIndex === strokes.length) {
          emphasizeGoalShadow(svgEl, strokes.length - 1);
        }
       // ✅ 成功：次の画の開始点へジャンプ（最後の画ならそのまま）
      const nextAnchor =
        strokeIndex < strokes.length
          ? getStrokeAnchor(strokes, strokeIndex)
          : getStrokeAnchor(strokes, strokes.length - 1);
      charJumpTo(svgEl, nextAnchor);

      refreshSvgStates(svgEl, strokes);
      renderStrokeButtons(strokes.length);
      // ✅ 成功演出
      pulse(svgEl);
      spawnSparks(svgEl, lastPoint || centroidOfPolyline(strokes[Math.max(0, strokeIndex - 1)]));
      playSuccessSfx();

      // ✅ 着地点にも小さくキラ（キャラの着地に合わせて）
      setTimeout(() => {
          // 途中で画面遷移/クリア等が走っていても安全に
          if (!svgEl || !svgEl.isConnected) return;
          spawnSparks(svgEl, nextAnchor, 6);
        }, 420); // charJumpToの着地付近（duration 520msの中の終盤）
       // ✅ 1文字（全画）クリア → 自動で次の漢字へ
      if (strokeIndex >= strokes.length) {
        kanjiCompleted = true;
        
                // 表示としては「最後の画」を維持（activeが配列外参照しないように）
                strokeIndex = strokes.length - 1;
                refreshSvgStates(svgEl, strokes);
                renderStrokeButtons(strokes.length);
        
                const set = getSetInfo(idx);
        
                // ✅ セット内なら：少し待って自動で次の漢字へ
                if (set.pos < set.len - 1) {
                  setTimeout(() => {
                    // 途中で手動で移動されていたら二重遷移しない
                    if (!kanjiCompleted) return;
                    move(1);
                  }, AUTO_NEXT_DELAY_MS);
                } else {
                  // ✅ セット最終：はなまる → メニュー表示（自動で進めない）
                  showHanamaru(svgEl);
        
                  // はなまるの余韻を見せてからメニュー
                  setTimeout(() => {
                    if (!kanjiCompleted) return;
                    showFinalMenu({
                      onReplay: () => {
                        closeFinalMenu();
                        idx = set.start;
                        kanjiCompleted = false;
                        render();
                      },
                      onNextSet: () => {
                        closeFinalMenu();
                        const nextStart = set.end >= items.length ? 0 : set.end;
                        idx = nextStart;
                        kanjiCompleted = false;
                        render();
                      },
                    });
                  }, 900);
                }
              }
        
     } else {
      // ✅ 失敗演出
      shake(svgEl);
      flashFail(svgEl);
      playFailSfx();
      // ✅ 失敗：ぽよんと落下→0.5秒で復帰（自動）
      charFailDrop(svgEl);
    }

    e.preventDefault();
  };
  function centroidOfPolyline(poly) {
      if (!poly || poly.length === 0) return { x: 50, y: 50 };
      let x = 0, y = 0;
      for (const p of poly) { x += p.x; y += p.y; }
      return { x: x / poly.length, y: y / poly.length };
    }
  svgEl.addEventListener("pointerdown", onDown, { passive: false });
  svgEl.addEventListener("pointermove", onMove, { passive: false });
  svgEl.addEventListener("pointerup", finish, { passive: false });
  svgEl.addEventListener("pointercancel", finish, { passive: false });
}

function refreshSvgStates(svgEl, strokes) {
  const basePaths = Array.from(svgEl.querySelectorAll("path.stroke-base"));
  basePaths.forEach((p) => {
    const i = Number(p.dataset.strokeIndex);
    if (Number.isFinite(i) && done[i]) p.classList.add("done");
    else p.classList.remove("done");
  });

  // ✅ 足場（影）：done の画だけ表示
  const shadowPaths = Array.from(svgEl.querySelectorAll("path.stroke-shadow"));
  shadowPaths.forEach((p) => {
    const i = Number(p.dataset.strokeIndex); // ← これが必要（未定義 i の修正）
    if (!Number.isFinite(i)) return;
    const shouldOn = !!done[i];
    const wasOn = p.classList.contains("on");
    if (shouldOn) {
      p.classList.add("on");
      // いま初めてONになった瞬間だけ pop
      if (!wasOn) {
        p.classList.remove("pop");
        // reflow してアニメを確実に再生
        void p.getBBox();
        p.classList.add("pop");
        setTimeout(() => p.classList.remove("pop"), 320);
      }
    } else {
      p.classList.remove("on");
      p.classList.remove("pop");
    }
  });

  const active = svgEl.querySelector('path[data-role="active"]');
  if (!active) return;

  const nextIdx = clamp(strokeIndex, 0, strokes.length - 1);
  active.setAttribute("d", polyToPathD(strokes[nextIdx]));
}

function getStrokeIndexFromEvent(e) {
  const t = e.target;
  if (!t) return null;

  // stroke-hit 以外は対象外
  if (!(t instanceof SVGPathElement)) return null;
  if (!t.classList.contains("stroke-hit")) return null;

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
  if (!drawnPoints || drawnPoints.length < 4) return false;

  // 始点チェックは「端点どちらでもOK」にする
  //（SVGによって点列の向きが逆で、strokePoly[0] が“終点”になることがある）
  const start = drawnPoints[0];
  const a = strokePoly[0];
  const b = strokePoly[strokePoly.length - 1];
  if (Math.min(dist(start, a), dist(start, b)) > START_TOL) return false;

  const strokeLen = polyLength(strokePoly);
  const drawnLen = polyLength(drawnPoints);
  if (strokeLen <= 0 || drawnLen < strokeLen * MIN_DRAW_LEN_RATE) return false;

  let hit = 0;
  for (const p of drawnPoints) {
    const d = distancePointToPolyline(p, strokePoly);
    if (d <= TOLERANCE) hit++;
  }
  const rate = hit / drawnPoints.length;
  if (rate < MIN_HIT_RATE) return false;

  // 追加：ストローク全体をある程度なぞったか（“なぞった感”）
  // 緩めに：全体の45%くらいの点が近ければOK
  const samples = samplePolyline(strokePoly, 24);
  let cover = 0;
  for (const sp of samples) {
    const d = distancePointToPolyline(sp, drawnPoints);
    if (d <= TOLERANCE * 1.1) cover++;
  }
  const coverRate = cover / samples.length;
  return coverRate >= 0.45;
}

// polyline を均等サンプリング
function samplePolyline(poly, n) {
    const out = [];
    if (!poly || poly.length === 0) return out;
    if (poly.length === 1) return Array.from({ length: n }, () => ({ ...poly[0] }));
  
    const L = polyLength(poly);
    if (L <= 0) return Array.from({ length: n }, () => ({ ...poly[0] }));
  
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * L;
      out.push(pointAtLength(poly, t));
    }
    return out;
  }
  
  function pointAtLength(poly, t) {
    let acc = 0;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      const seg = dist(a, b);
      if (seg <= 0) continue;
      if (acc + seg >= t) {
        const r = (t - acc) / seg;
        return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
      }
      acc += seg;
    }
    return { ...poly[poly.length - 1] };
  }

// --- Geometry helpers ---

function toSvgPoint(svgEl, clientX, clientY) {
  // getBoundingClientRect ベースだと preserveAspectRatio の余白分でズレる（=書き始めがズレる）
  // SVGの座標変換に正しく従うため、CTM 逆変換を使う。
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;

  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const p = pt.matrixTransform(inv);
  return { x: p.x, y: p.y };
}

function polyToPathD(poly) {
  if (!poly || poly.length === 0) return "";
  const [p0, ...rest] = poly;
  return (
    `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` +
    rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
  );
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

function readTeacherMode() {
    const qp = new URLSearchParams(location.search).get("teacher");
    if (qp === "1" || qp === "true") return true;
    if (qp === "0" || qp === "false") return false;
    try {
      return localStorage.getItem(TEACHER_MODE_KEY) === "1";
    } catch {
      return false;
    }
  }
  
  function writeTeacherMode(v) {
    try {
      localStorage.setItem(TEACHER_MODE_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
  }
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  );
}
function pulse(el) {
  if (!el) return;
  el.classList.remove("tracePulse");
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
