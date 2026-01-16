// scripts/build-strokes-all.mjs
import { spawn } from "node:child_process";

const SVG_DIR = "public/svg/kvg/g1"; // ここに全SVGがある前提
const PROTO_DIR = "public/data/ヨミタビの漢字データ";
const OUT_DIR = "public/data/strokes";

// strictCount を使うなら true（最初は true 推奨）
const STRICT_COUNT = true;

// g1〜g10
const GRADES = [1,2,3,4,5,6,7,8,9,10];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true });
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function main() {
  for (const g of GRADES) {
    const proto = `${PROTO_DIR}/kanji_g${g}_proto.json`;
    const out = `${OUT_DIR}/g${g}`;
    const args = [
      "scripts/svg-to-strokes.mjs",
      "--grade", String(g),
      "--svgDir", SVG_DIR,
      "--proto", proto,
      "--out", out,
    ];
    if (STRICT_COUNT) args.push("--strictCount");

    console.log(`\n=== Build strokes: g${g} ===`);
    await run("node", args);
  }

  console.log("\n=== Update strokesRef + traceable index ===");
  await run("node", ["scripts/update-strokesref-and-traceable.mjs"]);

  console.log("\n✅ Done: strokes generated + strokesRef injected + traceable updated");
}

main().catch((e) => {
  console.error("\n❌ Build failed:", e.message);
  process.exit(1);
});
