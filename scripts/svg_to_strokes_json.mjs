/**
+ * SVG の <path d="..."> を出現順に抜いて
+ * { strokes: [ { path }, ... ] } を作る最小スクリプト。
+ *
+ * 使い方:
+ *   node scripts/svg_to_strokes_json.mjs \
+ *     --in public/data/raw_svg/hiragana/a.svg \
+ *     --out public/data/strokes/hiragana/HIRA_A.json
+ */
import fs from "node:fs";
import path from "node:path";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const inFile = arg("--in");
const outFile = arg("--out");

if (!inFile || !outFile) {
  console.error("Usage: node scripts/svg_to_strokes_json.mjs --in <svg> --out <json>");
  process.exit(1);
}

const svg = fs.readFileSync(inFile, "utf-8");
const paths = [];
const re = /<path\b[^>]*\sd="([^"]+)"/g;
let m;
while ((m = re.exec(svg))) {
  const d = m[1]?.trim();
  if (d) paths.push(d);
}

if (!paths.length) {
  console.error("No <path d=...> found:", inFile);
  process.exit(2);
}

const json = { strokes: paths.map((d) => ({ path: d })) };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(json, null, 2), "utf-8");
console.log("✅ wrote:", outFile, "strokes=", json.strokes.length);
