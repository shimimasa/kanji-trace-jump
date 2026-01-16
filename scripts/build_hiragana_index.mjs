
/**
+ * public/data/strokes/hiragana/*.json を元に
+ * hiragana_all.json と index_traceable_hiragana.json を生成する。
+ *
+ * 期待:
+ *   strokes/hiragana/HIRA_A.json など
+ *
+ * 使い方:
+ *   node scripts/build_hiragana_index.mjs
+ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const STROKES_DIR = path.join(ROOT, "public/data/strokes/hiragana");
const OUT_ALL = path.join(ROOT, "public/data/hiragana/hiragana_all.json");
const OUT_IDX = path.join(ROOT, "public/data/hiragana/index_traceable_hiragana.json");

function kanaFromId(id) {
  // とりあえず手動で拡張（最初は あ行だけで十分）
  const map = {
    HIRA_A: "あ",
    HIRA_I: "い",
    HIRA_U: "う",
    HIRA_E: "え",
    HIRA_O: "お",
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
  strokesRef: `strokes/hiragana/${id}.json`,
}));

fs.mkdirSync(path.dirname(OUT_ALL), { recursive: true });
fs.writeFileSync(OUT_ALL, JSON.stringify(all, null, 2), "utf-8");
fs.writeFileSync(OUT_IDX, JSON.stringify(ids, null, 2), "utf-8");
console.log("✅ wrote:", OUT_ALL);
console.log("✅ wrote:", OUT_IDX);
