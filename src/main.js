import "./style.css";

/**
 * Vite / Vercel 安全版
 * - public/data/kanji_g1_min5.json を確実に読めるようにする
 * - BASE_URL を絶対URL化して new URL() エラーを潰す
 */

const APP_ID = "app";

// ここを切り替えるだけで Day2/Day3 を増やせる想定
const DATA_FILES = [
  "data/kanji_g1_min5.json", // Day1/Day2 共通でまずこれを読む
];

function getBaseURL() {
  // 例: "/" or "/myapp/"
  const base = import.meta.env.BASE_URL || "/";
  // base を “絶対URL” に変換（これがないと new URL(relative, "/") で死ぬケースがある）
  return new URL(base, window.location.href);
}

async function loadJson(path) {
  const baseURL = getBaseURL();
  const url = new URL(path, baseURL).toString();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${path})`);
  }
  return res.json();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function mountApp(root) {
  // --- state ---
  const state = {
    goal: "5もじ",
    items: [],
    idx: 0,
    doneStrokes: new Set(),
    message: "",
  };

  // --- UI skeleton ---
  root.innerHTML = "";
  const shell = el("div", "app-shell");

  const hud = el("div", "hud");
  const stars = el("div", "stars", "☆☆☆☆☆");
  const goal = el("div", "goal", `もくひょう：${state.goal}`);
  hud.append(stars, goal);

  const main = el("div", "main");
  const title = el("div", "kanji-title", "—");
  const display = el("div", "kanji-display", "データなし");

  const strokeButtons = el("div", "stroke-buttons");
  const message = el("div", "message", "");

  main.append(title, display, strokeButtons, message);

  const footer = el("div", "footer");
  const prevBtn = el("button", "nav-btn", "まえ");
  const nextBtn = el("button", "nav-btn", "つぎ");
  footer.append(prevBtn, nextBtn);

  shell.append(hud, main, footer);
  root.append(shell);

  // --- helpers ---
  function setMessage(text) {
    state.message = text || "";
    message.textContent = state.message;
  }

  function currentItem() {
    return state.items[state.idx] || null;
  }

  function renderStars() {
    // 進捗: 5問中の現在位置を★で表現（適当でOKならこのまま）
    const total = Math.max(1, state.items.length || 5);
    const done = Math.min(state.idx, total);
    const filled = "★★★★★".slice(0, done);
    const empty = "☆☆☆☆☆".slice(0, Math.max(0, 5 - done));
    stars.textContent = (filled + empty).slice(0, 5);
  }

  function renderStrokeButtons(maxStrokes) {
    strokeButtons.innerHTML = "";
    state.doneStrokes = new Set();

    // ①〜 の丸数字
    const nums = Array.from({ length: maxStrokes }, (_, i) => i + 1);

    nums.forEach((n) => {
      const label = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"][n-1] || String(n);
      const b = el("button", "stroke-btn", label);

      b.addEventListener("click", () => {
        // ここは “クリックで反応” が大事なので、最小仕様で：押したら done 扱いにする
        if (!state.doneStrokes.has(n)) {
          state.doneStrokes.add(n);
          b.classList.add("done");
        } else {
          // もう一回押したら戻せる（任意）
          state.doneStrokes.delete(n);
          b.classList.remove("done");
        }
      });

      strokeButtons.appendChild(b);
    });
  }

  function render() {
    const item = currentItem();

    renderStars();

    if (!item) {
      title.textContent = "—";
      display.textContent = "データなし";
      strokeButtons.innerHTML = "";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    // item の形がどう来ても耐える（kanji / char / text など）
    const kanji = item.kanji || item.char || item.text || item.word || "？";

    // 1/5 表示（上の仕様に寄せる）
    const total = state.items.length || 5;
    const maxStrokes =
      Number(item.strokes ?? item.strokeCount ?? item.kakusu ?? 4) || 4;

    title.textContent = `${kanji}（${state.idx + 1}/${total}）`;
    display.textContent = kanji;

    renderStrokeButtons(Math.min(Math.max(maxStrokes, 1), 20));

    prevBtn.disabled = state.idx <= 0;
    nextBtn.disabled = state.idx >= state.items.length - 1;
  }

  // --- events ---
  prevBtn.addEventListener("click", () => {
    if (state.idx > 0) {
      state.idx -= 1;
      setMessage("");
      render();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (state.idx < state.items.length - 1) {
      state.idx += 1;
      setMessage("");
      render();
    }
  });

  // --- data load ---
  (async () => {
    try {
      // 最初のファイルだけ読む（必要ならここで Day2 用に切替）
      const json = await loadJson(DATA_FILES[0]);

      // json の形が配列 or {items:[...]} どちらでもOKにする
      const items = Array.isArray(json) ? json : (json.items || json.data || []);

      state.items = items.slice(0, 5); // “5もじ” 前提
      state.idx = 0;

      setMessage("");
      render();
    } catch (e) {
      console.error(e);
      display.textContent = "データなし";
      setMessage(`データ読み込み失敗：${String(e.message || e)}`);
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }
  })();

  // 初期描画
  render();
}

function main() {
  const root = document.getElementById(APP_ID);
  if (!root) {
    throw new Error(`#${APP_ID} が見つかりません (index.html を確認)`);
  }
  mountApp(root);
}

main();
