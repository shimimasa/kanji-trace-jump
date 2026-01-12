// src/game/startTraceGame.js
import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { markCleared, recordAttempt, saveProgress } from "../lib/progressStore.js";
import { addTitleToBook, getTitleMeta } from "../lib/titleBookStore.js";

export function startTraceGame({ rootEl, ctx, selectedRangeId, startFromId, startFromIdx, singleId, mode = "kid", onSetFinished }) {
  
  // ---------------------------
  // ✅ 旧 main.js の “定数” はここへ移植
  // ---------------------------
  const BASE_PATH = import.meta.env.BASE_URL ?? "/";
  const BASE_URL = new URL(BASE_PATH, window.location.href);

  const NEKO_URL = new URL("assets/characters/neko.png", BASE_URL).toString();
  const CHAR_SIZE = 14;

   // ✅ StepB: データは kanji_all + index_traceable を参照する
  const ALL_PATH = new URL("data/kanji/kanji_all.json", BASE_URL).toString();
  const TRACEABLE_PATH = new URL("data/kanji/index_traceable.json", BASE_URL).toString();
  // strokesRef は "strokes/g2/..." なので data/ をベースにする
  const STROKES_BASE = new URL("data/", BASE_URL).toString();

  // selectedRangeId から grade を抽出（例: kanji_g3 => 3）
  const gradeFromRange = (() => {
    const id = selectedRangeId ?? "kanji_g1";
    const m = String(id).match(/kanji_g(\d+)/);
    return m ? Number(m[1]) : null;
  })();
  const strokesCache = new Map();

  const SET_SIZE = 5;
  const AUTO_NEXT_DELAY_MS = 650;
  const isSingleMode = !!singleId;
  const baseModeText = isSingleMode ? "もくひょう：1もじ" : `もくひょう：${SET_SIZE}もじ`;
  const isMaster = mode === "master";
  const modeText = isMaster ? `${baseModeText}（MASTER）` : baseModeText;

  // 判定パラメータ（旧コードから）
  const TOLERANCE = 20;
  const START_TOL = 34;
  const MIN_HIT_RATE = 0.45;
  const MIN_DRAW_LEN_RATE = 0.15;
  const MIN_COVER_RATE = 0.35;
  const MIN_POINTS = 3;
  const MIN_MOVE_EPS = 0.35;
  const RESAMPLE_STEP = 1.2;
  const COVER_SAMPLES = 32;

  const JUMP_MS = 520;
  const FAIL_MS = 520;

  // ---------------------------
  // ✅ DOM（document直参照禁止）
  // ---------------------------
  const elStars = rootEl.querySelector("#stars");
  const elMode = rootEl.querySelector("#mode");
  const elLabel = rootEl.querySelector("#kanjiLabel");
  const elArea = rootEl.querySelector("#kanjiArea");
  const elStrokeButtons = rootEl.querySelector("#strokeButtons");
  const elTeacherToggle = rootEl.querySelector("#teacherToggle");
  const elPrev = rootEl.querySelector("#prevBtn");
  const elNext = rootEl.querySelector("#nextBtn");
  const elError = rootEl.querySelector("#error");
  const elHint = rootEl.querySelector("#hint");

  // ---------------------------
  // 状態（旧main.jsから）
  // ---------------------------
  let items = [];
  let idx = 0;

  let strokeIndex = 0;
  let done = [];
  let failStreak = [];
  let svg = null;
  let hintDot = null;
  let hintNum = null;
  let currentStrokes = null;

  let kanjiCompleted = false;
  let drawing = false;
  let points = [];
  let tracePathEl = null;
  let inputLocked = false;

  // ===========================
  // Phase2: Combo / FX / Sound
  // ===========================
  let combo = 0;
  let lastSuccessAt = 0;
  const COMBO_WINDOW_MS = 1400; // この時間内に成功するとコンボ継続

  // Stars sparkle
  let _lastStarFilled = 0;

  // Audio
  let _audioCtx = null;
  let teacherMode = false;

  // イベント解除用（グローバル / SVGで分離）
  const disposers = [];
  const svgDisposers = [];
  let moveTimer = null;
  let unlockTimer = null;
  let charJumpTimer = null;
  // ---------------------------
  // セット記録（旧main.jsから移植：必要最小）
  // ---------------------------
  let setRun = null;

   // --- Phase3: Set results / PB (old-main.js移植) ---
  const SET_RESULTS_LS_KEY = "ktj_set_results_v1";
  const SET_PB_LS_KEY = "ktj_set_pb_v1";

  function loadSetPBMap() {
    try {
      const raw = localStorage.getItem(SET_PB_LS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }
  function saveSetPBMap(map) {
    try { localStorage.setItem(SET_PB_LS_KEY, JSON.stringify(map)); } catch {}
  }
  function getSetKey(setStart, setLen) {
    return `${setStart}_${setLen}`;
  }
  function loadSetResults() {
    try {
      const raw = localStorage.getItem(SET_RESULTS_LS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveSetResult(entry) {
    try {
      const arr = loadSetResults();
      arr.unshift(entry);
      localStorage.setItem(SET_RESULTS_LS_KEY, JSON.stringify(arr.slice(0, 5)));
    } catch {}
  }

  function computeRank({ timeMs, accuracy, rescued, setLen }) {
    const basePerChar = 22_000;
    const base = Math.max(1, setLen) * basePerChar;
    const t = timeMs / base;
    const timeScore = t <= 0.7 ? 1 : t >= 1.4 ? 0 : 1 - (t - 0.7) / (1.4 - 0.7);
    const accScore = Math.max(0, Math.min(1, (accuracy ?? 0) / 100));
    const rp = Math.max(0, Math.min(0.25, (rescued ?? 0) * 0.03));
    const score = 0.55 * accScore + 0.45 * timeScore - rp;
    if (score >= 0.88 && accuracy >= 92) return { rank: "S", score };
    if (score >= 0.76 && accuracy >= 85) return { rank: "A", score };
    if (score >= 0.62) return { rank: "B", score };
    return { rank: "C", score };
  }
  function computeTitle({ rank, timeMs, accuracy, rescued, isNewPB, comboMax, setLen }) {
    const acc = Number.isFinite(accuracy) ? accuracy : 0;
    const res = Number.isFinite(rescued) ? rescued : 0;
    const t = Number.isFinite(timeMs) ? timeMs : 0;
    const len = Math.max(1, setLen || 5);
    const perChar = t / len;
    if (acc >= 100) return "ノーミス王";
    if (res === 0 && acc >= 92) return "きゅうさいゼロ王";
    if (isNewPB) return "新記録王";
    if (Number.isFinite(comboMax) && comboMax >= 8) return "連勝王";
    if (perChar <= 15_000) return "タイムアタック王";
    if (rank === "S") return acc >= 97 && res <= 1 ? "かんぺき王" : "スピード王";
    if (rank === "A") {
      if (acc >= 92 && res <= 2) return "ていねい王";
      if (res >= 4) return "あきらめない王";
      return "ナイス王";
    }
    if (rank === "B") {
      if (acc >= 85) return "のびしろ王";
      if (res >= 4) return "がんばり王";
      return "チャレンジ王";
    }
    if (acc >= 70) return "つぎはA王";
    return "スタート王";
  }
  function computeComment({ rank, accuracy, rescued, timeMs, setLen }) {
    const acc = Number.isFinite(accuracy) ? accuracy : 0;
    const res = Number.isFinite(rescued) ? rescued : 0;
    const t = Number.isFinite(timeMs) ? timeMs : 0;
    const len = Math.max(1, setLen || 5);
    const perChar = t / len;
    const fast = perChar <= 18_000;
    const careful = acc >= 92 && res <= 2;
    const persistent = res >= 4;
    const pick = (arr) => arr[(Math.random() * arr.length) | 0];
    if (rank === "S") return careful ? pick(["すごい！はやいのに ていねい！", "かんぺき！そのままいこう！"]) : pick(["はやい！ゲーマーの手だ！", "スピードが神！その調子！"]);
    if (rank === "A") {
      if (careful) return pick(["線がきれい！ていねいだね！", "いいね！おちついて書けてる！"]);
      if (persistent) return pick(["あきらめないのが一番つよい！", "ねばり勝ち！えらい！"]);
      return pick(["ナイス！この調子でOK！", "あとちょっとでSいける！"]);
    }
    if (rank === "B") {
      if (fast) return pick(["けっこう速い！つぎは ていねいさも！", "スピードいいね！線を意識！"]);
      if (careful) return pick(["ていねい！あとは少しスピード！", "きれいに書けてる！"]);
      if (persistent) return pick(["がんばりが勝つ！続けよう！", "くり返すほど上手になる！"]);
      return pick(["いいスタート！つぎはAめざそう！", "あと1こずつ良くしていこう！"]);
    }
    if (persistent) return pick(["やめなかったのが勝ち！", "つぎは ぜったい進むよ！"]);
    return pick(["OK！まずは1こずつ！", "はじめはみんなここから！"]);
  }
  function getSetInfo(i = idx) {
    if (isSingleMode) {
              return { start: 0, end: 1, len: 1, pos: 0 };
            }
    const start = Math.floor(i / SET_SIZE) * SET_SIZE;
    const end = Math.min(start + SET_SIZE, items.length);
    const len = end - start;
    const pos = i - start;
    return { start, end, len, pos };
  }

  function startSetRun(set) {
    setRun = {
      setStart: set.start,
      setLen: set.len,
      startedAt: Date.now(),
      attempts: 0,
      success: 0,
      fail: 0,
      rescued: 0,
      kanjiCleared: 0,
      combo: 0,
      comboMax: 0,
    };
  }
  function ensureSetRun(set) {
    if (!setRun || setRun.setStart !== set.start || setRun.setLen !== set.len) startSetRun(set);
  }

  function finalizeSetRun() {
    if (!setRun) return null;
    const timeMs = Date.now() - setRun.startedAt;
    const total = Math.max(0, setRun.attempts);
    const accuracy = total > 0 ? Math.round((setRun.success / total) * 100) : 0;
    const result = {
      at: Date.now(),
      setStart: setRun.setStart,
      setLen: setRun.setLen,
      timeMs,
      timeText: formatMs(timeMs),
      attempts: setRun.attempts,
      success: setRun.success,
      fail: setRun.fail,
      rescued: setRun.rescued,
      accuracy,
      combo: setRun.combo,
      comboMax: setRun.comboMax,
    };
    // Rank
    const rk = computeRank({
          timeMs: result.timeMs,
          accuracy: result.accuracy,
          rescued: result.rescued,
          setLen: result.setLen,
        });
        result.rank = rk.rank;
        result.rankScore = rk.score;
    
        // PB（最速）
        const pbMap = loadSetPBMap();
        const key = getSetKey(result.setStart, result.setLen);
        const prev = pbMap?.[key]?.timeMs;
        const hasPrev = Number.isFinite(prev);
        const isNewPB = !hasPrev || result.timeMs < prev;
        if (isNewPB) {
          pbMap[key] = { timeMs: result.timeMs, at: result.at };
          saveSetPBMap(pbMap);
        }
        result.personalBestMs = isNewPB ? result.timeMs : prev;
        result.personalBestText = formatMs(result.personalBestMs);
        result.isNewPB = isNewPB;
    
        // Title / Comment（PB判定後）
        result.title = computeTitle({
          rank: result.rank,
          timeMs: result.timeMs,
          accuracy: result.accuracy,
          rescued: result.rescued,
          setLen: result.setLen,
          isNewPB: !!result.isNewPB,
          comboMax: result.comboMax,
        });
        result.comment = computeComment({
          rank: result.rank,
          accuracy: result.accuracy,
          rescued: result.rescued,
          timeMs: result.timeMs,
          setLen: result.setLen,
        });

        addTitleToBook({
            title: result.title,
            rank: result.rank,
            rarity: getTitleMeta(result.title)?.rarity ?? null,
            at: result.at,
          });
    
        // 履歴に保存（最新5件）
        saveSetResult(result);
        return result;
  }

  function formatMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
    function ensureFxLayer(svgEl) {
        const ns = "http://www.w3.org/2000/svg";
        let layer = svgEl.querySelector('[data-role="fx"]');
        if (layer) return layer;
        layer = document.createElementNS(ns, "g");
        layer.dataset.role = "fx";
        layer.setAttribute("class", "fx-layer");
        svgEl.appendChild(layer);
        return layer;
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
          const d = 6 + Math.random() * 10;
          const dx = Math.cos(a) * d;
          const dy = Math.sin(a) * d;
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
    
      function showComboPop(svgEl, text) {
        const ns = "http://www.w3.org/2000/svg";
        const layer = ensureFxLayer(svgEl);
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", "50");
        t.setAttribute("y", "18");
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("class", "fx-combo-text");
        t.textContent = text;
        layer.appendChild(t);
        const anim = t.animate(
          [
            { transform: "translate(0px, 6px) scale(0.9)", opacity: 0 },
            { transform: "translate(0px, 0px) scale(1.05)", opacity: 1 },
            { transform: "translate(0px, -8px) scale(1)", opacity: 0 },
          ],
          { duration: 520, easing: "ease-out", fill: "forwards" }
        );
        anim.onfinish = () => t.remove();
      }
    
      function showHanamaru(svgEl) {
        const ns = "http://www.w3.org/2000/svg";
        const layer = ensureFxLayer(svgEl);
        const g = document.createElementNS(ns, "g");
        g.setAttribute("class", "hanamaru");
        g.setAttribute("transform", "translate(50 50) scale(0)");
        layer.appendChild(g);
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("cx", "0");
        c.setAttribute("cy", "0");
        c.setAttribute("r", "26");
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", "#ff7a00");
        c.setAttribute("stroke-width", "6");
        c.setAttribute("stroke-linecap", "round");
        g.appendChild(c);
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", "0");
        t.setAttribute("y", "10");
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "18");
        t.setAttribute("font-weight", "700");
        t.setAttribute("fill", "#ff7a00");
        t.textContent = "はなまる！";
        g.appendChild(t);
        g.animate(
          [
            { transform: "translate(50px,50px) scale(0)", opacity: 0 },
            { transform: "translate(50px,50px) scale(1.15)", opacity: 1 },
            { transform: "translate(50px,50px) scale(1)", opacity: 1 },
          ],
          { duration: 420, easing: "ease-out", fill: "forwards" }
        );
        // 小さめファンファーレ
        playTone(880, 0.08, "sine", 0.06);
        setTimeout(() => playTone(1175, 0.1, "sine", 0.05), 90);
        sparkleStars();
        setTimeout(() => g.remove(), 1200);
      }
    
      function playSetClearFanfare() {
        const seq = [
          { f: 659, d: 0.08 },
          { f: 784, d: 0.08 },
          { f: 988, d: 0.10 },
          { f: 1319, d: 0.14 },
        ];
        let t = 0;
        for (const n of seq) {
          setTimeout(() => playTone(n.f, n.d, "triangle", 0.05), t);
          t += 90;
        }
        setTimeout(() => playTone(1568, 0.12, "sine", 0.035), t + 40);
      }
    
      function launchConfetti({ durationMs = 1600, count = 70 } = {}) {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (reduce) return;
        const layer = document.createElement("div");
        layer.className = "confetti-layer";
        Object.assign(layer.style, {
          position: "fixed",
          inset: "0",
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: "9999",
        });
        document.body.appendChild(layer);
        const vw = window.innerWidth || 1;
        const vh = window.innerHeight || 1;
        for (let i = 0; i < count; i++) {
          const p = document.createElement("span");
          const w = 6 + Math.random() * 6;
          const h = 10 + Math.random() * 10;
          const x = Math.random() * vw;
          const delay = Math.random() * 120;
          const dur = durationMs * (0.75 + Math.random() * 0.55);
          const rot = (Math.random() * 720 - 360) | 0;
          const drift = (Math.random() * 240 - 120) | 0;
          const hue = (Math.random() * 360) | 0;
          Object.assign(p.style, {
            position: "absolute",
            left: `${x}px`,
            top: `-20px`,
            width: `${w}px`,
            height: `${h}px`,
            background: `hsl(${hue} 90% 60%)`,
            borderRadius: "2px",
            opacity: "0.95",
            transform: `translate3d(0,0,0) rotate(0deg)`,
            willChange: "transform, opacity",
          });
          layer.appendChild(p);
          p.animate(
            [
              { transform: `translate3d(0,0,0) rotate(0deg)`, opacity: 1 },
              { transform: `translate3d(${drift}px, ${vh + 40}px, 0) rotate(${rot}deg)`, opacity: 0.98 },
            ],
            { duration: dur, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
          ).onfinish = () => p.remove();
        }
        setTimeout(() => layer.remove(), durationMs + 800);
      }
    
      function showSetClearCelebration(svgEl) {
        showHanamaru(svgEl);
        const p = { x: 50, y: 50 };
        spawnSparks(svgEl, p, 18);
        setTimeout(() => spawnSparks(svgEl, p, 14), 120);
        setTimeout(() => spawnSparks(svgEl, p, 10), 240);
        launchConfetti({ durationMs: 1600, count: 70 });
        playSetClearFanfare();
      }
    

    // ===========================
  // FX / Sound
  // ===========================
  function getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
    return _audioCtx;
  }

  function playTone(freq = 660, duration = 0.07, type = "sine", gain = 0.04) {
    const ctxA = getAudioCtx();
    if (!ctxA) return;
    if (ctxA.state === "suspended") ctxA.resume().catch(() => {});
    const t0 = ctxA.currentTime;
    const osc = ctxA.createOscillator();
    const g = ctxA.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(ctxA.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playComboSuccessSfx(level = 0) {
    const base = 740 + level * 60;
    playTone(base, 0.055, "sine", 0.05);
    playTone(base + 220, 0.055, "sine", 0.04);
    if (level >= 2) setTimeout(() => playTone(base + 420, 0.06, "triangle", 0.035), 55);
  }

  function playFailSfx() {
    if (navigator.vibrate) navigator.vibrate(18);
    // 音は好みで。必要なら極小で足す
    // playTone(220, 0.06, "sine", 0.02);
  }

  // ---------------------------
  // UI helper
  // ---------------------------
  function showError(msg) { if (elError) elError.textContent = String(msg ?? ""); }
  function clearError() { if (elError) elError.textContent = ""; }

  // ===========================
  // Stars (set progress)
  // ===========================
  function renderStars(posInSet, setLen) {
    if (!elStars) return;
    // ✅ single練習は常に★1個固定
    const max = isSingleMode ? 1 : clamp(setLen, 1, SET_SIZE);
    const filled = isSingleMode ? 1 : clamp(posInSet + 1, 1, max);

    if (elStars.children.length !== max) {
      elStars.innerHTML = "";
      for (let i = 0; i < max; i++) {
        const star = document.createElement("span");
        star.className = "star";
        star.textContent = "★";
        elStars.appendChild(star);
      }
    }

    [...elStars.children].forEach((star, i) => {
      const isFilled = i < filled;
      star.classList.toggle("filled", isFilled);

      if (isFilled && i === filled - 1 && _lastStarFilled < filled) {
        star.classList.remove("pop");
        void star.offsetWidth;
        star.classList.add("pop");
      }
    });

    if (filled === max && _lastStarFilled !== max) sparkleStars();
    _lastStarFilled = filled;
  }

  function sparkleStars() {
    if (!elStars) return;
    elStars.classList.remove("starsSparkle");
    void elStars.offsetWidth;
    elStars.classList.add("starsSparkle");
    spawnStarSparks(8);
  }

  function spawnStarSparks(count = 8) {
    if (!elStars) return;
    const rect = elStars.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("span");
      spark.className = "star-spark";
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 18;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
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

  function setHintText(text) { if (elHint) elHint.textContent = String(text ?? ""); }
  function updateHintText() {
    if (isMaster) { setHintText("書き順を思い出して書こう"); return; }
    if (kanjiCompleted) { setHintText('クリア！「つぎ」で次のもじへ'); return; }
    if (drawing) { setHintText("そのまま、なぞっていこう"); return; }
    const streak = Math.max(0, failStreak?.[strokeIndex] ?? 0);
    if (streak >= 2) { setHintText("だいじょうぶ！ゆっくりでOK"); return; }
    if (streak === 1) { setHintText("もういちど。ゆっくりでOK"); return; }
    const next = strokeIndex + 1;
    const circled = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
    const mark = next >= 1 && next <= circled.length ? circled[next - 1] : String(next);
    setHintText(`${mark}のところから、なぞろう`);
  }

  function applyTeacherMode() {
    document.documentElement.classList.toggle("teacher-mode", teacherMode);
    if (elTeacherToggle) elTeacherToggle.setAttribute("aria-pressed", teacherMode ? "true" : "false");
    if (elMode) elMode.textContent = teacherMode ? `${baseModeText}（先生）` : baseModeText;
  }

  function lockInput(ms) {
    inputLocked = true;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => { inputLocked = false; }, ms);
  }

  // ---------------------------
  // データ
  // ---------------------------
  async function loadData() {
    // 1) all
    const resAll = await fetch(ALL_PATH, { cache: "no-store" });
    if (!resAll.ok) throw new Error(`kanji_all HTTP ${resAll.status}`);
    const all = await resAll.json();
    if (!Array.isArray(all)) throw new Error("kanji_all.json は配列である必要があります");

    // 2) traceable ids
    const resTr = await fetch(TRACEABLE_PATH, { cache: "no-store" });
    if (!resTr.ok) throw new Error(`index_traceable HTTP ${resTr.status}`);
    const traceable = await resTr.json();
    const traceSet = new Set(Array.isArray(traceable) ? traceable : []);

    // 3) grade filter + traceable filter + strokesRef normalize
    const filtered = all
      .filter((it) => {
        if (!it?.id || !it?.kanji) return false;
        if (!traceSet.has(it.id)) return false;
        if (gradeFromRange != null && Number(it.grade) !== gradeFromRange) return false;
        return true;
      })
      .map((it) => {
        // strokesRef を normalize（旧形式 g1/g1-001.json が来ても対応）
        const ref = normalizeStrokesRef(it.strokesRef, it.grade, it.id);
        return { ...it, strokesRef: ref };
      })
      .filter((it) => !!it.strokesRef);

    return filtered;
  }


  function normalizeStrokesRef(ref, grade, id) {
        if (!ref) return null;
        const r = String(ref);
        // すでに "strokes/..." ならそのまま
        if (r.startsWith("strokes/")) return r;
        // 旧形式 "g1/g1-001.json" を "strokes/g1/g1-001.json" に
        if (/^g\d+\//.test(r)) return `strokes/${r}`;
        // 万一 "g1-001.json" だけ来たら grade から補う
        if (/^g\d+-\d+\.json$/.test(r)) return `strokes/g${grade}/${r}`;
        // 想定外はそのまま返す（fetchで失敗したら null になる）
        return r;
      }


  async function getStrokesForItem(item) {
    const ref = item?.strokesRef;
    if (!ref) return null;

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

  function strokesJsonToPolylines(j) {
    if (!j || !Array.isArray(j.strokes)) return null;
    const out = [];
    for (const s of j.strokes) {
      if (!s?.path) continue;
      out.push(pathDToPolylineBySampling(s.path, 36));
    }
    return out;
  }

  function pathDToPolylineBySampling(d, samples = 36) {
    const ns = "http://www.w3.org/2000/svg";
    const tmp = document.createElementNS(ns, "svg");
    tmp.setAttribute("viewBox", "0 0 100 100");
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", String(d));
    tmp.appendChild(p);

    let len = 0;
    try { len = p.getTotalLength(); } catch { return []; }
    if (!Number.isFinite(len) || len <= 0.01) return [];

    const pts = [];
    const n = Math.max(8, samples);
    for (let i = 0; i <= n; i++) {
      const dist = (len * i) / n;
      const pt = p.getPointAtLength(dist);
      pts.push({ x: +pt.x.toFixed(2), y: +pt.y.toFixed(2) });
    }

    const compact = [];
    for (const q of pts) {
      const prev = compact[compact.length - 1];
      if (!prev || Math.hypot(prev.x - q.x, prev.y - q.y) > 0.01) compact.push(q);
    }
    return compact;
  }

  // ---------------------------
  // SVG描画（あなたの旧 buildSvgForKanji を移植。必要最低限だけ）
  // ※ ここは長いので「この骨格に旧関数を丸ごと貼る」でOK
  // ---------------------------
  function buildSvgForKanji(strokes) {
    const ns = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 100 100");
    s.setAttribute("class", "kanjiSvg");

    // レイヤー
    const roadLayer = document.createElementNS(ns, "g");
    const strokeLayer = document.createElementNS(ns, "g");
    const hintLayer = document.createElementNS(ns, "g");
    s.appendChild(roadLayer);
    s.appendChild(strokeLayer);
    s.appendChild(hintLayer);

    // shadow/base/hit
    strokes.forEach((poly, i) => {
      const shadow = document.createElementNS(ns, "path");
      shadow.setAttribute("d", polyToPathD(poly));
      shadow.dataset.strokeIndex = String(i);
      shadow.setAttribute("class", "stroke-shadow");
      roadLayer.appendChild(shadow);

      const base = document.createElementNS(ns, "path");
      base.setAttribute("d", polyToPathD(poly));
      base.dataset.strokeIndex = String(i);
      base.setAttribute("class", "stroke-base");
      strokeLayer.appendChild(base);

      const hit = document.createElementNS(ns, "path");
      hit.setAttribute("d", polyToPathD(poly));
      hit.dataset.strokeIndex = String(i);
      hit.setAttribute("class", "stroke-hit");
      strokeLayer.appendChild(hit);
    });

    // active
    const active = document.createElementNS(ns, "path");
    active.setAttribute("class", "stroke-active");
    active.dataset.role = "active";
    active.setAttribute("d", polyToPathD(strokes[0]));
    strokeLayer.appendChild(active);

    // trace
    tracePathEl = document.createElementNS(ns, "path");
    tracePathEl.setAttribute("class", "trace-line");
    tracePathEl.dataset.role = "trace";
    strokeLayer.appendChild(tracePathEl);

    // hint
    const hintG = document.createElementNS(ns, "g");
    const hintDotEl = document.createElementNS(ns, "circle");
    hintDotEl.setAttribute("r", "8");
    hintDotEl.setAttribute("class", "stroke-hint-dot");
    const hintTextEl = document.createElementNS(ns, "text");
    hintTextEl.setAttribute("class", "stroke-hint-num");
    hintTextEl.setAttribute("text-anchor", "middle");
    hintTextEl.setAttribute("dominant-baseline", "middle");
    hintG.appendChild(hintDotEl);
    hintG.appendChild(hintTextEl);
    hintLayer.appendChild(hintG);

    hintDot = hintDotEl;
    hintNum = hintTextEl;

    // ✅ Masterでは猫は最初“漢字外で待機”
    // （Kidでは従来通り 1画目アンカーへ）
    const p0 = isMaster ? { x: 8, y: 92 } : getStrokeAnchor(strokes, 0);
    setCharPos(s, p0);


    return s;
  }

  function ensureChar(svgEl) {
    const ns = "http://www.w3.org/2000/svg";
    let c = svgEl.querySelector('[data-role="char"]');
    if (c) return c;

    const layer = svgEl.querySelector('[data-role="charLayer"]') ?? (() => {
      const g = document.createElementNS(ns, "g");
      g.dataset.role = "charLayer";
      svgEl.appendChild(g);
      return g;
    })();

    c = document.createElementNS(ns, "image");
    c.dataset.role = "char";
    c.setAttribute("class", "char");
    c.setAttribute("width", String(CHAR_SIZE));
    c.setAttribute("height", String(CHAR_SIZE));
    c.setAttribute("x", String(-CHAR_SIZE / 2));
    c.setAttribute("y", String(-CHAR_SIZE / 2));
    c.setAttribute("pointer-events", "none");
    c.setAttribute("href", NEKO_URL);
    c.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", NEKO_URL);
    c.setAttribute("preserveAspectRatio", "xMidYMid meet");
    c.setAttribute("transform", "translate(50 50)");
    layer.appendChild(c);
    return c;
  }

  function setCharPos(svgEl, p) {
    const c = ensureChar(svgEl);
    c.setAttribute("transform", `translate(${p.x} ${p.y})`);
    svgEl.dataset.charX = String(p.x);
    svgEl.dataset.charY = String(p.y);
  }
  function getCharPos(svgEl) {
    return { x: Number(svgEl.dataset.charX || "50"), y: Number(svgEl.dataset.charY || "50") };
  }
  function charJumpTo(svgEl, to) {
    const c = ensureChar(svgEl);
    const from = getCharPos(svgEl);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 10 };
    c.getAnimations().forEach((a) => a.cancel());
    const kf = (p, sx = 1, sy = 1) => ({ transform: `translate(${p.x}px, ${p.y}px) scale(${sx}, ${sy})` });
    c.animate([kf(from), kf(mid, 1.08, 1.08), kf(to), kf(to, 1.12, 0.88), kf(to)], { duration: JUMP_MS, easing: "ease-out", fill: "forwards" });
    clearTimeout(charJumpTimer);
    charJumpTimer = setTimeout(() => setCharPos(svgEl, to), JUMP_MS + 20);
  }
  function charFailDrop(svgEl) {
    const c = ensureChar(svgEl);
    const base = getCharPos(svgEl);
    const down = { x: base.x, y: base.y + 14 };
    c.getAnimations().forEach((a) => a.cancel());
    const kf = (p, sx = 1, sy = 1) => ({ transform: `translate(${p.x}px, ${p.y}px) scale(${sx}, ${sy})` });
    c.animate([kf(base), kf(down, 0.92, 1.10), kf(base), kf(base, 1.12, 0.88), kf(base)], { duration: FAIL_MS, easing: "ease-out", fill: "forwards" });
  }

  function getStrokeAnchor(strokes, i) {
    const poly = strokes?.[i];
    if (!poly || poly.length < 2) return { x: 50, y: 50 };
    let total = 0;
    const seg = [];
    for (let k = 0; k < poly.length - 1; k++) {
      const a = poly[k], b = poly[k + 1];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      seg.push(d);
      total += d;
    }
    if (total <= 0.0001) return { x: poly[0].x, y: poly[0].y };
    const isLast = i === strokes.length - 1;
    const target = total * (isLast ? 0.5 : 0.6);
    let acc = 0;
    for (let k = 0; k < seg.length; k++) {
      const d = seg[k];
      if (acc + d >= target) {
        const t = (target - acc) / d;
        const a = poly[k], b = poly[k + 1];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      acc += d;
    }
    const last = poly[poly.length - 1];
    return { x: last.x, y: last.y };
  }

  function polyToPathD(poly) {
    if (!poly || poly.length === 0) return "";
    const [p0, ...rest] = poly;
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` + rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // ---------------------------
  // 判定（旧main.jsの judgeTrace 周りを必要最低限で移植）
  // ※ ここも「旧関数を丸ごと貼る」でOK。今回は要点だけ残す
  // ---------------------------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function distancePointToSegment(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const wx = p.x - a.x, wy = p.y - a.y;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
    const t = c1 / c2;
    const px = a.x + t * vx, py = a.y + t * vy;
    return Math.hypot(p.x - px, p.y - py);
  }
  function distancePointToPolyline(p, poly) {
    let best = Infinity;
    for (let i = 1; i < poly.length; i++) best = Math.min(best, distancePointToSegment(p, poly[i - 1], poly[i]));
    return best;
  }

// ===========================
  // Phase 2: master stroke guess
  // ===========================
  function avgDistancePolyline(points, poly) {
    if (!points || points.length === 0 || !poly || poly.length < 2) return Infinity;
    let sum = 0;
    for (const p of points) sum += distancePointToPolyline(p, poly);
    return sum / points.length;
  }

  function guessStrokeIndex(points, strokes) {
    let bestI = -1;
    let bestD = Infinity;
    for (let i = 0; i < strokes.length; i++) {
      const d = avgDistancePolyline(points, strokes[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    return { bestI, bestD };
  }

  function polyLength(poly) {
    let len = 0;
    for (let i = 1; i < poly.length; i++) len += dist(poly[i - 1], poly[i]);
    return len;
  }
  function normalizeDrawnPoints(points, step = RESAMPLE_STEP, minMove = MIN_MOVE_EPS) {
    if (!Array.isArray(points) || points.length === 0) return [];
    const compact = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = compact[compact.length - 1];
      const cur = points[i];
      if (dist(prev, cur) >= minMove) compact.push(cur);
    }
    if (compact.length < 2) return compact;
    return resamplePolyline(compact, step);
  }
  function resamplePolyline(poly, step) {
    const len = polyLength(poly);
    if (len <= 0) return poly.slice();
    const out = [];
    for (let d = 0; d <= len; d += step) out.push(pointAtDistance(poly, d));
    const last = poly[poly.length - 1];
    const prev = out[out.length - 1];
    if (!prev || dist(prev, last) > 0.01) out.push({ x: last.x, y: last.y });
    return out;
  }
  function pointAtDistance(poly, d) {
    if (poly.length === 1) return { ...poly[0] };
    let acc = 0;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i];
      const seg = dist(a, b);
      if (acc + seg >= d) {
        const t = seg === 0 ? 0 : (d - acc) / seg;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      acc += seg;
    }
    return { ...poly[poly.length - 1] };
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

  function getAdaptiveParams(strokeLen) {
    const short = 12;
    const long = 60;
    const t = Math.max(0, Math.min(1, (strokeLen - short) / (long - short)));

    const tol = TOLERANCE + (1 - t) * 4;
    const coverTol = tol * 1.15;
    const minHit = MIN_HIT_RATE + t * 0.08;
    const minDraw = MIN_DRAW_LEN_RATE + t * 0.07;
    const minCover = MIN_COVER_RATE + t * 0.15;
    const startTol = START_TOL - t * 6;

    return { tol, coverTol, minHit, minDraw, minCover, startTol };
  }

  function judgeTrace(drawnPoints, strokePoly) {
    if (!Array.isArray(drawnPoints) || drawnPoints.length < MIN_POINTS) return false;

    const dp = normalizeDrawnPoints(drawnPoints, RESAMPLE_STEP, MIN_MOVE_EPS);
    if (dp.length < 2) return false;

    const strokeLen = polyLength(strokePoly);
    if (strokeLen <= 0) return false;

    const P = getAdaptiveParams(strokeLen);

    // 連続失敗救済
    const streak = Math.max(0, Math.min(3, failStreak?.[strokeIndex] ?? 0));
    if (streak > 0) {
      P.tol += 3 * streak;
      P.coverTol = P.tol * 1.15;
      P.minHit = Math.max(0.28, P.minHit - 0.06 * streak);
      P.minCover = Math.max(0.18, P.minCover - 0.06 * streak);
      P.startTol += 3 * streak;
    }

    const start = dp[0];
    const s0 = strokePoly[0];
    if (dist(start, s0) > P.startTol) return false;

    const drawnLen = polyLength(dp);
    if (drawnLen < strokeLen * P.minDraw) return false;

    let hit = 0;
    for (const p of dp) if (distancePointToPolyline(p, strokePoly) <= P.tol) hit++;
    const hitRate = hit / dp.length;

    const samples = sampleAlongPolyline(strokePoly, COVER_SAMPLES);
    let cover = 0;
    for (const sp of samples) if (distancePointToPolyline(sp, dp) <= P.coverTol) cover++;
    const coverRate = cover / samples.length;

    return hitRate >= P.minHit && coverRate >= P.minCover;
  }

  function updateTracePath(pts) {
    if (!tracePathEl) return;
    if (!pts || pts.length === 0) { tracePathEl.setAttribute("d", ""); return; }
    tracePathEl.setAttribute("d", polyToPathD(pts));
  }

  function toSvgPoint(svgEl, clientX, clientY) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  }

  // ---------------------------
  // 画面描画＆操作
  // ---------------------------
  function renderStrokeButtons(n) {
    if (!elStrokeButtons) return;
    elStrokeButtons.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stroke-btn";
      b.textContent = String(i + 1);
      if (i === strokeIndex) b.classList.add("is-active");
      if (done[i]) b.classList.add("is-done");
      b.disabled = true;
      elStrokeButtons.appendChild(b);
    }
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
    hintNum.setAttribute("y", String(p0.y - 8));
    hintNum.textContent = String(strokeIndex + 1);
  }

  function refreshSvgStates(svgEl, strokes) {
    const basePaths = Array.from(svgEl.querySelectorAll("path.stroke-base"));
    basePaths.forEach((p) => {
      const i = Number(p.dataset.strokeIndex);
      if (Number.isFinite(i) && done[i]) p.classList.add("done");
      else p.classList.remove("done");
    });

    const shadowPaths = Array.from(svgEl.querySelectorAll("path.stroke-shadow"));
    shadowPaths.forEach((p) => {
      const i = Number(p.dataset.strokeIndex);
      if (!Number.isFinite(i)) return;
      const shouldOn = !!done[i];
      const wasOn = p.classList.contains("on");
      if (shouldOn) {
        p.classList.add("on");
        if (!wasOn) {
          p.classList.remove("pop");
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
    updateStrokeHint();
  }

  function attachTraceHandlers(svgEl, strokes) {
    drawing = false;
    points = [];
    updateTracePath([]);

    let lastPointerId = null;

    const onDown = (e) => {
      if (kanjiCompleted || inputLocked) return;
      if (e.button != null && e.button !== 0) return;

      const p0 = toSvgPoint(svgEl, e.clientX, e.clientY);
      
      // ✅ Master: “どの画でも”開始OK（ただし漢字の線から遠すぎる場合は除外）
      // ✅ Kid: 次の画（strokeIndex）の開始点付近のみ開始OK（従来通り）
      if (isMaster) {
        // どれかのstrokeの線に近いなら開始許可（strokeIndexに依存しない）
        let best = Infinity;
        for (let i = 0; i < strokes.length; i++) {
          best = Math.min(best, distancePointToPolyline(p0, strokes[i]));
        }
        // Masterは少し厳しめにして誤タップ開始を減らす（好みで調整可）
        const START_TOL_MASTER = 26;
        if (best > START_TOL_MASTER) return;
      } else {
        const poly = strokes[strokeIndex];
        if (!poly || poly.length < 2) return;

        const end0 = poly[0];
        const end1 = poly[poly.length - 1];
        const dEnd = Math.min(dist(p0, end0), dist(p0, end1));
        if (dEnd > START_TOL) return;

        // 線の近くだけ開始OK
        const d0 = distancePointToPolyline(p0, poly);
        if (d0 > START_TOL) return;
      }

      drawing = true;
      updateHintText();

      // ✅ Masterではスナップしない（“どこをなぞったか推定”の精度を守る）
      // ✅ Kidでは従来通り端点へスナップ
      if (isMaster) {
        points = [p0];
      } else {
        const poly = strokes[strokeIndex];
        const end0 = poly[0];
        const end1 = poly[poly.length - 1];
        const snapStart = dist(p0, end0) <= dist(p0, end1) ? end0 : end1;
        points = [snapStart];
      }


      updateTracePath(points);

      try {
        lastPointerId = e.pointerId;
        svgEl.setPointerCapture(e.pointerId);
      } catch {}

      e.preventDefault();
    };

    const onMove = (e) => {
      if (!drawing || inputLocked) return;
      const p = toSvgPoint(svgEl, e.clientX, e.clientY);
      points.push(p);
      updateTracePath(points);
      e.preventDefault();
    };

    const finish = (e) => {
      if (!drawing || inputLocked) return;
      drawing = false;

      try {
        if (lastPointerId != null) svgEl.releasePointerCapture(lastPointerId);
        else svgEl.releasePointerCapture(e.pointerId);
      } catch {}
      lastPointerId = null;

      const ok = judgeTrace(points, strokes[strokeIndex]);
      if (setRun) setRun.attempts += 1;

      // ✅ Phase 2: Masterは「どの画をなぞったか」を推定し、順番違いなら即×
      if (isMaster && points.length) {
          const { bestI, bestD } = guessStrokeIndex(points, strokes);
          // bestIが取れない場合も失敗
          if (bestI < 0 || bestI !== strokeIndex) {
            // “順番違い”の失敗として扱う
            if (setRun) setRun.fail += 1;
            if (setRun) setRun.combo = 0;
            failStreak[strokeIndex] = (failStreak[strokeIndex] ?? 0) + 1;
            lockInput(FAIL_MS);
            charFailDrop(svgEl);
            combo = 0;
            playFailSfx();
            points = [];
            updateTracePath([]);
            e.preventDefault();
            return;
          }
        }

       // ✅ 復習キュー用：1ストローク試行として記録（未クリアでも蓄積）
      const curItem = items[idx];
      if (curItem?.id) {
        const key = `${selectedRangeId ?? "kanji"}::${curItem.id}`;

        recordAttempt(ctx.progress, key, { failed: !ok });
        saveProgress(ctx.progress);
      }

      points = [];
      updateTracePath([]);

      if (ok) {
        if (setRun) {
          setRun.success += 1;
          const streak = failStreak?.[strokeIndex] ?? 0;
          if (streak > 0) setRun.rescued += 1;
          setRun.combo = (setRun.combo ?? 0) + 1;
          setRun.comboMax = Math.max(setRun.comboMax ?? 0, setRun.combo);
        }

        done[strokeIndex] = true;
        failStreak[strokeIndex] = 0;
        // ✅ 正解した画（直前）の index を保存
        const solvedIndex = strokeIndex;
        strokeIndex++;

        const nextAnchor =
          strokeIndex < strokes.length
            ? getStrokeAnchor(strokes, strokeIndex)
            : getStrokeAnchor(strokes, strokes.length - 1);

        // ✅ Masterでは猫は「次」ではなく「今の正解（1つ前）」に置く
        const catAnchor = isMaster
          ? getStrokeAnchor(strokes, solvedIndex)
          : nextAnchor;

        lockInput(JUMP_MS);
        charJumpTo(svgEl, catAnchor);

         // ✅ 成功演出：コンボ / SFX / スパーク
        const now = Date.now();
        const within = now - lastSuccessAt <= COMBO_WINDOW_MS;
        combo = within ? combo + 1 : 1;
        lastSuccessAt = now;
        const comboLevel = Math.min(5, Math.floor((combo - 1) / 2)); // 0..5

        spawnSparks(svgEl, nextAnchor, 8 + comboLevel * 3);
        playComboSuccessSfx(comboLevel);
        if (combo >= 3) showComboPop(svgEl, `コンボ ${combo}!`);

        refreshSvgStates(svgEl, strokes);
        renderStrokeButtons(strokes.length);
        updateHintText();

        // ✅ 1文字クリア
        if (strokeIndex >= strokes.length) {
          if (setRun) setRun.kanjiCleared += 1;
          kanjiCompleted = true;

          // ✅ クリア済みを “共通進捗” に保存（Progress画面と繋がる）
          const item = items[idx];
          if (item?.id) {
            markCleared(ctx.progress, `${selectedRangeId ?? "kanji"}::${item.id}`);
            saveProgress(ctx.progress);
          }

           // ✅ single練習：ここで完了→図鑑へ戻す（Resultには行かない）
          if (isSingleMode) {
                showSetClearCelebration(svgEl);
                setTimeout(() => {
                  const result = finalizeSetRun();
                  onSetFinished?.({
                    mode: "single",
                    singleId,
                    result,
                    set: { start: 0, end: 1, len: 1, pos: 0 },
                    history: loadSetResults(),
                    nextStart: 0,
                  });
                }, 900);
                return;
              }
    

          // 表示上の安全
          strokeIndex = strokes.length - 1;
          refreshSvgStates(svgEl, strokes);
          renderStrokeButtons(strokes.length);
          updateHintText();

          const set = getSetInfo(idx);

          // ✅ セット途中なら自動で次へ
          if (set.pos < set.len - 1) {
            clearTimeout(moveTimer);
            moveTimer = setTimeout(() => {
              if (!kanjiCompleted) return;
              move(1);
            }, AUTO_NEXT_DELAY_MS);
          } else {
            // ✅ セット最終：overlayやめて Result画面へ
            // ✅ クリア演出（はなまる＋紙吹雪＋ファンファーレ）→余韻→結果へ
            showSetClearCelebration(svgEl);
            setTimeout(() => {
              if (!kanjiCompleted) return;
              const result = finalizeSetRun();
              onSetFinished?.({
                result,
                set,
                history: loadSetResults(),
                nextStart: set.end >= items.length ? 0 : set.end,
              });
            }, 1200);
          }
        }
      } else {
        if (setRun) setRun.fail += 1;
        if (setRun) setRun.combo = 0;
        failStreak[strokeIndex] = (failStreak[strokeIndex] ?? 0) + 1;
        lockInput(FAIL_MS);
        charFailDrop(svgEl);
        combo = 0;
        playFailSfx();
      }

      e.preventDefault();
    };
    
    svgEl.addEventListener("pointerdown", onDown, { passive: false });
        svgEl.addEventListener("pointermove", onMove, { passive: false });
        svgEl.addEventListener("pointerup", finish, { passive: false });
        svgEl.addEventListener("pointercancel", finish, { passive: false });
    
        svgDisposers.push(() => {    
      svgEl.removeEventListener("pointerdown", onDown);
      svgEl.removeEventListener("pointermove", onMove);
      svgEl.removeEventListener("pointerup", finish);
      svgEl.removeEventListener("pointercancel", finish);
    });
  }

  function cleanupSvgHandlers() {
        for (const d of svgDisposers.splice(0)) {
         try { d(); } catch {}
        }
      }

  function move(delta) {
    idx = clamp(idx + delta, 0, items.length - 1);
    strokeIndex = 0;
    done = [];
    kanjiCompleted = false;
    render().catch((e) => showError(String(e?.message ?? e)));
  }

  async function render() {
    // ✅ 前のSVGのイベントを必ず解除（多重登録防止）
    cleanupSvgHandlers();
    clearError();
    kanjiCompleted = false;

    const item = items[idx];
    const k = item?.kanji ?? "?";

    const set = getSetInfo(idx);
    ensureSetRun(set);

    
    // ✅ single練習は常に 1/1 表示（途中変化しない）
    if (isSingleMode) renderStars(0, 1);
    else renderStars(set.pos, set.len);
    
    // ✅ single練習は常に (1/1) 表示
    if (elLabel) {
          const a = isSingleMode ? 1 : (set.pos + 1);
          const b = isSingleMode ? 1 : set.len;
          elLabel.textContent = `${k} (${a}/${b})`;
        }
   
    if (elArea) elArea.innerHTML = `<div style="font-size:20px; opacity:.7; font-weight:700;">よみこみ中…</div>`;

    const strokes = await getStrokesForItem(item);
    if (!strokes || strokes.length === 0) {
      if (elArea) elArea.innerHTML = `<div style="font-size:96px; opacity:.35; font-weight:700;">${k}</div>`;
      if (elStrokeButtons) elStrokeButtons.innerHTML = "";
      return;
    }

    done = new Array(strokes.length).fill(false);
    strokeIndex = 0;
    failStreak = new Array(strokes.length).fill(0);

    if (elStrokeButtons) renderStrokeButtons(strokes.length);

    if (elArea) {
      elArea.innerHTML = "";
      svg = buildSvgForKanji(strokes);
      elArea.appendChild(svg);
    }
    currentStrokes = strokes;

    refreshSvgStates(svg, strokes);
    
    // ✅ Masterでは猫は「待機位置」のまま（render()で上書きしない）
    if (isMaster) {
        setCharPos(svg, { x: 8, y: 92 });
      } else {
        setCharPos(svg, getStrokeAnchor(strokes, 0));
      }
  
    updateHintText();

    attachTraceHandlers(svg, strokes);
  }

  async function boot() {

    // ✅ master-mode クラス（CSSでヒントを完全OFF）
    document.documentElement.classList.toggle("master-mode", isMaster);
    teacherMode = false;
    applyTeacherMode();

    if (elTeacherToggle) {
      const onT = () => { teacherMode = !teacherMode; applyTeacherMode(); };
      elTeacherToggle.addEventListener("click", onT);
      disposers.push(() => elTeacherToggle.removeEventListener("click", onT));
    }

    if (elPrev) {
      const onP = () => move(-1);
      elPrev.addEventListener("click", onP);
      disposers.push(() => elPrev.removeEventListener("click", onP));
    }
    if (elNext) {
      const onN = () => move(1);
      elNext.addEventListener("click", onN);
      disposers.push(() => elNext.removeEventListener("click", onN));
    }

    try {
      items = await loadData();
    } catch (e) {
      showError(`データ読み込み失敗: ${String(e?.message ?? e)}`);
      items = [];
    }

    if (!items.length) throw new Error("データなし");

    // ✅ single練習：その1文字だけに絞る
    if (isSingleMode) {
          const one = items.find((x) => x?.id === singleId);
          if (!one) throw new Error(`singleId not found: ${singleId}`);
          items = [one];
          idx = 0;
        } else {
                  // ✅ startFromIdx 優先（Resultの「つぎの5もじ」で使う）
                  if (Number.isFinite(startFromIdx)) {
                    idx = clamp(startFromIdx, 0, items.length - 1);
                  } else if (startFromId) {
                    const found = items.findIndex((x) => x.id === startFromId);
                    if (found >= 0) idx = found;
                  }
                }
            
                await render();
              }

  // 起動
  const bootPromise = boot();

  // stop（画面遷移時に必ず呼ぶ）
  function stop() {
    clearTimeout(moveTimer);
    clearTimeout(unlockTimer);
    clearTimeout(charJumpTimer);
    // confetti残留掃除（念のため）
    document.querySelectorAll(".confetti-layer").forEach((n) => n.remove());
    // 画面遷移でmaster-modeが残らないように
    document.documentElement.classList.remove("master-mode");
    // pointer capture残り対策
    try { svg?.releasePointerCapture?.(0); } catch {}

    // ✅ SVG側のイベントも必ず解除
    cleanupSvgHandlers();

    for (const d of disposers.splice(0)) {
      try { d(); } catch {}
    }
  }

  return {
    ready: bootPromise, // or ready
    stop,
    modeText,
  };
}
