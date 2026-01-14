/**
+ * public/data/strokes/romaji/*.json を元に
+ * romaji_all.json と index_traceable_romaji.json を生成する。
+ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const STROKES_DIR = path.join(ROOT, "public/data/strokes/romaji");
const OUT_ALL = path.join(ROOT, "public/data/romaji/romaji_all.json");
const OUT_IDX = path.join(ROOT, "public/data/romaji/index_traceable_romaji.json");

function textFromId(id) {
  const map = {
    ROM_A: "a",
    ROM_I: "i",
    ROM_U: "u",
    ROM_E: "e",
    ROM_O: "o",
  };
  return map[id] ?? "?";
}

const files = fs.existsSync(STROKES_DIR)
  ? fs.readdirSync(STROKES_DIR).filter((f) => f.endsWith(".json"))
  : [];

const ids = files.map((f) => path.basename(f, ".json")).sort();
const all = ids.map((id) => ({
  id,
  text: textFromId(id),
  strokesRef: `strokes/romaji/${id}.json`,
}));

fs.mkdirSync(path.dirname(OUT_ALL), { recursive: true });
fs.writeFileSync(OUT_ALL, JSON.stringify(all, null, 2), "utf-8");
fs.writeFileSync(OUT_IDX, JSON.stringify(ids, null, 2), "utf-8");
console.log("✅ wrote:", OUT_ALL);
console.log("✅ wrote:", OUT_IDX);