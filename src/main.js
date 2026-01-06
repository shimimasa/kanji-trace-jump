// =========================
// 5漢字のSVGパス（固定内蔵）
//  - viewBox: 0 0 100 100
//  - 1画が複数のM（サブパス）を含む場合あり → 自動分割して順番に判定する
// =========================
const SVG_DB = {
  "木": [
    "M20 35 L80 35", // ① よこ
    "M50 15 L50 85", // ② たて
    "M48 55 L25 85", // ③ ひだりはらい
    "M52 55 L75 85", // ④ みぎはらい
  ],
  "山": [
    "M30 20 L30 82", // ① 左たて
    "M50 12 L50 88", // ② 中たて
    // ③ 右たて＋下よこ（1画を2サブパスにして「完全再現」）
    "M70 20 L70 82 M30 82 L70 82",
  ],
  "川": [
    "M32 18 L32 88", // ① 左
    "M50 12 L50 92", // ② 中
    "M68 18 L68 88", // ③ 右
  ],
  "口": [
    // ① たて＋よこ（コの字）＝上よこ＋左たて（この1画は2サブパス）
    "M30 25 L70 25 M30 25 L30 75",
    "M70 25 L70 75", // ② 右たて
    "M30 75 L70 75", // ③ 下よこ
  ],
  "人": [
    "M52 25 L35 85", // ① ひだりはらい
    "M52 25 L70 85", // ② みぎはらい
  ],
};

// =========================
// ユーティリティ
// =========================
function el(id) {
  return document.getElementById(id);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// "M ... M ..." をサブパスに分割して配列化
function splitSubpaths(d) {
  const s = d.trim();
  if (!s) return [];
  // "M"で分割。ただし先頭もMなので空要素が出る
  const parts = s.split(/(?=M)/g).map((p) => p.trim()).filter(Boolean);
  return parts;
}

// SVG path 上の最近傍距離（サンプリングで近似）
function approxMinDistanceToPath(pathEl, px, py) {
  const total = pathEl.getTotalLength();
  if (!isFinite(total) || total <= 0) return Infinity;
  const steps = 60;
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = (total * i) / steps;
    const p = pathEl.getPointAtLength(t);
    const dx = p.x - px;
    const dy = p.y - py;
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

// path 上の「どこまで進んだか」を近似（サンプリング最近傍の最大位置）
function approxProgressAlongPath(pathEl, points) {
  const total = pathEl.getTotalLength();
  if (!isFinite(total) || total <= 0) return 0;
  const steps = 80;

  let maxLen = 0;
  for (const pt of points) {
    let bestLen = 0;
    let bestDist = Infinity;
    for (let i = 0; i <= steps; i++) {
      const tLen = (total * i) / steps;
      const p = pathEl.getPointAtLength(tLen);
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        bestLen = tLen;
      }
    }
    // 近い点だけ採用（遠いタップを無視）
    if (bestDist < 10) {
      maxLen = Math.max(maxLen, bestLen);
    }
  }

  return maxLen / total;
}

// =========================
// データ読み込み（JSONはそのまま）
// =========================
async function loadKanjiData() {
  const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
  // public/data 配下 → `${BASE_URL}data/...`
  const url = new URL(`${base}data/kanji_g1_min5.json`, window.location.origin).toString();

  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`データ読み込み失敗：HTTP ${res.status} (${url})`);
  }
  return await res.json();
}

// =========================
// 状態
// =========================
const state = {
  items: [],
  idx: 0, // 0..4
  // ストローク進行
  strokeIndex: 0, // 0-based (画)
  subIndex: 0, // 0-based (サブパス)
  doneStrokes: 0,
  // トレース中
  isPointerDown: false,
  tracePoints: [], // svg座標の点列
};

// =========================
// SVGレンダリング（ベース/完了/アクティブ）
// =========================
function buildStrokeSegments(dList) {
  // dList: [stroke1, stroke2, ...] each may contain multiple "M"
  return dList.map((d) => splitSubpaths(d));
}

