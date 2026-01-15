export class ScreenManager {
    constructor(rootEl, initialCtx = {}) {
      this.rootEl = rootEl;
      this.ctx = initialCtx;
      this.screens = new Map();
      this.current = null;
    }
  
    register(name, factory) {
      this.screens.set(name, factory);
    }
  
    async go(name, params = {}) {
      if (this.current?.cleanup) {
        try { await this.current.cleanup(); } catch {}
      }
      this.rootEl.innerHTML = "";

      // ✅ 全画面で共通の背景（空＋草原）を適用
      // ここで統一すると、各Screen側で add/remove しなくて済む
      try {
        // body だけだと、画面によっては #app（スクロールコンテナ等）が前面に来て
      // body 背景が見えないことがある → html にも付与して確実に効かせる
      document.documentElement.classList.add("bg-app");
      document.body.classList.add("bg-app");

      // 旧実装の名残があっても邪魔しないように除去
      document.documentElement.classList.remove("bg-home");
      document.body.classList.remove("bg-home");
      } catch {}
  
      const factory = this.screens.get(name);
      if (!factory) throw new Error(`Unknown screen: ${name}`);
  
      this.ctx = { ...this.ctx, ...params, screen: name };
  
      const instance = factory(this.ctx, this);
    let mounted;
    try {
        // ✅ どの画面に入ろうとしたかを必ず記録
      window.__KTJ_LAST_SCREEN__ = name;
      window.__KTJ_LAST_PARAMS__ = params;
      mounted = await instance.mount();
    } catch (err) {
      // ✅ オブジェクトを展開しなくても screen名が見えるログ
      console.error(`[ScreenManager] mount failed in screen="${name}"`);
      console.error("[ScreenManager] params=", params);
      console.error("[ScreenManager] ctx=", this.ctx);
      console.error("[ScreenManager] error=", err);
      // rootElは空のはずだが、念のため
      console.error("[ScreenManager] rootEl current HTML:", this.rootEl.innerHTML);
      // ✅ 例外メッセージにも screen名を埋める（minifyでも見える）
      const wrapped = new Error(`Screen "${name}" mount failed: ${String(err?.message ?? err)}`);
      wrapped.cause = err;
      throw wrapped;
    }

    const { el, cleanup } = mounted;
    if (!el) {
        console.error(`[ScreenManager] mount returned no el. screen="${name}"`, mounted);
      throw new Error(`[ScreenManager] mount() must return { el }. screen=${name}`);
    }
      this.rootEl.appendChild(mounted.el);
  
      this.current = { cleanup: mounted.cleanup ?? null };
    }
  }
  