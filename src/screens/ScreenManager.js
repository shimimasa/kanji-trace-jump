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
  
      const factory = this.screens.get(name);
      if (!factory) throw new Error(`Unknown screen: ${name}`);
  
      this.ctx = { ...this.ctx, ...params, screen: name };
  
      const instance = factory(this.ctx, this);
    let mounted;
    try {
      mounted = await instance.mount();
    } catch (err) {
      // ✅ ここで「どの画面の mount が落ちたか」を100%出す
      console.error("[ScreenManager] mount failed:", {
        screen: name,
        params,
        ctx: this.ctx,
        error: err,
      });
      // rootElは空のはずだが、念のため
      console.error("[ScreenManager] rootEl current HTML:", this.rootEl.innerHTML);
      throw err;
    }

    const { el, cleanup } = mounted;
    if (!el) {
      console.error("[ScreenManager] mount returned no el:", { screen: name, mounted });
      throw new Error(`[ScreenManager] mount() must return { el }. screen=${name}`);
    }
      this.rootEl.appendChild(mounted.el);
  
      this.current = { cleanup: mounted.cleanup ?? null };
    }
  }
  