# scripts/extract_kanjivg_svgs.py
import json
import os
import shutil
import sys

def char_to_hex_filename(ch: str) -> str:
    cp = ord(ch)
    return f"{cp:04x}.svg"  # kanjivgは小文字hexが多い

def main():
    # 使い方:
    # python scripts/extract_kanjivg_svgs.py path/to/kanji_g1_proto.json path/to/kanjivg/kanji out/svg/g1
    if len(sys.argv) != 4:
        print("Usage: python extract_kanjivg_svgs.py <kanji_proto.json> <kanjivg_kanji_dir> <out_dir>")
        sys.exit(1)

    proto_json = sys.argv[1]
    kanjivg_kanji_dir = sys.argv[2]
    out_dir = sys.argv[3]

    os.makedirs(out_dir, exist_ok=True)

    with open(proto_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    # dataは配列想定
    kanji_list = []
    for it in data:
        k = it.get("kanji")
        if isinstance(k, str) and len(k) == 1:
            kanji_list.append(k)

    copied = 0
    missing = []

    for k in kanji_list:
        fn = char_to_hex_filename(k)
        src = os.path.join(kanjivg_kanji_dir, fn)
        if not os.path.exists(src):
            # 大文字HEX名の可能性も一応見る
            src2 = os.path.join(kanjivg_kanji_dir, fn.upper())
            if os.path.exists(src2):
                src = src2
            else:
                missing.append((k, fn))
                continue

        dst = os.path.join(out_dir, fn)
        shutil.copy2(src, dst)
        copied += 1

    print(f"Copied: {copied} SVGs -> {out_dir}")
    if missing:
        print("Missing (kanji, expected_filename):")
        for k, fn in missing:
            print(f"  {k}  {fn}")
        print(f"Missing count: {len(missing)}")

if __name__ == "__main__":
    main()
