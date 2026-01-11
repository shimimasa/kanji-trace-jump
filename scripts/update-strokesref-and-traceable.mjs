// scripts/update-strokesref-and-traceable.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const KANJI_ALL = path.resolve(ROOT, "public/data/kanji/kanji_all.json");
const STROKES_DIR = path.resolve(ROOT, "public/data/strokes");
const OUT_TRACEABLE = path.resolve(ROOT, "public/data/kanji/index_traceable.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

// public/data/strokes/g2/g2-001.json を見つけたら
// strokesRef = "strokes/g2/g2-001.json" にする
function collectStrokeRefs() {
  const out = new Map(); // id -> strokesRef
  if (!fs.existsSync(STROKES_DIR)) return out;

  const grades = fs.readdirSync(STROKES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const g of grades) {
    const dir = path.join(STROKES_DIR, g);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    for (const f of files) {
      const id = path.basename(f, ".json"); // g2-001
      const ref = `strokes/${g}/${f}`;      // public配下からの相対参照
      out.set(id, ref);
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(KANJI_ALL)) {
    throw new Error(`kanji_all.json not found: ${KANJI_ALL}`);
  }

  const all = readJson(KANJI_ALL);
  if (!Array.isArray(all)) throw new Error("kanji_all.json must be an array");

  const map = collectStrokeRefs();

  let updated = 0;
  for (const e of all) {
    if (!e?.id) continue;
    const ref = map.get(e.id);
    if (ref && e.strokesRef !== ref) {
      e.strokesRef = ref;
      updated++;
    }
  }

  // traceable = strokesRefがあるID
  const traceable = all.filter(e => !!e.strokesRef).map(e => e.id);

  writeJson(KANJI_ALL, all);
  writeJson(OUT_TRACEABLE, traceable);

  console.log("✅ Updated strokesRef:", updated);
  console.log("✅ Traceable:", traceable.length);
  console.log(" -", KANJI_ALL);
  console.log(" -", OUT_TRACEABLE);
}

main();
