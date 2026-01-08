#!/usr/bin/env node
/**
 * scripts/svg-to-strokes.mjs
 *
 * Convert per-kanji SVGs to strokes JSON (schemaVersion 1.0, id-based filenames).
 *
 * INPUT:
 * - proto JSON: public/data/kanji_g1_proto.json (array)
 * - svg dir:    public/svg/g1/*.svg  (filename should be the kanji, e.g. 木.svg)
 *
 * OUTPUT:
 * - public/data/strokes/g1/{id}.json
 *
 * Notes:
 * - This script prioritizes <path data-stroke="N"> ordering.
 * - If data-stroke is missing, it uses document order.
 * - start/end are derived from the path "d" by extracting first/last coordinate pairs.
 * - Best with M/L-only paths. Curves are kept as-is, but start/end extraction is approximate.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    grade: 1,
    svgDir: "public/svg/g1",
    proto: "public/data/kanji_g1_proto.json",
    out: "public/data/strokes/g1",
    dryRun: false,
    overwrite: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--grade") args.grade = Number(next), i++;
    else if (a === "--svgDir") args.svgDir = next, i++;
    else if (a === "--proto") args.proto = next, i++;
    else if (a === "--out") args.out = next, i++;
    else if (a === "--dryRun") args.dryRun = true;
    else if (a === "--no-overwrite") args.overwrite = false;
  }
  return args;
}

const args = parseArgs(process.argv);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
});

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function walkCollectPaths(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const n of node) walkCollectPaths(n, out);
    return out;
  }
  if (!isObject(node)) return out;

  // If this object directly has path(s)
  if (node.path) {
    const p = node.path;
    if (Array.isArray(p)) out.push(...p);
    else out.push(p);
  }

  // Recurse into all properties
  for (const k of Object.keys(node)) {
    if (k === "path") continue;
    walkCollectPaths(node[k], out);
  }
  return out;
}

// Extract viewBox; default to 0 0 100 100
function getViewBox(svgObj) {
  const vb = svgObj?.svg?.["@_viewBox"] || svgObj?.["@_viewBox"];
  if (!vb) return [0, 0, 100, 100];
  const parts = String(vb).trim().split(/[ ,]+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) return parts;
  return [0, 0, 100, 100];
}

// Parse "d" and extract first and last coordinate pairs (approx).
// Works best for M/L-only paths. Keeps curve commands untouched.
function extractStartEnd(d) {
  const tokens = String(d).match(/[A-Za-z]|-?\d*\.?\d+/g);
  if (!tokens) return { start: [0, 0], end: [0, 0] };

  let start = null;
  let last = null;

  // We interpret coordinate pairs as x,y in sequence after commands.
  // For robust behavior, we just collect all numbers and take first pair and last pair.
  const nums = tokens.filter((t) => t !== "M" && t !== "L" && t !== "C" && t !== "Q" && t !== "S" && t !== "T" && t !== "H" && t !== "V" && t !== "Z" && t !== "z")
    .map(Number)
    .filter(Number.isFinite);

  if (nums.length >= 2) start = [nums[0], nums[1]];
  if (nums.length >= 2) last = [nums[nums.length - 2], nums[nums.length - 1]];

  return { start: start ?? [0, 0], end: last ?? start ?? [0, 0] };
}

function getDataStroke(p) {
  const raw =
    p?.["@_data-stroke"] ??
    p?.["@_dataStroke"] ??
    p?.["@_stroke"] ??
    p?.["@_data-index"] ??
    p?.["@_dataIndex"];
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Normalize coordinates to [0..100] if SVG viewBox isn't already 0..100
// This is a simple numeric scaling on all numbers in "d".
// Best for M/L-only paths.
function normalizePathDTo100(d, vb) {
  const [minX, minY, w, h] = vb;
  if (minX === 0 && minY === 0 && w === 100 && h === 100) return String(d);

  // Replace numbers in sequence; assume they alternate x,y for M/L.
  const tokens = String(d).match(/[A-Za-z]|-?\d*\.?\d+/g);
  if (!tokens) return String(d);

  let isX = true;
  const out = tokens.map((t) => {
    if (/^[A-Za-z]$/.test(t)) {
      // reset x/y expectation at moveto/lineto (rough)
      if (t === "M" || t === "L" || t === "C" || t === "Q" || t === "S" || t === "T") isX = true;
      return t;
    }
    const num = Number(t);
    if (!Number.isFinite(num)) return t;

    let v;
    if (isX) v = ((num - minX) / w) * 100;
    else v = ((num - minY) / h) * 100;

    isX = !isX;
    return Number.isFinite(v) ? String(+v.toFixed(2)) : t;
  });

  return out.join(" ");
}

async function main() {
  const protoPath = path.resolve(process.cwd(), args.proto);
  const svgDir = path.resolve(process.cwd(), args.svgDir);
  const outDir = path.resolve(process.cwd(), args.out);

  const protoRaw = await fs.readFile(protoPath, "utf-8");
  const proto = JSON.parse(protoRaw);
  if (!Array.isArray(proto)) {
    throw new Error("proto JSON must be an array");
  }

  // Map kanji -> proto item (for the given grade)
  const map = new Map();
  for (const it of proto) {
    if (!it?.kanji || !it?.id) continue;
    const g = Number(it.grade ?? args.grade);
    if (g !== args.grade) continue;
    map.set(it.kanji, it);
  }

  await fs.mkdir(outDir, { recursive: true });

  const files = await fs.readdir(svgDir);
  const svgFiles = files.filter((f) => f.toLowerCase().endsWith(".svg"));

  let ok = 0, skip = 0, fail = 0;

  for (const f of svgFiles) {
    const kanji = path.basename(f, ".svg"); // expects 木.svg etc
    const it = map.get(kanji);
    if (!it) {
      console.warn(`[SKIP] proto not found for kanji="${kanji}" (file=${f})`);
      skip++;
      continue;
    }

    const svgPath = path.join(svgDir, f);
    const xml = await fs.readFile(svgPath, "utf-8");

    let parsed;
    try {
      parsed = parser.parse(xml);
    } catch (e) {
      console.error(`[FAIL] XML parse failed: ${f}`, e);
      fail++;
      continue;
    }

    const vb = getViewBox(parsed);
    const paths = walkCollectPaths(parsed?.svg ?? parsed).filter((p) => p?.["@_d"] || p?.["@_D"] || p?.d);

    // Normalize path objects to { d, dataStroke }
    let strokes = paths
      .map((p) => {
        const d = p?.["@_d"] ?? p?.["@_D"] ?? p?.d;
        if (!d) return null;
        const ds = getDataStroke(p);
        return { d: String(d), dataStroke: ds };
      })
      .filter(Boolean);

    if (strokes.length === 0) {
      console.error(`[FAIL] No <path d="..."> found in ${f}`);
      fail++;
      continue;
    }

    // ---------------------------------------------------------
    // Filtering / Dedup (重要)
    // 1) data-stroke があるSVGは、data-stroke付きのみ採用（補助パス除外）
    // 2) (dataStroke, d) が同一のものは重複除去（同じ線が2回入る問題を潰す）
    // ---------------------------------------------------------
    const hasAnyDS = strokes.some((s) => s.dataStroke != null);
    if (hasAnyDS) {
      strokes = strokes.filter((s) => s.dataStroke != null);
    }

    // Sort by data-stroke if present, else document order
    if (hasAnyDS) {
      strokes.sort((a, b) => (a.dataStroke ?? 9999) - (b.dataStroke ?? 9999));
    }

    // Deduplicate exact duplicates
    const seen = new Set();
    const deduped = [];
    for (const s of strokes) {
      const key = `${s.dataStroke ?? "na"}::${s.d.trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(s);
    }
    strokes = deduped;

    const outStrokes = strokes.map((s, idx) => {
      const d100 = normalizePathDTo100(s.d, vb);
      const { start, end } = extractStartEnd(d100);
      return {
        index: idx + 1,
        path: d100,
        start: [Number(start[0]), Number(start[1])],
        end: [Number(end[0]), Number(end[1])],
      };
    });

    const outJson = {
      schemaVersion: "1.0",
      id: it.id,
      kanji,
      grade: Number(it.grade ?? args.grade),
      strokeCount: outStrokes.length,
      viewBox: [0, 0, 100, 100],
      strokes: outStrokes,
    };

    const outPath = path.join(outDir, `${it.id}.json`);
    if (!args.overwrite) {
      try {
        await fs.access(outPath);
        console.warn(`[SKIP] exists: ${outPath}`);
        skip++;
        continue;
      } catch {
        // not exists
      }
    }

    if (args.dryRun) {
      console.log(`[DRY] would write: ${outPath} (strokes=${outStrokes.length})`);
    } else {
      await fs.writeFile(outPath, JSON.stringify(outJson, null, 2), "utf-8");
      console.log(`[OK] ${kanji} -> ${path.relative(process.cwd(), outPath)} (strokes=${outStrokes.length})`);
    }
    ok++;
  }

  console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
