#!/usr/bin/env bash
set -euo pipefail

# かなSVG（strokesvg）を取得して raw_svg にコピーする
# 使い方:
#   bash scripts/fetch_kana_svgs.sh
#
# 生成物:
#   public/data/raw_svg/hiragana/*.svg
#   public/data/raw_svg/katakana/*.svg

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="$ROOT_DIR/.tmp_strokesvg"
OUT_HIRA="$ROOT_DIR/public/data/raw_svg/hiragana"
OUT_KATA="$ROOT_DIR/public/data/raw_svg/katakana"

mkdir -p "$OUT_HIRA" "$OUT_KATA"

if [ ! -d "$WORK_DIR" ]; then
  git clone --depth 1 https://github.com/kaienfr/strokesvg.git "$WORK_DIR"
else
  (cd "$WORK_DIR" && git pull --ff-only)
fi

# strokesvg の dist 構成は更新されることがあるので、
# まずは dist 配下から “ひらがな/カタカナっぽい”SVGをコピーする。
# 必要に応じて here を調整してください。
find "$WORK_DIR" -type f -name "*.svg" | while read -r f; do
  base="$(basename "$f")"
  # 雑に振り分け（例: hira-*.svg / kata-*.svg などに合わせて調整可）
  if echo "$base" | grep -qiE "hira|hiragana"; then
    cp -f "$f" "$OUT_HIRA/$base"
  elif echo "$base" | grep -qiE "kata|katakana"; then
    cp -f "$f" "$OUT_KATA/$base"
  fi
done

echo "✅ done: copied SVGs to"
echo "  - $OUT_HIRA"
echo "  - $OUT_KATA"
