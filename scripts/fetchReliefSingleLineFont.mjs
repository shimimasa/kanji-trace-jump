/**
+ * Fetch Relief SingleLine repo as ZIP and extract the SVG font into:
+ *   assets/fonts/ReliefSingleLineSVG-Regular.svg
+ *
+ * Run:
+ *   node scripts/fetchReliefSingleLineFont.mjs
+ */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { execSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());
const TMP = path.join(ROOT, ".tmp");
const ZIP = path.join(TMP, "relief-singleline.zip");
const EXTRACT = path.join(TMP, "relief-singleline");
const OUT_DIR = path.join(ROOT, "assets", "fonts");
const OUT_FILE = path.join(OUT_DIR, "ReliefSingleLineSVG-Regular.svg");

// repo zip (main/master 揺れ対策)
const URLS = [
  "https://codeload.github.com/isdat-type/Relief-SingleLine/zip/refs/heads/main",
  "https://codeload.github.com/isdat-type/Relief-SingleLine/zip/refs/heads/master",
  "https://github.com/isdat-type/Relief-SingleLine/archive/refs/heads/main.zip",
  "https://github.com/isdat-type/Relief-SingleLine/archive/refs/heads/master.zip",
];

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }
function rimraf(p){ if (fs.existsSync(p)) fs.rmSync(p,{recursive:true,force:true}); }

function download(url, dest){
  return new Promise((resolve,reject)=>{
    const f = fs.createWriteStream(dest);
    https.get(url,(res)=>{
      if (res.statusCode && res.statusCode>=300 && res.statusCode<400 && res.headers.location){
        f.close(); try{fs.unlinkSync(dest);}catch{}
        return download(res.headers.location,dest).then(resolve).catch(reject);
      }
      if (res.statusCode!==200) return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      res.pipe(f);
      f.on("finish",()=>f.close(resolve));
    }).on("error",(e)=>{ try{fs.unlinkSync(dest);}catch{} reject(e);});
  });
}

async function downloadWithFallback(urls,dest){
  let last=null;
  for (const u of urls){
    try{ await download(u,dest); return u; }catch(e){ last=e; }
  }
  throw last ?? new Error("download failed");
}

function findFile(root, filename){
  const stack=[root];
  while(stack.length){
    const cur=stack.pop();
    const ents=fs.readdirSync(cur,{withFileTypes:true});
    for(const e of ents){
      const p=path.join(cur,e.name);
      if(e.isDirectory()) stack.push(p);
      else if(e.isFile() && e.name===filename) return p;
    }
  }
  return null;
}

async function main(){
  ensureDir(TMP);
  ensureDir(OUT_DIR);
  console.log("Downloading Relief-SingleLine ZIP...");
  const used = await downloadWithFallback(URLS, ZIP);
  console.log("Downloaded from:", used);

  rimraf(EXTRACT);
  ensureDir(EXTRACT);
  console.log("Extracting ZIP...");
  execSync(`tar -xf "${ZIP}" -C "${EXTRACT}"`, { stdio: "inherit" });

  const top = fs.readdirSync(EXTRACT)[0];
  const repoRoot = path.join(EXTRACT, top ?? "");
  if (!fs.existsSync(repoRoot)) throw new Error("extract failed");

  // ここは repo 内のどこにあっても拾えるようにする
  const found = findFile(repoRoot, "ReliefSingleLineSVG-Regular.svg");
  if (!found) {
    throw new Error("ReliefSingleLineSVG-Regular.svg not found in repo zip");
  }
  fs.copyFileSync(found, OUT_FILE);
  console.log("✅ wrote:", OUT_FILE);
}

main().catch((e)=>{
  console.error("❌ fetchReliefSingleLineFont failed:", e?.message ?? e);
  process.exit(1);
});