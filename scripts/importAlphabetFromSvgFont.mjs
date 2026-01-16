/**
+ * Convert SVG font (ReliefSingleLineSVG-Regular.svg) into strokes json files.
+ *
+ * Output:
+ *  public/data/strokes/alphabet/upper/ALPHA_U0041.json ... (A-Z)
+ *  public/data/strokes/alphabet/lower/ALPHA_L0061.json ... (a-z)
+ *  public/data/alphabet/alphabet_upper_all.json
+ *  public/data/alphabet/alphabet_lower_all.json
+ *  public/data/alphabet/index_traceable_alphabet_upper.json
+ *  public/data/alphabet/index_traceable_alphabet_lower.json
+ *
+ * Run:
+ *  node scripts/importAlphabetFromSvgFont.mjs
+ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const FONT_PATH = path.join(ROOT, "assets", "fonts", "ReliefSingleLineSVG-Regular.svg");

const OUT_STROKES_U = path.join(ROOT, "public/data/strokes/alphabet/upper");
const OUT_STROKES_L = path.join(ROOT, "public/data/strokes/alphabet/lower");
const OUT_ALPHA_DIR = path.join(ROOT, "public/data/alphabet");

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

function writeJson(p,obj){
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj,null,2), "utf-8");
}

function hex4(cp){ return cp.toString(16).toUpperCase().padStart(4,"0"); }

function idUpper(ch){ return `ALPHA_U${hex4(ch.codePointAt(0))}`; } // 例: A -> ALPHA_U0041
function idLower(ch){ return `ALPHA_L${hex4(ch.codePointAt(0))}`; } // 例: a -> ALPHA_L0061

function splitSubpaths(d){
  // "M ... M ..." を stroke として分割（最小実装）
  const parts = [];
  let cur = "";
  for (let i=0;i<d.length;i++){
    const c=d[i];
    if ((c==="M" || c==="m") && cur.trim()){
      parts.push(cur.trim());
      cur = c;
    } else {
      cur += c;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseGlyphMap(svg){
  // SVG font: <glyph unicode="A" d="..."/>
  const map = new Map(); // unicode char -> d
  const re = /<glyph\b[^>]*\bunicode="([^"]+)"[^>]*\bd="([^"]+)"/gi;
  let m;
  while ((m = re.exec(svg))){
    const uni = m[1];
    const d = m[2];
    // unicodeが複数文字やエンティティの場合はスキップ（今回はA-Z/a-zのみ）
    if (!uni || uni.length !== 1) continue;
    map.set(uni, d);
  }
  return map;
}

function main(){
  if (!fs.existsSync(FONT_PATH)){
    console.error("Font not found:", FONT_PATH);
    console.error("Run: node scripts/fetchReliefSingleLineFont.mjs");
    process.exit(2);
  }
  const svg = fs.readFileSync(FONT_PATH, "utf-8");
  const glyph = parseGlyphMap(svg);
  if (glyph.size === 0){
    throw new Error("No glyphs found (unicode+d). The svg font format may differ.");
  }

  ensureDir(OUT_STROKES_U);
  ensureDir(OUT_STROKES_L);
  ensureDir(OUT_ALPHA_DIR);

  const upperAll = [];
  const lowerAll = [];
  const upperIds = [];
  const lowerIds = [];

  // A-Z
  for (let cp = "A".codePointAt(0); cp <= "Z".codePointAt(0); cp++){
    const ch = String.fromCodePoint(cp);
    const d = glyph.get(ch);
    if (!d){
      console.warn("⚠️ missing glyph:", ch);
      continue;
    }
    const id = idUpper(ch);
    const strokes = splitSubpaths(d).map((p)=>({ path: p }));
    writeJson(path.join(OUT_STROKES_U, `${id}.json`), { strokes });
    upperAll.push({ id, letter: ch, strokesRef: `strokes/alphabet/upper/${id}.json` });
    upperIds.push(id);
  }

  // a-z
  for (let cp = "a".codePointAt(0); cp <= "z".codePointAt(0); cp++){
    const ch = String.fromCodePoint(cp);
    const d = glyph.get(ch);
    if (!d){
      console.warn("⚠️ missing glyph:", ch);
      continue;
    }
    const id = idLower(ch);
    const strokes = splitSubpaths(d).map((p)=>({ path: p }));
    writeJson(path.join(OUT_STROKES_L, `${id}.json`), { strokes });
    lowerAll.push({ id, letter: ch, strokesRef: `strokes/alphabet/lower/${id}.json` });
    lowerIds.push(id);
  }

  writeJson(path.join(OUT_ALPHA_DIR, "alphabet_upper_all.json"), upperAll);
  writeJson(path.join(OUT_ALPHA_DIR, "alphabet_lower_all.json"), lowerAll);
  writeJson(path.join(OUT_ALPHA_DIR, "index_traceable_alphabet_upper.json"), upperIds);
  writeJson(path.join(OUT_ALPHA_DIR, "index_traceable_alphabet_lower.json"), lowerIds);

  console.log("✅ alphabet imported");
  console.log(" upper:", upperAll.length, " lower:", lowerAll.length);
}

main();
