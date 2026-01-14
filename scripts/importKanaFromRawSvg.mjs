/**
+ * Import kana SVGs from public/raw_svg/{hiragana,katakana}
+ * and generate:
+ *  - public/data/strokes/{hiragana|katakana}/*.json   (game stroke format)
+ *  - public/data/{hiragana|katakana}/*_all.json
+ *  - public/data/{hiragana|katakana}/index_traceable_*.json
+ *
+ * Run:
+ *   node scripts/importKanaFromRawSvg.mjs hiragana
+ *   node scripts/importKanaFromRawSvg.mjs katakana
+ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const kind = process.argv[2];

console.log("[importKanaFromRawSvg] start");
console.log("[importKanaFromRawSvg] cwd =", ROOT);
console.log("[importKanaFromRawSvg] kind =", kind);

if (!kind || !["hiragana", "katakana"].includes(kind)) {
  console.error("Usage: node scripts/importKanaFromRawSvg.mjs <hiragana|katakana>");
  process.exit(1);
}

const RAW_DIR = path.join(ROOT, "public", "raw_svg", kind);
const STROKES_DIR = path.join(ROOT, "public", "data", "strokes", kind);
const DATA_DIR = path.join(ROOT, "public", "data", kind);

const ALL_PATH = path.join(DATA_DIR, `${kind}_all.json`);
const IDX_PATH = path.join(DATA_DIR, `index_traceable_${kind}.json`);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listSvgs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".svg"))
    .map((e) => path.join(dir, e.name));
}

function getCharFromFilename(filePath) {
  // "あ.svg" -> "あ"
  return path.basename(filePath, ".svg");
}

function toUnicodeHex(ch) {
  // 1文字前提。濁点付きが分離している可能性もあるのでコードポイント列を結合
  const cps = Array.from(ch).map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"));
  return cps.join("_");
}

function makeId(kind, ch) {
  const prefix = kind === "hiragana" ? "HIRA" : "KATA";
  return `${prefix}_U${toUnicodeHex(ch)}`;
}

function extractPathDs(svgText) {
  // ✅ strokesvg(dist) の本命：strokesグループ内の <path style="...--i:N..." d="...">
  const mg = /<g\b[^>]*data-strokesvg=["']strokes["'][^>]*>([\s\S]*?)<\/g>/i.exec(svgText);
  const target = mg ? mg[1] : svgText;

  // pathに直接 --i が付くケースを最優先で集める
  const byI = new Map(); // i -> d candidates[]
  const rePathI = /<path\b[^>]*style="[^"]*--i:(\d+)[^"]*"[^>]*\sd="([^"]+)"/gi;
  let pm;
  while ((pm = rePathI.exec(target))) {
    const i = Number(pm[1]);
    const d = (pm[2] ?? "").trim();
    if (!Number.isFinite(i) || !d) continue;
    if (!byI.has(i)) byI.set(i, []);
    byI.get(i).push(d);
  }

  if (byI.size > 0) {
    const out = [];
    const keys = Array.from(byI.keys()).sort((a, b) => a - b);
    for (const i of keys) {
      const cands = dedupe(byI.get(i));
      // 同じiに複数候補があるときだけ外れを落とす
      let best = cands[0];
      let bestScore = scorePath(best);
      for (const d of cands.slice(1)) {
        const s = scorePath(d);
        if (s < bestScore) { best = d; bestScore = s; }
      }
      out.push(best);
    }
    return dedupe(out);
  }

  // fallback（フォーマット違い用）
  const ds = [];
  const reAny = /<path\b[^>]*\sd="([^"]+)"/gi;
  let m;
  while ((m = reAny.exec(target))) {
    const d = (m[1] ?? "").trim();
    if (d) ds.push(d);
  }
  return dedupe(ds);
}

function scorePath(d) {
    // path文字列から数値を抜く。最大絶対値が大きいほど「外れ」っぽい。
    const nums = d.match(/-?\d+(\.\d+)?/g) || [];
    let maxAbs = 0;
    for (const s of nums) {
      const v = Number(s);
      if (Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    return maxAbs;
  }

function dedupe(arr) {
    const seen = new Set();
    const out = [];
    for (const s of arr) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    return out;
  }

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error("Raw SVG dir not found:", RAW_DIR);
    process.exit(2);
  }
  ensureDir(STROKES_DIR);
  ensureDir(DATA_DIR);

  const svgs = listSvgs(RAW_DIR);
  if (!svgs.length) {
    console.error("No SVG files found in:", RAW_DIR);
    process.exit(3);
  }

  const items = [];
  const ids = [];
  let converted = 0;

  for (const svgPath of svgs) {
    const ch = getCharFromFilename(svgPath);
    if (!ch) continue;

    const id = makeId(kind, ch);
    const svg = fs.readFileSync(svgPath, "utf-8");
    const ds = extractPathDs(svg);
    if (!ds.length) {
      // pathが取れないSVGはスキップ（ログだけ残す）
      console.warn("⚠️  no <path d> found, skipped:", path.basename(svgPath));
      continue;
    }

    const strokesJson = { strokes: ds.map((d) => ({ path: d })) };
    const outStroke = path.join(STROKES_DIR, `${id}.json`);
    writeJson(outStroke, strokesJson);

    // game data
    items.push({
      id,
      char: ch,
      strokesRef: `strokes/${kind}/${id}.json`,
    });
    ids.push(id);
    converted++;
  }

  // 安定ソート（ひらがな/カタカナのコード順）
  items.sort((a, b) => String(a.char).localeCompare(String(b.char), "ja"));
  const sortedIds = items.map((x) => x.id);

  writeJson(ALL_PATH, items);
  writeJson(IDX_PATH, sortedIds);

  console.log("✅ Imported", kind);
  console.log("  SVG files:", svgs.length);
  console.log("  Converted:", converted);
  console.log("  Wrote strokes:", STROKES_DIR);
  console.log("  Wrote:", ALL_PATH);
  console.log("  Wrote:", IDX_PATH);
}

try {
    main();
  } catch (e) {
    console.error("❌ importKanaFromRawSvg failed:", e?.stack ?? e);
    process.exit(99);
  }