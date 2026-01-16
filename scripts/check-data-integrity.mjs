
// scripts/check-data-integrity.mjs
// data integrity checker: all.json <-> index_traceable*.json
// Usage:
//   node scripts/check-data-integrity.mjs
//   node scripts/check-data-integrity.mjs --root public/data
//
// Exit codes:
//   0: ok (no mismatch)
//   2: mismatch found
//   1: error

import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const rootArgIdx = process.argv.indexOf("--root");
const ROOT = rootArgIdx >= 0 ? process.argv[rootArgIdx + 1] : "public/data";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asIdSet(arr, label) {
  if (!Array.isArray(arr)) throw new Error(`${label} must be an array`);
  const s = new Set();
  for (const x of arr) s.add(String(x));
  return s;
}

function asAllIdSet(arr) {
  if (!Array.isArray(arr)) throw new Error(`all.json must be an array`);
  const s = new Set();
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    if (!it.id) continue;
    s.add(String(it.id));
  }
  return s;
}

function diff(aSet, bSet) {
  // a - b
  const out = [];
  for (const x of aSet) if (!bSet.has(x)) out.push(x);
  return out;
}

function printSection(title, items, max = 20) {
  if (!items.length) return;
  console.log(`\n[${title}] count=${items.length}`);
  items.slice(0, max).forEach((x) => console.log(" -", x));
  if (items.length > max) console.log(` ... and ${items.length - max} more`);
}

function checkPair(name, allPath, tracePath) {
  const allFile = path.join(ROOT, allPath);
  const trFile = path.join(ROOT, tracePath);

  if (!fs.existsSync(allFile)) throw new Error(`missing: ${allFile}`);
  if (!fs.existsSync(trFile)) throw new Error(`missing: ${trFile}`);

  const all = readJson(allFile);
  const tr = readJson(trFile);
  const allIds = asAllIdSet(all);
  const trIds = asIdSet(tr, "traceable index");

  const inTraceNotInAll = diff(trIds, allIds);
  const inAllNotInTrace = diff(allIds, trIds);

  console.log(`\n=== ${name} ===`);
  console.log(`all: ${allIds.size} ids / traceable: ${trIds.size} ids`);
  printSection("traceable-but-missing-in-all", inTraceNotInAll);
  printSection("all-but-not-traceable", inAllNotInTrace);

  return { inTraceNotInAll, inAllNotInTrace };
}

function main() {
  const targets = [
    // kanji
    ["kanji", "kanji/kanji_all.json", "kanji/index_traceable.json"],
    // hiragana / katakana
    ["hiragana", "hiragana/hiragana_all.json", "hiragana/index_traceable_hiragana.json"],
    ["katakana", "katakana/katakana_all.json", "katakana/index_traceable_katakana.json"],
    // alphabet (files exist at public/data/alphabet/*.json)
    ["alphabet_upper", "alphabet/alphabet_upper_all.json", "alphabet/index_traceable_alphabet_upper.json"],
    ["alphabet_lower", "alphabet/alphabet_lower_all.json", "alphabet/index_traceable_alphabet_lower.json"],
    // romaji (optional)
    ["romaji", "romaji/romaji_all.json", "romaji/index_traceable_romaji.json"],
  ];

  let mismatch = false;
  for (const [name, allPath, tracePath] of targets) {
    // romaji は無い可能性があるので存在時だけチェック
    const allFile = path.join(ROOT, allPath);
    const trFile = path.join(ROOT, tracePath);
    if (name === "romaji" && (!fs.existsSync(allFile) || !fs.existsSync(trFile))) {
      console.log(`\n=== romaji ===\nskip (files not found)`);
      continue;
    }

    const r = checkPair(name, allPath, tracePath);
    if (r.inTraceNotInAll.length || r.inAllNotInTrace.length) mismatch = true;
  }

  console.log("\n=== SUMMARY ===");
  if (mismatch) {
    console.log("Mismatch found.");
    process.exit(2);
  } else {
    console.log("OK (no mismatch).");
    process.exit(0);
  }
}

try {
  main();
} catch (e) {
  console.error("\n[FATAL]", e?.message ?? e);
  process.exit(1);
}