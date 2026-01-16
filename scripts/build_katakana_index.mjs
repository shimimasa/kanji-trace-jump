/** Begin Patch
** Add File: scripts/build_katakana_index.mjs
/**
+ * public/data/strokes/katakana/*.json を元に
+ * katakana_all.json と index_traceable_katakana.json を生成する。
+ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const STROKES_DIR = path.join(ROOT, "public/data/strokes/katakana");
const OUT_ALL = path.join(ROOT, "public/data/katakana/katakana_all.json");
const OUT_IDX = path.join(ROOT, "public/data/katakana/index_traceable_katakana.json");

function kanaFromId(id) {
  const map = {
    KATA_A: "ア",
    KATA_I: "イ",
    KATA_U: "ウ",
    KATA_E: "エ",
    KATA_O: "オ",
  };
  return map[id] ?? "?";
}

const files = fs.existsSync(STROKES_DIR)
  ? fs.readdirSync(STROKES_DIR).filter((f) => f.endsWith(".json"))
  : [];

const ids = files.map((f) => path.basename(f, ".json")).sort();
const all = ids.map((id) => ({
  id,
  char: kanaFromId(id),
  strokesRef: `strokes/katakana/${id}.json`,
}));

fs.mkdirSync(path.dirname(OUT_ALL), { recursive: true });
fs.writeFileSync(OUT_ALL, JSON.stringify(all, null, 2), "utf-8");
fs.writeFileSync(OUT_IDX, JSON.stringify(ids, null, 2), "utf-8");
console.log("✅ wrote:", OUT_ALL);
console.log("✅ wrote:", OUT_IDX);
