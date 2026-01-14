/**
+ * public/data/strokes/alphabet/(upper|lower) を元に
+ * alphabet_upper_all.json / alphabet_lower_all.json と
+ * index_traceable_alphabet.json を生成する。
+ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const U_DIR = path.join(ROOT, "public/data/strokes/alphabet/upper");
const L_DIR = path.join(ROOT, "public/data/strokes/alphabet/lower");

const OUT_UP = path.join(ROOT, "public/data/alphabet/alphabet_upper_all.json");
const OUT_LO = path.join(ROOT, "public/data/alphabet/alphabet_lower_all.json");
const OUT_IDX = path.join(ROOT, "public/data/alphabet/index_traceable_alphabet.json");

function letterFromId(id) {
  const map = {
    ALPHA_U_A: "A",
    ALPHA_U_B: "B",
    ALPHA_U_C: "C",
    ALPHA_L_A: "a",
    ALPHA_L_B: "b",
    ALPHA_L_C: "c",
  };
  return map[id] ?? "?";
}

function listIds(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.basename(f, ".json")).sort();
}

const upperIds = listIds(U_DIR);
const lowerIds = listIds(L_DIR);
const allIds = [...upperIds, ...lowerIds];

const upperAll = upperIds.map((id) => ({
  id,
  letter: letterFromId(id),
  strokesRef: `strokes/alphabet/upper/${id}.json`,
}));

const lowerAll = lowerIds.map((id) => ({
  id,
  letter: letterFromId(id),
  strokesRef: `strokes/alphabet/lower/${id}.json`,
}));

fs.mkdirSync(path.dirname(OUT_UP), { recursive: true });
fs.writeFileSync(OUT_UP, JSON.stringify(upperAll, null, 2), "utf-8");
fs.writeFileSync(OUT_LO, JSON.stringify(lowerAll, null, 2), "utf-8");
fs.writeFileSync(OUT_IDX, JSON.stringify(allIds, null, 2), "utf-8");

console.log("✅ wrote:", OUT_UP);
console.log("✅ wrote:", OUT_LO);
console.log("✅ wrote:", OUT_IDX);