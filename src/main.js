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
const DATA_PATH = new URL("data/kanji_g1_proto.json", BASE_URL).toString();
// 個別strokes JSON の基点（strokesRef を使う）
const STROKES_BASE = new URL("data/strokes/", BASE_URL).toString();
// 遅延ロードしてキャッシュ（keyはstrokesRef）
const strokesCache = new Map(); // strokesRef -> Promise<polylines>

// ---------------------------
// 判定（子ども向け／安定版）
// 0..100 のSVG座標系（viewBox前提）
// ---------------------------
const TOLERANCE = 20; // 線からの許容距離（子ども向けに甘く）
const START_TOL = 34; // 書き始めの近さ（開始ズレをさらに吸収）

// なぞり側の「線に近い」割合（ゆるめ）
const MIN_HIT_RATE = 0.45;
// 目標線長に対する「描いた長さ」最低比（短い画でも通す）
const MIN_DRAW_LEN_RATE = 0.15;
// 目標線の「カバー率」最低比（チート防止＆安定化）
const MIN_COVER_RATE = 0.35;

// 入力点が少ない端末でも落ちないように
const MIN_POINTS = 3;
// 微小な揺れは間引く
const MIN_MOVE_EPS = 0.35;
// 判定用に一定間隔で再サンプル（点密度を安定化）
const RESAMPLE_STEP = 1.2;
// カバー判定用のサンプル数
const COVER_SAMPLES = 32;
const COVER_TOL = TOLERANCE * 1.15;


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



// ============================
// Hint text (kid-friendly)
// ============================
const elHint = document.getElementById("hint");
function setHintText(text) {
  if (!elHint) return;
  elHint.textContent = String(text ?? "");
}
function updateHintText() {
  // Prefer very short, action-oriented messages.
  if (kanjiCompleted) {
    setHintText('クリア！「つぎ」で次のもじへ');
    return;
  }
  if (drawing) {
    setHintText("そのまま、なぞっていこう");
    return;
  }
  // ✅ 連続失敗救済が発動中（同じ画でミスが続いた）なら、優しい文言に切り替え
  const streak = Math.max(0, failStreak?.[strokeIndex] ?? 0);
  if (streak >= 2) {
    setHintText("だいじょうぶ！ゆっくりでOK");
    return;
  } else if (streak === 1) {
    setHintText("もういちど。ゆっくりでOK");
    return;
  }

  const next = strokeIndex + 1;
  // ①②③… (1-20)
  const circled = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const mark = next >= 1 && next <= circled.length ? circled[next - 1] : String(next);
  setHintText(`${mark}のところから、なぞろう`);
}

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
let failStreak = []; // 連続失敗救済（画ごと）
let svg = null;
let hintDot = null;
let hintNum = null;
let currentStrokes = null;

// 1文字クリア後の自動進行（演出の余韻用）
const AUTO_NEXT_DELAY_MS = 650;
let kanjiCompleted = false;

// トレース中
let drawing = false;
let points = [];
let tracePathEl = null;
let inputLocked = false; // ✅ 演出中の入力無効

// Cで設定したアニメ時間に合わせる（charJumpTo / charFailDrop と揃える）
const JUMP_MS = 520;
const FAIL_MS = 520;

// ============================
// Progress (kid mode): save/restore full state (v2)
// ============================
const PROGRESS_LS_KEY = "ktj_progress_v2";

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    return p;
  } catch {
    return null;
  }
}

