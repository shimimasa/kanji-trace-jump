// src/screens/ReviewStartScreen.js
import { CONTENT_MANIFEST } from "../data/contentManifest.js";
import { isCleared, getWeakScore } from "../lib/progressStore.js";
import { makeProgressKey } from "../lib/progressKey.js";
import { loadRangeItems } from "../lib/rangeItems.js";


function makeItemKey(type, itemId) {
    return makeProgressKey(type, itemId);
  }

export function ReviewStartScreen(ctx, nav) {
  return {
    async mount() {
      const el = document.createElement("div");
      el.className = "screen review";

      const selected = ctx.selectedRangeId ?? "kanji_g1";
       // ✅ rangeの母数をゲームと一致させる（行セット/学年/traceable）
      const { range, type, items } = await loadRangeItems(selected);


      const getLabel = (it) => (
                it?.label ??
                it?.kanji ??
                it?.kana ??
                it?.char ??
                it?.text ??
                it?.id ??
                "？"
              );

      // 設定（デフォルト）
      let count = 10; // 5/10/15
      let policy = "balanced"; // "uncleared" | "mist" | "balanced"
      let onlyUncleared = false;

      const computeStats = () => {
        const total = items.length;
        let clearedCount = 0;
        for (const it of items) {
          if (isCleared(ctx.progress, makeItemKey(type, it.id))) clearedCount++;
        }
        return { total, clearedCount, pct: total ? Math.round((clearedCount / total) * 100) : 0 };
      };

      const buildQueue = () => {
        const arr = items.slice();

        // 候補フィルタ
        let candidates = arr;
        if (onlyUncleared) {
          candidates = candidates.filter((it) => !isCleared(ctx.progress, makeItemKey(type, it.id)));
        }

        // スコア関数
        const weakScore = (it) => getWeakScore(ctx.progress, makeItemKey(type, it.id));
        const lastAttemptAt = (it) => ctx.progress?.items?.[makeItemKey(type, it.id)]?.lastAttemptAt ?? 0;

        // 優先ポリシー
        let ordered = candidates;

        if (policy === "uncleared") {
          // 未クリア優先 → その中でミス多い順 → さらに最近やってない順
          ordered = candidates
            .slice()
            .sort((a, b) => {
              const ac = isCleared(ctx.progress, makeItemKey(type, a.id)) ? 1 : 0;
              const bc = isCleared(ctx.progress, makeItemKey(type, b.id)) ? 1 : 0;
              if (ac !== bc) return ac - bc;
              const ws = weakScore(b) - weakScore(a);
              if (ws !== 0) return ws;
              return lastAttemptAt(a) - lastAttemptAt(b);
            });
        } else if (policy === "mist") {
          // ミス多い順 → 最近やってない順
          ordered = candidates
            .slice()
            .sort((a, b) => {
              const ws = weakScore(b) - weakScore(a);
              if (ws !== 0) return ws;
              return lastAttemptAt(a) - lastAttemptAt(b);
            });
        } else {
          // balanced: 未クリアを少し優遇しつつ、ミス/放置も混ぜる
          ordered = candidates
            .slice()
            .sort((a, b) => {
              const ac = isCleared(ctx.progress, makeItemKey(type, a.id)) ? 1 : 0;
              const bc = isCleared(ctx.progress, makeItemKey(type, b.id)) ? 1 : 0;
              if (ac !== bc) return ac - bc; // 未クリア先
              // ミス多い順を少し
              const ws = weakScore(b) - weakScore(a);
              if (ws !== 0) return ws;
              // 最近やってない順
              return lastAttemptAt(a) - lastAttemptAt(b);
            });
        }

        // 出題数に切り詰め（候補が少ないならそのまま）
        const picked = ordered.slice(0, Math.min(count, ordered.length));
        return picked.map((it) => it.id);
      };

      const s = computeStats();

      const render = () => {
        el.innerHTML = `
          <div class="reviewBoard">
            <div class="reviewHead">
              <div>
                <div class="reviewTitle">復習設定</div>
                <div class="reviewMeta">範囲：<b>${range?.label ?? "未選択"}</b> / 達成率 <b>${s.pct}%</b>（${s.clearedCount}/${s.total}）</div>
              </div>
              <div class="reviewHeadActions">
              <button id="range" class="btn" type="button">もじをえらぶ</button>
                <button id="back" class="btn" type="button">もどる</button>
              </div>
            </div>

            <div class="reviewCard">
              <div class="reviewSection">
                <div class="reviewLabel">出題数</div>
                <div class="reviewChips">
                  <button class="chipBtn ${count===5?"active":""}" data-count="5">5</button>
                  <button class="chipBtn ${count===10?"active":""}" data-count="10">10</button>
                  <button class="chipBtn ${count===15?"active":""}" data-count="15">15</button>
                </div>
              </div>

              <div class="reviewSection">
                <div class="reviewLabel">優先</div>
                <div class="reviewChips">
                  <button class="chipBtn ${policy==="balanced"?"active":""}" data-policy="balanced">バランス</button>
                  <button class="chipBtn ${policy==="uncleared"?"active":""}" data-policy="uncleared">未クリア優先</button>
                  <button class="chipBtn ${policy==="mist"?"active":""}" data-policy="mist">ミス多い優先</button>
                </div>
              </div>

              <div class="reviewSection">
                <label class="reviewToggle">
                  <input id="onlyUncleared" type="checkbox" ${onlyUncleared ? "checked" : ""} />
                  <span>未クリアだけにする</span>
                </label>
              </div>

              <div class="reviewActions">
                <button id="start" class="btn primary big" type="button">復習をはじめる</button>
              </div>

              <div class="reviewNote">
                <div class="muted">※ 復習は「1文字ずつ練習（single）」で連続出題します。</div>
              </div>
            </div>
          </div>
        `;
      };

      render();

      const onClick = (e) => {
        const t = e.target;

        if (t.closest("#range")) {
                    nav.go("rangeSelect", { selectedRangeId: selected, returnTo: "reviewStart" });
                    return;
                  }

        if (t.closest("#back")) {
          // どこから来たかで戻す
          if (ctx.from === "dex") nav.go("dex", { selectedRangeId: selected, from: "progress" });
          else nav.go("progress");
          return;
        }

        const cBtn = t.closest("button[data-count]");
        if (cBtn) {
          count = Number(cBtn.dataset.count);
          render();
          return;
        }

        const pBtn = t.closest("button[data-policy]");
        if (pBtn) {
          policy = pBtn.dataset.policy;
          render();
          return;
        }

        if (t.closest("#onlyUncleared")) {
          onlyUncleared = !!el.querySelector("#onlyUncleared")?.checked;
          // renderは軽いので再描画
          render();
          return;
        }

        if (t.closest("#start")) {
          const queue = buildQueue();
          if (!queue.length) {
            alert("出題できる文字がありません。条件を変えてください。");
            return;
          }

          // ✅ 今回の出題分だけ id→label を作る（Resultで文字表示するため）
          const labelMap = {};
          for (const it of items) {
            if (queue.includes(it.id)) labelMap[it.id] = getLabel(it);
          }

          // 復習セッションをctxに載せてゲームへ
          nav.go("game", {
            selectedRangeId: selected,
            review: {
              active: true,
              queue,
              index: 0,
              // 結果集計
              startedAt: Date.now(),
              mistakes: {}, // itemId -> fail count
              cleared: [],  // itemId[]
              labels: labelMap,
              rangeId: range.id,
              policy,
              onlyUncleared,
            },
            // まず1問目へ
            singleId: queue[0],
            returnTo: "review",
            returnFrom: "progress",
          });
        }
      };

      el.addEventListener("click", onClick);

      return {
        el,
        cleanup() {
          el.removeEventListener("click", onClick);
        },
      };
    },
  };
}
