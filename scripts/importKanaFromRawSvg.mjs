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
  const out = [];
  const re = /<path\b[^>]*\sd="([^"]+)"/g;
  let m;
  while ((m = re.exec(svgText))) {
    const d = (m[1] ?? "").trim();
    if (d) out.push(d);
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