function saveProgress(p) {
  try {
    localStorage.setItem(PROGRESS_LS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

// v1互換：昔の key(ktj_progress_v1) が残っていたら idx だけ拾えるようにする
function loadProgressCompat() {
  // v2優先
  const v2 = loadProgress();
  if (v2) return { v: 2, ...v2 };

  // v1( idxのみ ) を拾う
  try {
    const raw1 = localStorage.getItem("ktj_progress_v1");
    if (!raw1) return null;
    const p1 = JSON.parse(raw1);
    if (p1 && Number.isFinite(p1.idx)) return { v: 1, idx: p1.idx };
  } catch {
    // ignore
  }
  return null;
}

function saveProgressState({ idx, strokeIndex, done, kanjiCompleted }) {
  saveProgress({
    v: 2,
    idx: Number.isFinite(idx) ? idx : 0,
    strokeIndex: Number.isFinite(strokeIndex) ? strokeIndex : 0,
    done: Array.isArray(done) ? done.map(Boolean) : [],
    kanjiCompleted: !!kanjiCompleted,
    t: Date.now(),
  });
}

function updateNavDisabled() {
  // 未クリアなら押せない
  const locked = !kanjiCompleted;
  if (elPrev) elPrev.disabled = locked || idx === 0;
  if (elNext) elNext.disabled = locked || idx === items.length - 1;
}

boot();

// ✅ A-5：離脱・タブ切替時に進捗を確実に保存
window.addEventListener("beforeunload", () => {
    safeSaveNow();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) safeSaveNow();
  }, { passive: true });

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

 // ✅ 進捗復帰：まず idx だけ復元（strokesはrender内で確定するため）
  const prog = loadProgressCompat();
  if (prog && Number.isFinite(prog.idx)) {
    idx = clamp(prog.idx, 0, items.length - 1);
  }

  await render();
}

async function loadData() {
  const res = await fetch(DATA_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${DATA_PATH})`);
  const json = await res.json();

  // ✅ 80字リスト（配列）
  if (Array.isArray(json)) {
        // strokesRef が無い行は id から補完（B案：idファイル名）
        return json.map((it) => {
          const id = it?.id;
          const grade = it?.grade ?? 1;
          const fallbackRef = id ? `g${grade}/${id}.json` : null;
          return {
            ...it,
            strokesRef: it?.strokesRef ?? fallbackRef,
          };
        });
      }

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
   // ✅ 移動したら保存（復帰用）
  // ✅ 移動時：その文字の途中状態は捨てて「idxだけ」保存（安定優先）
  saveProgressState({ idx, strokeIndex: 0, done: [], kanjiCompleted: false });

  render();
}

async function render() {
  clearError();
  kanjiCompleted = false;

  const item = items[idx];
  const k = item?.kanji ?? "?";

  const set = getSetInfo(idx);

  renderStars(set.pos, set.len);
  elLabel.textContent = `${k} (${set.pos + 1}/${set.len})`;

  // ✅ strokesは個別JSONからロード（キャッシュ）
  elArea.innerHTML = `<div style="font-size:20px; opacity:.7; font-weight:700;">よみこみ中…</div>`;
  // strokesRef 優先（無ければ kanji からの旧方式は最終フォールバック）
  const strokes = await getStrokesForItem(item);
  if (!strokes || strokes.length === 0) {
    elArea.innerHTML = `<div style="font-size:96px; opacity:.35; font-weight:700;">${escapeHtml(k)}</div>`;
    elStrokeButtons.innerHTML = "";
    updateNavDisabled();
    return;
  }

   // 初期化
  done = new Array(strokes.length).fill(false);
  strokeIndex = 0;
  failStreak = new Array(strokes.length).fill(0);

  // ✅ 進捗復元（同じ idx のときだけ）
  const prog = loadProgressCompat();
  if (prog && Number.isFinite(prog.idx) && prog.idx === idx) {
    // done復元（長さをstrokesに合わせる）
    if (Array.isArray(prog.done) && prog.done.length) {
      for (let i = 0; i < strokes.length; i++) done[i] = !!prog.done[i];
    }

    // strokeIndex復元（範囲内に丸める）
    if (Number.isFinite(prog.strokeIndex)) {
      strokeIndex = clamp(prog.strokeIndex, 0, strokes.length);
    }

    // クリア状態復元（doneからも推定）
    kanjiCompleted =
      !!prog.kanjiCompleted || done.every(Boolean) || strokeIndex >= strokes.length;

    // strokeIndexが末尾以上なら表示上は最後の画に寄せる（active参照対策）
    if (strokeIndex >= strokes.length) strokeIndex = strokes.length - 1;
  }

  // ✅ A-3: 復元の保険（done[] と strokeIndex の矛盾を補正）
  // done が true の最大連続分から「次にやる画」を決める
  // 例：done=[true,true,false,...] → strokeIndex=2 が正
  const nextTodo = done.findIndex((v) => !v);
  if (nextTodo === -1) {
    // 全部doneならクリア扱い
    kanjiCompleted = true;
    strokeIndex = strokes.length - 1; // active参照対策
  } else {
    // 途中なら、その画を次のターゲットに固定（prog.strokeIndexよりdone優先）
    strokeIndex = clamp(nextTodo, 0, strokes.length - 1);
    // 途中なら未クリア
    kanjiCompleted = false;
  }

  renderStrokeButtons(strokes.length);

  elArea.innerHTML = "";
  svg = buildSvgForKanji(strokes);
  elArea.appendChild(svg);
  currentStrokes = strokes;
  // ✅ 復元した strokeIndex に合わせて見た目とキャラ位置を同期
  // done/active/hint を整える（activeは strokeIndex 参照）
  refreshSvgStates(svg, strokes);

  // キャラは「今なぞる画」のアンカーへ（クリア済みなら最後の画）
  const safeIdx = clamp(strokeIndex, 0, strokes.length - 1);
  const anchor = getStrokeAnchor(strokes, safeIdx);
  setCharPos(svg, anchor);

  // ヒント文言も復元状態に合わせる
  updateHintText();

  updateNavDisabled();

  attachTraceHandlers(svg, strokes);

  pulse(svg);
}
async function getStrokesForItem(item) {
    if (!item) return null;
    const ref = item.strokesRef;
  
    // 1) strokesRef があればそれを使う（推奨）
    if (ref) {
      if (!strokesCache.has(ref)) {
        const url = new URL(ref, STROKES_BASE).toString();
        const p = fetch(url, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => (j ? strokesJsonToPolylines(j) : null))
          .catch(() => null);
        strokesCache.set(ref, p);
      }
      return await strokesCache.get(ref);
    }
  // 2) 最終フォールバック（旧）：kanji名.json
  const kanji = item.kanji;
  if (!kanji) return null;
  const legacyRef = `g1/${encodeURIComponent(kanji)}.json`;
  if (!strokesCache.has(legacyRef)) {
    const url = new URL(legacyRef, STROKES_BASE).toString();
    const p = fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? strokesJsonToPolylines(j) : null))
      .catch(() => null);
    strokesCache.set(legacyRef, p);
  }
  return await strokesCache.get(legacyRef);
}
  function strokesJsonToPolylines(j) {
    // { kanji, strokeCount, strokes:[{path,start,...}] }
    if (!j || !Array.isArray(j.strokes)) return null;
    const out = [];
    for (const s of j.strokes) {
      if (!s?.path) continue;
      // KanjiVGは曲線(C/Q)が多いので、必ずサンプリングで点列化する
    out.push(pathDToPolylineBySampling(s.path, 36));
    }
    return out;
  }

  // KanjiVGのC/Q等を含むpathでも確実に点列化するため、SVGPathElementでサンプリングする
function pathDToPolylineBySampling(d, samples = 36) {
    const ns = "http://www.w3.org/2000/svg";
    // オフスクリーンのSVG/pathを作って長さから点を取る
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", String(d));
    svg.appendChild(p);
  
    let len = 0;
    try {
      len = p.getTotalLength();
    } catch {
      // 万一壊れたdなら空
      return [];
    }
    if (!Number.isFinite(len) || len <= 0.01) return [];
  
    const pts = [];
    const n = Math.max(8, samples); // 少なすぎると判定が荒れる
    for (let i = 0; i <= n; i++) {
      const dist = (len * i) / n;
      const pt = p.getPointAtLength(dist);
      pts.push({ x: +pt.x.toFixed(2), y: +pt.y.toFixed(2) });
    }
  
    // 連続重複点を軽く除去（ゼロ長セグメント対策）
    const compact = [];
    for (const q of pts) {
      const prev = compact[compact.length - 1];
      if (!prev || Math.hypot(prev.x - q.x, prev.y - q.y) > 0.01) compact.push(q);
    }
    return compact;
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
       const from = getCharPos(svgEl);
       const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 10 }; // 少し上に跳ぶ
    
       // 既存アニメが残っていても見た目破綻しないように
       c.getAnimations().forEach((a) => a.cancel());
    
       // Web Animations は CSS transform として解釈されるので px とカンマを付ける
       const kf = (p, sx = 1, sy = 1) => ({
         transform: `translate(${p.x}px, ${p.y}px) scale(${sx}, ${sy})`,
       });
    
       c.animate(
         [
           kf(from, 1, 1),          // 離陸
           kf(mid, 1.08, 1.08),     // ジャンプ中：少し大きく
           kf(to, 1, 1),            // 着地
           kf(to, 1.12, 0.88),      // ぷにっ
           kf(to, 1, 1),            // もどる
         ],
         { duration: 520, easing: "ease-out", fill: "forwards" }
       );
    
       // SVG transform（viewBox座標）として確定
       setTimeout(() => setCharPos(svgEl, to), 540);
     }

     function charFailDrop(svgEl) {
         const c = ensureChar(svgEl);
         const base = getCharPos(svgEl);
         const down = { x: base.x, y: base.y + 14 };
      
         c.getAnimations().forEach((a) => a.cancel());
      
         const kf = (p, sx = 1, sy = 1) => ({
           transform: `translate(${p.x}px, ${p.y}px) scale(${sx}, ${sy})`,
         });
      
         c.animate(
           [
             kf(base, 1, 1),          // その場
             kf(down, 0.92, 1.10),    // 落下
             kf(base, 1, 1),          // 復帰
             kf(base, 1.12, 0.88),    // ぷにっ
             kf(base, 1, 1),          // もどる
           ],
           { duration: 520, easing: "ease-out", fill: "forwards" }
         );
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

  // =========================================================
  // Layers (fixed order): bg → road → char → stroke → hint
  // =========================================================
  const bgLayer = document.createElementNS(ns, "g");
  bgLayer.dataset.role = "bgLayer";

  const roadLayer = document.createElementNS(ns, "g");
  roadLayer.dataset.role = "roadLayer";

  const charLayer = document.createElementNS(ns, "g");
  charLayer.dataset.role = "charLayer";
  charLayer.setAttribute("class", "char-layer");

  const strokeLayer = document.createElementNS(ns, "g");
  strokeLayer.dataset.role = "strokeLayer";

  const hintLayer = document.createElementNS(ns, "g");
  hintLayer.dataset.role = "hintLayer";

  // append in strict order
  s.appendChild(bgLayer);
  s.appendChild(roadLayer);
  s.appendChild(charLayer);
  s.appendChild(strokeLayer);
  s.appendChild(hintLayer);

  // Road (shadow) + Stroke base
  strokes.forEach((poly, i) => {
    // ✅ 足場（影）：doneになった画だけ表示する（road layer）
    const shadow = document.createElementNS(ns, "path");
    shadow.setAttribute("d", polyToPathD(poly));
    shadow.dataset.strokeIndex = String(i);
    shadow.setAttribute("class", "stroke-shadow");
    roadLayer.appendChild(shadow);

    // ✅ ベース線（stroke layer）
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", polyToPathD(poly));
    p.dataset.strokeIndex = String(i);
    p.setAttribute("class", "stroke-base");
    strokeLayer.appendChild(p);
  });

  // Hint: child stroke hint (current only)
  const hintG = document.createElementNS(ns, "g");
  hintG.dataset.role = "strokeHint";
  hintG.setAttribute("pointer-events", "none");

  const hintDotEl = document.createElementNS(ns, "circle");
  hintDotEl.dataset.role = "strokeHintDot";
  // UI微調整：始点〇が大きすぎるので小さく
  hintDotEl.setAttribute("r", "8");
  hintDotEl.setAttribute("class", "stroke-hint-dot");

  const hintTextEl = document.createElementNS(ns, "text");
  hintTextEl.dataset.role = "strokeHintNum";
  hintTextEl.setAttribute("class", "stroke-hint-num");
  hintTextEl.setAttribute("text-anchor", "middle");
  hintTextEl.setAttribute("dominant-baseline", "middle");

  hintG.appendChild(hintDotEl);
  hintG.appendChild(hintTextEl);
  hintLayer.appendChild(hintG);

  // グローバル参照（次の画だけ表示用）
  hintDot = hintDotEl;
  hintNum = hintTextEl;

  // Teacher overlay（表示だけ。CSSで kidでは非表示にしてOK）
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
  hintLayer.appendChild(teacherOverlay);

  // 現在ストローク強調（濃い）
  const active = document.createElementNS(ns, "path");
  active.setAttribute("class", "stroke-active");
  active.setAttribute("d", polyToPathD(strokes[0]));
  active.dataset.role = "active";
  strokeLayer.appendChild(active);


  // 当たり判定（透明の太線）
  strokes.forEach((poly, i) => {
    const hit = document.createElementNS(ns, "path");
    hit.setAttribute("d", polyToPathD(poly));
    hit.dataset.strokeIndex = String(i);
    hit.setAttribute("class", "stroke-hit");
    strokeLayer.appendChild(hit);
  });

  // ユーザーの軌跡
  tracePathEl = document.createElementNS(ns, "path");
  tracePathEl.setAttribute("class", "trace-line");
  tracePathEl.setAttribute("d", "");
  tracePathEl.dataset.role = "trace";
  strokeLayer.appendChild(tracePathEl);

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
  // 演出は stroke の上、hint の下が扱いやすい
  strokeLayer.appendChild(fx);
  return s;
}

function updateStrokeHint() {
    if (!svg || !hintDot || !hintNum || !currentStrokes) return;
    const stroke = currentStrokes[strokeIndex];
    if (!stroke || !stroke.length) {
      hintDot.style.display = "none";
      hintNum.style.display = "none";
      return;
    }
    const p0 = stroke[0];
    hintDot.style.display = "";
    hintNum.style.display = "";
    hintDot.setAttribute("cx", String(p0.x));
    hintDot.setAttribute("cy", String(p0.y));
    hintNum.setAttribute("x", String(p0.x));
    // ✅ 数字は「黒丸の中心」に置く（ズレると重なって見えやすい）
    hintNum.setAttribute("y", String(p0.y - 8));
    hintNum.textContent = String(strokeIndex + 1);
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

  function lockInput(ms) {
      inputLocked = true;
      // 万が一の取りこぼし対策で時間で解除（msは演出に合わせる）
      setTimeout(() => {
        inputLocked = false;
        // 状態文言を戻したい場合はここで updateHintText() を呼んでもOK
      }, ms);}

      // ===========================
// A-4/A-5: Safety finish & save
// ===========================
function safeSaveNow() {
    try {
      // strokes未ロード時もあるので done は配列かだけ保証
      saveProgressState({
        idx,
        strokeIndex: Number.isFinite(strokeIndex) ? strokeIndex : 0,
        done: Array.isArray(done) ? done : [],
        kanjiCompleted: !!kanjiCompleted,
      });
    } catch (_) {}
  }
  
  function cancelDrawingState(svgEl) {
    // 「描画中」状態だけを安全に解除（判定はしない）
    drawing = false;
    points = [];
    updateTracePath(points);
    inputLocked = false;
    updateHintText();
    // pointer captureが残っていれば解放（安全）
    try {
      // pointerIdが取れない場合もあるので、ここは失敗しても無視
      // releasePointerCapture は “現在キャプチャ中のpointerId” が必要だが、
      // 取れないケースがあるため try/catch で握る
      lastPointerId = e.pointerId;
      svgEl?.releasePointerCapture?.(0);
    } catch (_) {}
  }

function attachTraceHandlers(svgEl, strokes) {
  drawing = false;
  points = [];
  if (tracePathEl) tracePathEl.setAttribute("d", "");
  // 念のため（renderでbuild済みだが、再アタッチ時の保険）
  ensureChar(svgEl);
  let lastPointerId = null;
  const onDown = (e) => {
    if (kanjiCompleted) return;
    if (inputLocked) return;
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
    // 演出中は動かないが、入力開始したらロックはしない（ロックは成功/失敗で行う）
    updateHintText();
    // ✅ 開始点にスナップ（端点の近い方へ吸着）
    // 逆順ストロークでも始点が安定し、子どもの「ちょいズレ」で詰まらない
    const snapStart = dist(p0, end0) <= dist(p0, end1) ? end0 : end1;
    points = [snapStart];
    updateTracePath(points);

    try {
      svgEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
  };

  const onMove = (e) => {
    if (!drawing) return;
    if (inputLocked) return;
    const p = toSvgPoint(svgEl, e.clientX, e.clientY);
    points.push(p);
    updateTracePath(points);
    e.preventDefault();
  };

  const finish = (e) => {
    if (!drawing) return;
    if (inputLocked) return;
    drawing = false;

    try {
      if (lastPointerId != null) {
                svgEl.releasePointerCapture(lastPointerId);
              } else {
                svgEl.releasePointerCapture(e.pointerId);
              }
             } catch (_) {}
            lastPointerId = null;

    const ok = judgeTrace(points, strokes[strokeIndex]);
    const lastPoint = points.length ? points[points.length - 1] : null;

    // 軌跡は毎回消す
    points = [];
    updateTracePath(points);

    if (ok) {
      done[strokeIndex] = true;
      // ✅ 成功した画は救済カウントをリセット
      failStreak[strokeIndex] = 0;
      strokeIndex++;
      updateStrokeHint();
      // ✅ 1画進むたびに保存（途中再開の核）
      saveProgressState({ idx, strokeIndex, done, kanjiCompleted: false });

       // ✅ 最後の画に着地したら「ゴールの道」を強調
      if (strokeIndex === strokes.length) {
          emphasizeGoalShadow(svgEl, strokes.length - 1);
        }
       // ✅ 成功：次の画の開始点へジャンプ（最後の画ならそのまま）
      const nextAnchor =
        strokeIndex < strokes.length
          ? getStrokeAnchor(strokes, strokeIndex)
          : getStrokeAnchor(strokes, strokes.length - 1);
          // ✅ 成功演出中は入力無効（ジャンプ着地まで）
      lockInput(JUMP_MS);
      charJumpTo(svgEl, nextAnchor);

      refreshSvgStates(svgEl, strokes);
      renderStrokeButtons(strokes.length);
      updateHintText();
      // ✅ 成功演出
      pulse(svgEl);
      spawnSparks(svgEl, lastPoint || centroidOfPolyline(strokes[Math.max(0, strokeIndex - 1)]));
      playSuccessSfx();

      // ✅ 着地点にも小さくキラ（キャラの着地タイミングに合わせる）
      setTimeout(() => {
          if (!svgEl || !svgEl.isConnected) return;
          spawnSparks(svgEl, nextAnchor, 6);
        }, Math.max(0, JUMP_MS - 80));
       // ✅ 1文字（全画）クリア → 自動で次の漢字へ
      if (strokeIndex >= strokes.length) {
        kanjiCompleted = true;
        // ✅ クリアしたら「まえ/つぎ」を解放
        updateNavDisabled();
        // ✅ クリア状態を保存（次回来た時に再開/解放が正しくなる）
        saveProgressState({ idx, strokeIndex: strokes.length, done, kanjiCompleted: true });
        
                // 表示としては「最後の画」を維持（activeが配列外参照しないように）
                strokeIndex = strokes.length - 1;
                refreshSvgStates(svgEl, strokes);
                renderStrokeButtons(strokes.length);
                updateHintText();
        
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
      // ✅ 連続失敗救済：同じ画の失敗回数を加算（上限は judgeTrace 内で丸める）
      failStreak[strokeIndex] = (failStreak[strokeIndex] ?? 0) + 1;
      // ✅ 失敗演出中は入力無効（失敗演出まで）
      lockInput(FAIL_MS);
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

  // ✅ A-4仕上げ：予期せぬ中断（タブ切替/通知/画面ロック等）で詰まらないようにする
  const hardCancel = () => {
      if (!svgEl.isConnected) return;
      cancelDrawingState(svgEl);
    };
    window.addEventListener("blur", hardCancel, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hardCancel();
    }, { passive: true });
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

  // 子ども向け：次に書く1画だけヒント更新（ここで1回だけ）
  updateStrokeHint();
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

// ---------------------------
// ストローク長に応じた「自動調整」
// - 短い画：甘く（失敗しやすい）
// - 長い画：少し締める（雑クリア防止）
// ---------------------------
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function getAdaptiveParams(strokeLen) {
  // strokeLen: 0..200 くらい（viewBox=100の線分）
  // 12以下は「短い」、60以上は「長い」と見なす
  const short = 12;
  const long = 60;
  const t = clamp01((strokeLen - short) / (long - short)); // 0(短い)〜1(長い)

  // 許容距離：短いほど甘く、長いほど基準へ
  const tol = TOLERANCE + (1 - t) * 4;        // +0〜+4
  const coverTol = tol * 1.15;

  // 近い率：短いほど低くてOK、長いほど基準へ
  const minHit = MIN_HIT_RATE + t * 0.08;     // 0.45〜0.53

  // 描いた長さ：短いほど低くてOK、長いほど基準へ
  const minDraw = MIN_DRAW_LEN_RATE + t * 0.07; // 0.15〜0.22

  // カバー率：短いほど低くてOK、長いほど基準へ
  const minCover = MIN_COVER_RATE + t * 0.15; // 0.35〜0.50

  // 開始許容：短いほど広め（狙いにくい）、長いほど少し狭め
  const startTol = START_TOL - t * 6;         // 28〜22

  return { tol, coverTol, minHit, minDraw, minCover, startTol };
}

function judgeTrace(drawnPoints, strokePoly) {
  if (!Array.isArray(drawnPoints) || drawnPoints.length < MIN_POINTS) return false;

  // タッチ端末の「点が少ない／揺れる」を吸収するため、
  // いったん間引き→一定間隔に再サンプルして判定のブレを減らす
  const dp = normalizeDrawnPoints(drawnPoints, RESAMPLE_STEP, MIN_MOVE_EPS);
  if (dp.length < 2) return false;

  // start近さ（開始のズレは大きめに許す）
  const start = dp[0];
  const s0 = strokePoly[0];
  const strokeLen = polyLength(strokePoly);
  if (strokeLen <= 0) return false;

  // ✅ 長さに応じた自動調整
  const P = getAdaptiveParams(strokeLen);
  if (dist(start, s0) > P.startTol) return false;

  const drawnLen = polyLength(dp);
  if (drawnLen < strokeLen * P.minDraw) return false;
 // ✅ 連続失敗救済（小学生向け）
  // 同じ画でミスが続いたら、少しずつ甘くする（最大3段階）
  const streak = Math.max(0, Math.min(3, failStreak?.[strokeIndex] ?? 0));
  if (streak > 0) {
    const k = streak; // 1..3
    // 許容距離を少し広げる（最大 +6）
    P.tol += 3 * k;
    P.coverTol = P.tol * 1.15;
   // 閾値を下げる（最大 -0.18）
    P.minHit = Math.max(0.28, P.minHit - 0.06 * k);
    P.minCover = Math.max(0.18, P.minCover - 0.06 * k);
    // 始点許容も広げる（最大 +9）
    P.startTol += 3 * k; 
  }
  // (1) なぞり点の「線に近い率」
  let hit = 0;
  for (const p of dp) {
    if (distancePointToPolyline(p, strokePoly) <= P.tol) hit++;
  }
  const hitRate = hit / dp.length;

  // (2) 目標線の「カバー率」（線の上をある程度進んでるか）
  //   目標線を一定数サンプリングし、それぞれが描画線に近いかを見る
  const samples = sampleAlongPolyline(strokePoly, COVER_SAMPLES);
  let cover = 0;
  for (const sp of samples) {
    if (distancePointToPolyline(sp, dp) <= P.coverTol) cover++;
  }
  const coverRate = cover / samples.length;

  return hitRate >= P.minHit && coverRate >= P.minCover;
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


// ---------------------------
// 判定用の補助（イベント間引き／再サンプル）
// ---------------------------

function normalizeDrawnPoints(points, step = RESAMPLE_STEP, minMove = MIN_MOVE_EPS) {
  if (!Array.isArray(points) || points.length === 0) return [];

  // 連続の微小移動を間引く（タッチ端末での揺れ／過密を安定化）
  const compact = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = compact[compact.length - 1];
    const cur = points[i];
    if (dist(prev, cur) >= minMove) compact.push(cur);
  }
  if (compact.length < 2) return compact;

  // 一定間隔で再サンプル（点数が少ない端末でも判定が安定）
  return resamplePolyline(compact, step);
}

function resamplePolyline(poly, step) {
  const len = polyLength(poly);
  if (len <= 0) return poly.slice();

  const out = [];
  for (let d = 0; d <= len; d += step) {
    out.push(pointAtDistance(poly, d));
  }
  // 最後も必ず入れる
  const last = poly[poly.length - 1];
  const prev = out[out.length - 1];
  if (!prev || dist(prev, last) > 0.01) out.push({ x: last.x, y: last.y });
  return out;
}

function pointAtDistance(poly, d) {
  if (poly.length === 1) return { x: poly[0].x, y: poly[0].y };
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const seg = dist(a, b);
    if (acc + seg >= d) {
      const t = seg === 0 ? 0 : (d - acc) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += seg;
  }
  const last = poly[poly.length - 1];
  return { x: last.x, y: last.y };
}

function sampleAlongPolyline(poly, n) {
  const len = polyLength(poly);
  if (len <= 0) return poly.slice(0, 1);
  if (n <= 1) return [pointAtDistance(poly, len * 0.5)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = (len * i) / (n - 1);
    out.push(pointAtDistance(poly, d));
  }
  return out;
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
      return localStorage.getItem(TEACHER_MODE_LS_KEY) === "1";
    } catch {
      return false;
    }
  }
  
  function writeTeacherMode(v) {
    try {
      localStorage.setItem(TEACHER_MODE_LS_KEY, v ? "1" : "0");
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