function render() {
  const errorText = el("errorText");
  errorText.textContent = "";

  const item = state.items[state.idx];
  if (!item) {
    el("kanjiTitle").textContent = "データなし";
    el("kanjiArea").innerHTML = "";
    el("strokeButtons").innerHTML = "";
    el("prevBtn").disabled = true;
    el("nextBtn").disabled = true;
    return;
  }

  // タイトル
  el("kanjiTitle").textContent = `${item.kanji} (${state.idx + 1}/5)`;

  // 星（とりあえず: 完了文字数）
  const stars = Array.from({ length: 5 }, (_, i) => (i < state.idx ? "★" : "☆")).join("");
  el("stars").textContent = stars;

  // ボタン
  el("prevBtn").disabled = state.idx === 0;
  el("nextBtn").disabled = state.idx === state.items.length - 1;

  // ストロークボタン（①②③…）
  const strokeButtons = el("strokeButtons");
  strokeButtons.innerHTML = "";
  const n = item.strokesCount || 0;
  for (let i = 0; i < n; i++) {
    const b = document.createElement("button");
    b.className = "stroke-btn";
    b.type = "button";
    b.textContent = String(i + 1);
    if (i < state.doneStrokes) b.classList.add("is-done");
    if (i === state.strokeIndex) b.classList.add("is-active");
    // クリック移動は禁止（書き順ゲーなので）
    b.addEventListener("click", () => {});
    strokeButtons.appendChild(b);
  }

  // SVG描画
  const area = el("kanjiArea");
  area.innerHTML = "";

  const dList = SVG_DB[item.kanji];
  if (!dList) {
    errorText.textContent = `SVGデータがありません（${item.kanji}）`;
    return;
  }

  const segments = buildStrokeSegments(dList);
  // 完了の定義: strokeIndex より前の画は完了
  // ただし、現在の strokeIndex の subIndex も考慮して「途中まで完了」を表現
  const viewBox = "0 0 100 100";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-label", "kanji-svg");

  // クリック/トレース用の透明レイヤ
  const gHit = document.createElementNS(svgNS, "g");
  const gBase = document.createElementNS(svgNS, "g");
  const gDone = document.createElementNS(svgNS, "g");
  const gActive = document.createElementNS(svgNS, "g");

  // ベース線（全ストローク）
  for (let si = 0; si < segments.length; si++) {
    for (let subi = 0; subi < segments[si].length; subi++) {
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", segments[si][subi]);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "var(--baseStroke)");
      p.setAttribute("stroke-width", "10");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      gBase.appendChild(p);
    }
  }

  // 完了線（doneStrokes分は全部）
  for (let si = 0; si < state.doneStrokes; si++) {
    if (!segments[si]) continue;
    for (let subi = 0; subi < segments[si].length; subi++) {
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", segments[si][subi]);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "var(--doneStroke)");
      p.setAttribute("stroke-width", "12");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      gDone.appendChild(p);
    }
  }

  // 現在ストロークの「完了済みサブ」も done 表示
  const curSegs = segments[state.strokeIndex] || [];
  for (let subi = 0; subi < state.subIndex; subi++) {
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", curSegs[subi]);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "var(--doneStroke)");
    p.setAttribute("stroke-width", "12");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    gDone.appendChild(p);
  }

  // アクティブ（いまなぞるべき subpath）
  const activeD = (segments[state.strokeIndex] || [])[state.subIndex];
  let activePath = null;
  if (activeD) {
    activePath = document.createElementNS(svgNS, "path");
    activePath.setAttribute("d", activeD);
    activePath.setAttribute("fill", "none");
    activePath.setAttribute("stroke", "var(--activeStroke)");
    activePath.setAttribute("stroke-width", "14");
    activePath.setAttribute("stroke-linecap", "round");
    activePath.setAttribute("stroke-linejoin", "round");
    gActive.appendChild(activePath);

    // ヒット判定用（太め透明）
    const hit = document.createElementNS(svgNS, "path");
    hit.setAttribute("d", activeD);
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "28");
    hit.setAttribute("stroke-linecap", "round");
    hit.setAttribute("stroke-linejoin", "round");
    hit.style.pointerEvents = "stroke";
    hit.dataset.kind = "hit";
    gHit.appendChild(hit);
  }

  svg.appendChild(gBase);
  svg.appendChild(gDone);
  svg.appendChild(gActive);
  svg.appendChild(gHit);
  area.appendChild(svg);

  // ポインタイベント
  const toSvgPoint = (evt) => {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 100;
    const y = ((evt.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const tolerance = 12; // だいたいの許容
  const minProgress = 0.85; // ここまで行けば「書けた」

  const onPointerDown = (evt) => {
    if (!activePath) return;
    state.isPointerDown = true;
    state.tracePoints = [];
    const pt = toSvgPoint(evt);
    state.tracePoints.push(pt);

    // 最初が遠すぎるなら即無視（誤タップ防止）
    const dist = approxMinDistanceToPath(activePath, pt.x, pt.y);
    if (dist > tolerance) {
      state.isPointerDown = false;
      state.tracePoints = [];
      return;
    }
  };

  const onPointerMove = (evt) => {
    if (!state.isPointerDown || !activePath) return;
    const pt = toSvgPoint(evt);
    state.tracePoints.push(pt);

    // 途中で大きく外れたら切る（暴走防止）
    const dist = approxMinDistanceToPath(activePath, pt.x, pt.y);
    if (dist > tolerance * 1.8) {
      // ただし一発アウトにすると難しいので、少し甘め
      // ここでは継続（判定はUP時）
    }
  };

  const onPointerUp = () => {
    if (!state.isPointerDown || !activePath) return;
    state.isPointerDown = false;

    const prog = approxProgressAlongPath(activePath, state.tracePoints);
    if (prog >= minProgress) {
      // サブパス完了 → 次へ
      const segs = segments[state.strokeIndex] || [];
      const nextSub = state.subIndex + 1;
      if (nextSub < segs.length) {
        state.subIndex = nextSub;
      } else {
        // 画完了
        state.doneStrokes = Math.max(state.doneStrokes, state.strokeIndex + 1);
        state.strokeIndex += 1;
        state.subIndex = 0;

        // 全画完了なら次の漢字へ自動（任意）
        if (state.strokeIndex >= segments.length) {
          // 次の漢字へ（最後なら止める）
          if (state.idx < state.items.length - 1) {
            state.idx += 1;
          }
          resetStrokeStateForCurrent();
        }
      }
      render();
    } else {
      // 失敗 → そのまま
    }

    state.tracePoints = [];
  };

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
}

function resetStrokeStateForCurrent() {
  state.strokeIndex = 0;
  state.subIndex = 0;
  state.doneStrokes = 0;
}

// =========================
// ナビ（まえ/つぎ）
// =========================
function bindNav() {
  el("prevBtn").addEventListener("click", () => {
    if (state.idx <= 0) return;
    state.idx -= 1;
    resetStrokeStateForCurrent();
    render();
  });

  el("nextBtn").addEventListener("click", () => {
    if (state.idx >= state.items.length - 1) return;
    state.idx += 1;
    resetStrokeStateForCurrent();
    render();
  });
}

// =========================
// 起動
// =========================
async function main() {
  bindNav();

  try {
    const data = await loadKanjiData();
    state.items = data.items || [];
    state.idx = 0;
    resetStrokeStateForCurrent();
    render();
  } catch (e) {
    el("errorText").textContent = e instanceof Error ? e.message : String(e);
    // 最低限の表示
    state.items = [];
    render();
  }
}

main();
