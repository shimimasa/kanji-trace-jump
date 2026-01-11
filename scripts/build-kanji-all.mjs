// scripts/build-kanji-all.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IN_DIR = path.resolve(ROOT, "public", "data", "ヨミタビの漢字データ");

const OUT_DIR = path.resolve(ROOT, "public", "data", "kanji");
const OUT_ALL = path.join(OUT_DIR, "kanji_all.json");
const OUT_GRADE = path.join(OUT_DIR, "index_grade.json");
const OUT_TRACEABLE = path.join(OUT_DIR, "index_traceable.json");

// もし trace 用（strokesRefあり）のデータも注入したいならここに追加
// 例: path.resolve(ROOT, "public", "data", "kanji_g1_proto.json")
const EXTRA_TRACE_SOURCES = [];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function normalizeEntry(x) {
  const id = x?.id;
  const kanji = x?.kanji ?? x?.label ?? null;

  // gradeは number で統一
  const grade = Number(x?.grade ?? x?.originalGrade ?? 0) || null;

  // strokes（本数）を strokeCount に寄せる
  const strokeCount =
    Number(x?.strokes ?? x?.strokeCount ?? x?.stroke ?? x?.strokeNum ?? 0) || null;

  // onyomi/kunyomi は配列のまま（空文字は除外）
  const onyomi = Array.isArray(x?.onyomi) ? x.onyomi.filter(Boolean) : [];
  const kunyomi = Array.isArray(x?.kunyomi) ? x.kunyomi.filter(Boolean) : [];

  // 例文は「今は使わない」けど保持しておくと後で楽
  const exampleSentence = x?.exampleSentence ?? null;

  // strokesRef は trace 用に将来注入できる
  const strokesRef = x?.strokesRef ?? null;

  return {
    id,
    kanji,
    grade,
    strokeCount,
    onyomi,
    kunyomi,
    meaning: x?.meaning ?? null,
    exampleSentence,
    stageId: x?.stageId ?? null,
    continent: x?.continent ?? null,
    originalGrade: x?.originalGrade ?? null,
    tags: Array.isArray(x?.tags) ? x.tags : [],
    strokesRef,
  };
}

function main() {
  if (!fs.existsSync(IN_DIR)) {
    throw new Error(`Input dir not found: ${IN_DIR}`);
  }

  const files = fs
    .readdirSync(IN_DIR)
    .filter((f) => /^kanji_g\d+_proto\.json$/i.test(f))
    .map((f) => path.join(IN_DIR, f));

  if (!files.length) {
    throw new Error(`No kanji_g*_proto.json found in ${IN_DIR}`);
  }

  const map = new Map(); // id -> entry

  // 1) ヨミタビデータを統合
  for (const p of files) {
    const arr = readJson(p);
    if (!Array.isArray(arr)) throw new Error(`Not array: ${p}`);
    for (const raw of arr) {
      const e = normalizeEntry(raw);
      if (!e.id || !e.kanji || !e.grade) continue;
      map.set(e.id, e);
    }
  }

  // 2) 追加で trace データがあれば strokesRef を注入
  for (const p of EXTRA_TRACE_SOURCES) {
    if (!fs.existsSync(p)) continue;
    const arr = readJson(p);
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      if (!raw?.id) continue;
      const cur = map.get(raw.id);
      if (cur && raw.strokesRef) cur.strokesRef = raw.strokesRef;
      if (!cur) {
        const e = normalizeEntry(raw);
        if (e.id && e.kanji && e.grade) map.set(e.id, e);
      }
    }
  }

  const all = [...map.values()].sort(
    (a, b) => (a.grade - b.grade) || a.id.localeCompare(b.id, "ja")
  );

  // 3) index生成
  const indexGrade = {};
  for (const e of all) {
    const g = String(e.grade);
    (indexGrade[g] ||= []).push(e.id);
  }

  const traceable = all.filter((e) => !!e.strokesRef).map((e) => e.id);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_ALL, JSON.stringify(all, null, 2), "utf-8");
  fs.writeFileSync(OUT_GRADE, JSON.stringify(indexGrade, null, 2), "utf-8");
  fs.writeFileSync(OUT_TRACEABLE, JSON.stringify(traceable, null, 2), "utf-8");

  console.log("✅ Generated");
  console.log(" -", OUT_ALL, `(${all.length})`);
  console.log(" -", OUT_GRADE);
  console.log(" -", OUT_TRACEABLE, `(${traceable.length})`);
}

main();
