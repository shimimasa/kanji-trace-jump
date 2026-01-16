// scripts/sync-kanji-all-to-traceable.mjs
// A案：traceable を正として、kanji_all.json を安全に整合させる
//
// 目的：
// - all.json にいるが traceable にいないID（=出題されないID）を除外して母数ズレを解消
//
// Usage:
//   node scripts/sync-kanji-all-to-traceable.mjs
//   node scripts/sync-kanji-all-to-traceable.mjs --root public/data
//   node scripts/sync-kanji-all-to-traceable.mjs --dry
//
// 出力：
// - (dryでなければ) public/data/kanji/kanji_all.json を上書き// - public/data/kanji/_report_sync_kanji_all_to_traceable.json を生成

import fs from "node:fs";
import path from "node:path";

const rootArgIdx = process.argv.indexOf("--root");
const ROOT = rootArgIdx >= 0 ? process.argv[rootArgIdx + 1] : "public/data";
const DRY = process.argv.includes("--dry") || process.argv.includes("--dry-run");

const tracePath = path.join(ROOT, "kanji/index_traceable.json");
const allPath = path.join(ROOT, "kanji/kanji_all.json");
const reportPath = path.join(ROOT, "kanji/_report_sync_kanji_all_to_traceable.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function main() {
  if (!fs.existsSync(tracePath)) throw new Error(`missing: ${tracePath}`);
  if (!fs.existsSync(allPath)) throw new Error(`missing: ${allPath}`);

  const trace = readJson(tracePath);
  const all = readJson(allPath);

  if (!Array.isArray(trace)) throw new Error("index_traceable.json must be an array");
  if (!Array.isArray(all)) throw new Error("kanji_all.json must be an array");

  const traceSet = new Set(trace.map(String));
  const allIds = all.map((x) => String(x?.id ?? "")).filter(Boolean);
  const allSet = new Set(allIds);

  const allButNotTrace = [...allSet].filter((id) => !traceSet.has(id)).sort();
  const traceButNotAll = [...traceSet].filter((id) => !allSet.has(id)).sort();

  const filtered = all.filter((it) => it && traceSet.has(String(it.id)));

  const report = {
    at: Date.now(),
    root: ROOT,
    allCount: all.length,
    traceCount: trace.length,
    nextAllCount: filtered.length,
    removedCount: allButNotTrace.length,
    removedIds: allButNotTrace,
    traceButMissingInAllCount: traceButNotAll.length,
    traceButMissingInAllIds: traceButNotAll,
    dryRun: DRY,
  };

  console.log("\n=== sync kanji_all.json to index_traceable.json (A plan) ===");
  console.log(`root: ${ROOT}`);
  console.log(`all: ${all.length}, traceable: ${trace.length}, nextAll: ${filtered.length}`);
  console.log(`removed (all-but-not-traceable): ${allButNotTrace.length}`);
  if (allButNotTrace.length) console.log("  e.g.", allButNotTrace.slice(0, 10).join(", "), allButNotTrace.length > 10 ? "..." : "");
  console.log(`traceable-but-missing-in-all: ${traceButNotAll.length}`);

  // reportは必ず出す
  writeJson(reportPath, report);
  console.log(`[ok] wrote report: ${reportPath}`);

  if (DRY) {
    console.log("[dry-run] did not modify kanji_all.json");
    return;
  }

  writeJson(allPath, filtered);
  console.log(`[ok] updated: ${allPath}`);
}

try {
  main();
} catch (e) {
  console.error("\n[FATAL]", e?.message ?? e);
  process.exit(1);
}