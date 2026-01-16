// tools/enrich-all-json.mjs
import fs from "node:fs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function writeJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const ALPHA_NAME_JP = {
  A: "エー", B: "ビー", C: "シー", D: "ディー", E: "イー", F: "エフ",
  G: "ジー", H: "エイチ", I: "アイ", J: "ジェー", K: "ケー", L: "エル",
  M: "エム", N: "エヌ", O: "オー", P: "ピー", Q: "キュー", R: "アール",
  S: "エス", T: "ティー", U: "ユー", V: "ヴィー", W: "ダブリュー",
  X: "エックス", Y: "ワイ", Z: "ズィー",
};

const ALPHA_EXAMPLE_WORD = {
  A: "apple", B: "ball", C: "cat", D: "dog", E: "egg", F: "fish",
  G: "goat", H: "hat", I: "ice", J: "juice", K: "key", L: "lion",
  M: "moon", N: "nose", O: "orange", P: "pen", Q: "queen", R: "rain",
  S: "sun", T: "tree", U: "umbrella", V: "van", W: "water", X: "xylophone",
  Y: "yoyo", Z: "zebra",
};

// ひらがな -> ローマ字（最小セット）
// ※小書きは単体だと「ゃ→ya」等にしています（拗音合成は別フェーズでOK）
const HIRA_ROMAJI = {
  // あ行
  "あ":"a","い":"i","う":"u","え":"e","お":"o",
  "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o",
  // か行
  "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
  "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
  // さ行
  "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
  "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
  // た行
  "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
  "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do",
  // な行
  "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
  // は行
  "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
  "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
  "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
  // ま行
  "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
  // や行
  "や":"ya","ゆ":"yu","よ":"yo",
  "ゃ":"ya","ゅ":"yu","ょ":"yo",
  // ら行
  "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
  // わ行 + ん
  "わ":"wa","を":"o","ん":"n",
  // 小さいつ
  "っ":"tsu",
};

// カタカナ → ひらがなへ変換（基本ブロックは +0x60 で対応できる範囲が多い）
// 例：ア(0x30A2) -> あ(0x3042)
function kataToHira(ch) {
  const code = ch.codePointAt(0);
  // カタカナの範囲（雑に）：U+30A1..U+30F6
  if (code >= 0x30A1 && code <= 0x30F6) {
    return String.fromCodePoint(code - 0x60);
  }
  return ch;
}

// カタカナの長音「ー」などは別処理
function kataRomaji(ch) {
  if (ch === "ー") return "-";
  if (ch === "ヴ") return "vu";
  const hira = kataToHira(ch);
  return HIRA_ROMAJI[hira] ?? null;
}

function enrichHiraganaAll(inputPath, outputPath = inputPath) {
  const arr = readJson(inputPath);
  const out = arr.map((it) => {
    const ch = it.char ?? it.text ?? it.kanji ?? it.letter;
    if (!ch) return it;
    const romaji = HIRA_ROMAJI[ch] ?? null;
    // 既に romaji があるなら上書きしない
    return romaji && !it.romaji ? { ...it, romaji } : it;
  });
  writeJson(outputPath, out);
  console.log(`[ok] hiragana enriched: ${outputPath}`);
}

function enrichKatakanaAll(inputPath, outputPath = inputPath) {
  const arr = readJson(inputPath);
  const out = arr.map((it) => {
    const ch = it.char ?? it.text ?? it.kanji ?? it.letter;
    if (!ch) return it;
    const romaji = kataRomaji(ch);
    return romaji && !it.romaji ? { ...it, romaji } : it;
  });
  writeJson(outputPath, out);
  console.log(`[ok] katakana enriched: ${outputPath}`);
}

function enrichAlphabetAll(inputPath, outputPath = inputPath) {
  const arr = readJson(inputPath);
  const out = arr.map((it) => {
    const letter = it.letter ?? it.char ?? it.text;
    if (!letter || typeof letter !== "string") return it;
    const upper = letter.toUpperCase();
    const nameJp = ALPHA_NAME_JP[upper] ?? null;
    const exampleWord = ALPHA_EXAMPLE_WORD[upper] ?? null;

    const next = { ...it };
    if (nameJp && !next.nameJp) next.nameJp = nameJp;
    if (exampleWord && !next.exampleWord) next.exampleWord = exampleWord;
    return next;
  });
  writeJson(outputPath, out);
  console.log(`[ok] alphabet enriched: ${outputPath}`);
}

// ---- CLI ----
// node tools/enrich-all-json.mjs hiragana data/hiragana/hiragana_all.json
// node tools/enrich-all-json.mjs katakana data/katakana/katakana_all.json
// node tools/enrich-all-json.mjs alphabet data/alphabet/alphabet_upper_all.json
// node tools/enrich-all-json.mjs alphabet data/alphabet/alphabet_lower_all.json

const [kind, path] = process.argv.slice(2);
if (!kind || !path) {
  console.log("Usage: node tools/enrich-all-json.mjs <hiragana|katakana|alphabet> <path-to-all.json>");
  process.exit(1);
}

if (kind === "hiragana") enrichHiraganaAll(path);
else if (kind === "katakana") enrichKatakanaAll(path);
else if (kind === "alphabet") enrichAlphabetAll(path);
else {
  console.log("Unknown kind:", kind);
  process.exit(1);
}
