// scripts/check-kanji-missing-traceable-strokes.mjs
// B案の準備：allにはいるが traceable にいないIDについて、
// strokesRef が実ファイルとして存在するかを検査する。
//
// Usage:
//   node scripts/check-kanji-missing-traceable-strokes.mjs
//   node scripts/check-kanji-missing-traceable-strokes.mjs --root public/data

import fs from "node:fs";
import path from "node:path";

const rootArgIdx = process.argv.indexOf("--root");
const ROOT = rootArgIdx >= 0 ? process.argv[rootArgIdx + 1] : "public/data";

const tracePath = path.join(ROOT, "kanji/index_traceable.json");
const allPath = path.join(ROOT, "kanji/kanji_all.json");
const strokesRoot = path.join(ROOT, "strokes"); // public/data/strokes/...

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  if (!fs.existsSync(tracePath)) throw new Error(`missing: ${tracePath}`);
  if (!fs.existsSync(allPath)) throw new Error(`missing: ${allPath}`);

  const trace = readJson(tracePath);
  const all = readJson(allPath);

  const traceSet = new Set(trace.map(String));
  const byId = new Map();
  for (const it of all) {
    if (it?.id) byId.set(String(it.id), it);
  }

  const missing = [...byId.keys()].filter((id) => !traceSet.has(id)).sort();

  const ok = [];
  const ng = [];

  for (const id of missing) {
    const it = byId.get(id);
    const ref = String(it?.strokesRef ?? "");
    // strokesRef は "strokes/g2/g2-001.json" 形式なので、public/data/strokes から解決
    const full = ref ? path.join(strokesRoot, ref.replace(/^strokes\//, "")) : "";
    const exists = full && fs.existsSync(full);
    (exists ? ok : ng).push({ id, strokesRef: ref, file: full, exists });
  }
  console.log("\n=== check missing-traceable kanji strokes (B plan prep) ===");
  console.log(`root: ${ROOT}`);
  console.log(`missing in traceable: ${missing.length}`);
  console.log(`strokes exists: ${ok.length}`);
  console.log(`strokes missing: ${ng.length}`);

  if (ng.length) {
    console.log("\n[strokes missing]");
    ng.slice(0, 30).forEach((x) => console.log(` - ${x.id}  ref=${x.strokesRef}`));
    if (ng.length > 30) console.log(` ... and ${ng.length - 30} more`);
  }

  // exit code: missing strokes があれば 2
  process.exit(ng.length ? 2 : 0);
}

try {
  main();
} catch (e) {
  console.error("\n[FATAL]", e?.message ?? e);
  process.exit(1);
}