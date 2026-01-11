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
      const mounted = await instance.mount();
      this.rootEl.appendChild(mounted.el);
  
      this.current = { cleanup: mounted.cleanup ?? null };
    }
  }
  