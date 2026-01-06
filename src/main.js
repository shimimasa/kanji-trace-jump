// src/main.js
import "./style.css";

/**
 * Day2 方針：
 * - public/data/ に置いたJSONを確実に読めるようにする（Vercel/Vite両対応）
 * - stroke SVG 描画は使わない（このJSONはSVGではなく数値配列っぽい）
 * - 「漢字を巨大表示」＋「①②③...（ストローク数）」＋「順番ボタン」で進行
 */

// Vite の base（/ や /subpath/）を吸収して public 配下を参照する
const BASE = (import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";

// ✅ ここが最重要：あなたの配置は public/data/kanji_g1_min5.json
const DATA_URL_CANDIDATES = [
  new URL("data/kanji_g1_min5.json", BASE).toString(),
  // 念のため：直下に置いた場合も拾える
  new URL("kanji_g1_min5.json", BASE).toString(),
];

const circledNums = [
  "①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩",
  "⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳",
];

function $(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function loadJsonWithFallback() {
  let lastErr = null;

  for (const url of DATA_URL_CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} (${url})`);
      const json = await res.json();
      return json;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error("Failed to load JSON");
}

function normalizeItems(json) {
  // いろんな形に対応
  // - 配列そのもの: [{kanji, strokesCount, ...}, ...]
  // - {items:[...]} / {data:[...]} のような形
  const arr =
    Array.isArray(json) ? json :
    Array.isArray(json?.items) ? json.items :
    Array.isArray(json?.data) ? json.data :
    null;

  if (!arr) return [];

  return arr.map((raw) => {
    const kanji = String(raw?.kanji ?? raw?.character ?? raw?.char ?? "").trim();

    // strokesCount が無ければ strokes.length から推測
    let strokesCount = Number(raw?.strokesCount ?? raw?.strokeCount ?? 0);
    if (!Number.isFinite(strokesCount) || strokesCount <= 0) {
      if (Array.isArray(raw?.strokes)) strokesCount = raw.strokes.length;
    }
    if (!Number.isFinite(strokesCount) || strokesCount < 0) strokesCount = 0;

    return { kanji, strokesCount, raw };
  }).filter((x) => x.kanji.length > 0);
}

function buildUI() {
  const app = $("#app");
  app.innerHTML = `
    <div class="app-shell">

      <header class="hud">
        <div id="stars" class="stars">☆☆☆☆☆</div>
        <div id="goal" class="goal">もくひょう：5もじ</div>
      </header>

      <main class="main">
        <div id="kanjiTitle" class="kanji-title">—</div>

        <div id="kanjiDisplay" class="kanji-display" aria-label="kanji">—</div>

        <div id="strokeButtons" class="stroke-buttons" aria-label="strokes"></div>

        <div id="message" class="message" aria-live="polite"></div>
      </main>

      <footer class="footer">
        <button id="prevBtn" class="nav-btn" type="button">まえ</button>
        <button id="nextBtn" class="nav-btn" type="button">つぎ</button>
      </footer>

    </div>
  `;
}

function renderStars(starsEl, clearedCount) {
  const n = clamp(clearedCount, 0, 5);
  starsEl.textContent = "★".repeat(n) + "☆".repeat(5 - n);
}

function renderTitle(titleEl, item, idx, total) {
  const circles = Array.from(
    { length: item.strokesCount },
    (_, i) => circledNums[i] ?? String(i + 1)
  ).join(" ");
  titleEl.textContent = `${item.kanji} (${idx + 1}/${total}) ${circles}`.trim();
}

function createStrokeButtons(container, strokesCount, strokeIndex, onTryAdvance) {
  container.innerHTML = "";

  if (!strokesCount || strokesCount <= 0) return;

  for (let i = 1; i <= strokesCount; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stroke-btn";
    b.textContent = String(i);
    b.setAttribute("aria-label", `stroke ${i}`);

    if (i <= strokeIndex) b.classList.add("done");

    b.addEventListener("click", () => {
      if (i === strokeIndex + 1) {
        onTryAdvance();
      } else {
        b.classList.remove("shake");
        void b.offsetWidth;
        b.classList.add("shake");
      }
    });

    container.appendChild(b);
  }
}

async function main() {
  buildUI();

  const starsEl = $("#stars");
  const titleEl = $("#kanjiTitle");
  const displayEl = $("#kanjiDisplay");
  const strokeButtonsEl = $("#strokeButtons");
  const msgEl = $("#message");
  const prevBtn = $("#prevBtn");
  const nextBtn = $("#nextBtn");

  let items = [];
  let idx = 0;
  let strokeIndex = 0;
  let cleared = new Set();

  try {
    const json = await loadJsonWithFallback();
    items = normalizeItems(json);

    if (!items.length) {
      msgEl.textContent = "データなし（JSONが空、または kanji キーが見つかりません）";
      titleEl.textContent = "データなし";
      displayEl.textContent = "—";
      nextBtn.disabled = true;
      prevBtn.disabled = true;
      return;
    }
  } catch (e) {
    msgEl.textContent = `データ読み込み失敗：${String(e?.message ?? e)}`;
    titleEl.textContent = "データなし";
    displayEl.textContent = "—";
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    return;
  }

  function updateButtons() {
    prevBtn.disabled = idx <= 0;

    const item = items[idx];
    const canNext = (item.strokesCount <= 0) || (strokeIndex >= item.strokesCount);
    nextBtn.disabled = !canNext;
  }

  function render() {
    const total = items.length;
    const item = items[idx];

    renderStars(starsEl, cleared.size);
    renderTitle(titleEl, item, idx, total);
    displayEl.textContent = item.kanji;

    msgEl.textContent = "";

    createStrokeButtons(strokeButtonsEl, item.strokesCount, strokeIndex, () => {
      strokeIndex++;
      if (strokeIndex >= item.strokesCount) {
        cleared.add(idx);
        msgEl.textContent = "OK！「つぎ」で進めます";
      }
      render();
    });

    updateButtons();
  }

  prevBtn.addEventListener("click", () => {
    idx = clamp(idx - 1, 0, items.length - 1);
    strokeIndex = 0;
    render();
  });

  nextBtn.addEventListener("click", () => {
    const item = items[idx];
    if (item.strokesCount > 0 && strokeIndex < item.strokesCount) return;

    idx = clamp(idx + 1, 0, items.length - 1);
    strokeIndex = 0;
    render();
  });

  render();
}

main();
