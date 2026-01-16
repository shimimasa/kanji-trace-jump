/**
+ * Kana SVG fetcher (Windows OK)
+ * - downloads strokesvg repo ZIP from GitHub
+ * - extracts it into .tmp/strokesvg
+ * - copies svg files into:
+ *     public/raw_svg/hiragana
+ *     public/raw_svg/katakana
+ *
+ * Usage:
+ *   node scripts/fetchKanaSvgs.mjs
+ */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import https from "node:https";

const ROOT = path.resolve(process.cwd());
const TMP_DIR = path.join(ROOT, ".tmp");
const ZIP_PATH = path.join(TMP_DIR, "strokesvg.zip");
const EXTRACT_DIR = path.join(TMP_DIR, "strokesvg");

const OUT_HIRA = path.join(ROOT, "public", "raw_svg", "hiragana");
const OUT_KATA = path.join(ROOT, "public", "raw_svg", "katakana");

// strokesvg ZIP
// - repo側の既定ブランチが main/master で揺れるので複数候補を自動で試す
const ZIP_URLS = [
      // ✅ 正：zhengkyl/strokesvg（Japanese kana SVGs）
      // codeload (fast)
      "https://codeload.github.com/zhengkyl/strokesvg/zip/refs/heads/main",
      "https://codeload.github.com/zhengkyl/strokesvg/zip/refs/heads/master",
      // archive (fallback)
      "https://github.com/zhengkyl/strokesvg/archive/refs/heads/main.zip",
      "https://github.com/zhengkyl/strokesvg/archive/refs/heads/master.zip",
    ];
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      // follow redirect
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
                reject(Object.assign(new Error(`HTTP ${res.statusCode} for ${url}`), { statusCode: res.statusCode }));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function listAllFiles(dir, predicate) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const ents = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (!predicate || predicate(full)) out.push(full);
    }
  }
  return out;
}

function copyIfNewer(src, destDir) {
  ensureDir(destDir);
  const base = path.basename(src);
  const dest = path.join(destDir, base);
  fs.copyFileSync(src, dest);
}

function findDistDir(repoRoot) {
      const dist = path.join(repoRoot, "dist");
      return fs.existsSync(dist) ? dist : null;
    }

async function downloadWithFallback(urls, dest) {
      let lastErr = null;
      for (const url of urls) {
        try {
          await download(url, dest);
          return url;
        } catch (e) {
          lastErr = e;
          // 404/410 は「URLが存在しない」なので次候補へ
          // それ以外でも候補を順に試す
          continue;
        }
      }
      throw lastErr ?? new Error("download failed");
    }

async function main() {
  ensureDir(TMP_DIR);
  ensureDir(OUT_HIRA);
  ensureDir(OUT_KATA);

  console.log("Downloading strokesvg ZIP...");
  const usedUrl = await downloadWithFallback(ZIP_URLS, ZIP_PATH);
  console.log("Downloaded from:", usedUrl);

  // unzip (Windows: tar is available in modern git-bash / Windows 11, but not always)
  // We use 'tar' because Node has no built-in zip extraction.
  // If this fails on your machine, tell me and I'll switch to a pure-js unzip dependency approach.
  rimraf(EXTRACT_DIR);
  ensureDir(EXTRACT_DIR);
  console.log("Extracting ZIP...");
  execSync(`tar -xf "${ZIP_PATH}" -C "${EXTRACT_DIR}"`, { stdio: "inherit" });

  // strokesvg-master/...
  const rootEntries = fs.readdirSync(EXTRACT_DIR);
  const repoRoot = path.join(EXTRACT_DIR, rootEntries[0] ?? "");
  if (!fs.existsSync(repoRoot)) throw new Error("Extract failed: repo root not found");

  // ✅ strokesvg は /dist/hiragana と /dist/katakana に最適化済みSVGが入る（READMEに記載あり）
  const distDir = findDistDir(repoRoot);
  if (!distDir) throw new Error("dist folder not found in strokesvg repo");

  const hiraDir = path.join(distDir, "hiragana");
  const kataDir = path.join(distDir, "katakana");
  if (!fs.existsSync(hiraDir)) throw new Error("dist/hiragana not found");
  if (!fs.existsSync(kataDir)) throw new Error("dist/katakana not found");

  console.log("Copying SVG files from dist/...");
  const hiraSvgs = listAllFiles(hiraDir, (p) => p.toLowerCase().endsWith(".svg"));
  const kataSvgs = listAllFiles(kataDir, (p) => p.toLowerCase().endsWith(".svg"));

  if (!hiraSvgs.length && !kataSvgs.length) {
    throw new Error("No SVG files found under dist/hiragana or dist/katakana");
  }

  let hiraCount = 0;
  let kataCount = 0;
  for (const svg of hiraSvgs) { copyIfNewer(svg, OUT_HIRA); hiraCount++; }
  for (const svg of kataSvgs) { copyIfNewer(svg, OUT_KATA); kataCount++; }

  console.log("✅ Done.");
  console.log(`  hiragana copied: ${hiraCount}`);
  console.log(`  katakana copied: ${kataCount}`);
  console.log("Output:");
  console.log(" ", OUT_HIRA);
  console.log(" ", OUT_KATA);
  console.log("\nNext: convert SVG -> strokes JSON (we'll automate this next).");
}

main().catch((e) => {
  console.error("❌ fetchKanaSvgs failed:", e?.message ?? e);
  process.exit(1);
});
