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
// ✅ strokesvg(dist) の正しい取り方：
  // 1) <defs> 内の <path id="..." d="..."> を辞書化
  // 2) <g data-strokesvg="strokes"> 内の <use href="#id" style="--i:N"> を順番に集め
  // 3) id -> d を引いて strokes にする

  const defsMap = new Map(); // id -> d
  const reDefPath = /<path\b[^>]*\bid="([^"]+)"[^>]*\sd="([^"]+)"/gi;
  let dm;
  while ((dm = reDefPath.exec(svgText))) {
    const id = (dm[1] ?? "").trim();
    const d = (dm[2] ?? "").trim();
    if (id && d) defsMap.set(id, d);
  }

  const strokesGroup = extractGroupByAttr(svgText, "g", "data-strokesvg", "strokes");
  const target = strokesGroup ?? svgText;

  // <use href="#3042a" style="--i:0" .../>
  // xlink:href 版も拾う
  const uses = [];
  const reUse = /<use\b[^>]*(?:href|xlink:href)=["']#([^"']+)["'][^>]*\bstyle=["'][^"']*--i:(\d+)[^"']*["'][^>]*\/?>/gi;
  let um;
  while ((um = reUse.exec(target))) {
    const id = (um[1] ?? "").trim();
    const i = Number(um[2]);
    if (!id || !Number.isFinite(i)) continue;
    uses.push({ i, id });
  }

  if (uses.length > 0) {
    uses.sort((a, b) => a.i - b.i);
    const out = [];
    for (const u of uses) {
      const d = defsMap.get(u.id);
      if (d) out.push(d);
    }
    return dedupe(out);
  }

  // それ以外のSVG（保険）：従来通り path d を全部拾う
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

// data-strokesvg="strokes" の <g> を “ネスト対応で” 抜く（正規表現だけだと途中で切れるため）
function extractGroupByAttr(src, tagName, attrName, attrValue) {
    const openRe = new RegExp(`<${tagName}\\b[^>]*${attrName}=["']${attrValue}["'][^>]*>`, "i");
    const m = openRe.exec(src);
    if (!m) return null;
    const startIdx = m.index + m[0].length;
  
    // ネストした <g> を数える
    let depth = 1;
    let i = startIdx;
    const len = src.length;
    const openTag = new RegExp(`<${tagName}\\b`, "ig");
    const closeTag = new RegExp(`</${tagName}>`, "ig");
    openTag.lastIndex = startIdx;
    closeTag.lastIndex = startIdx;
  
    while (i < len) {
      const no = openTag.exec(src);
      const nc = closeTag.exec(src);
      if (!nc) break;
      if (no && no.index < nc.index) {
        depth++;
        i = no.index + 1;
        continue;
      } else {
        depth--;
        if (depth === 0) {
          const endIdx = nc.index;
          return src.slice(startIdx, endIdx);
        }
        i = nc.index + 1;
        continue;
      }
    }
    return null;
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