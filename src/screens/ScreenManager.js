// src/screens/ScreenManager.js
export class ScreenManager {
    constructor(rootEl, initialCtx = {}) {
      this.rootEl = rootEl;
      this.ctx = initialCtx;        // 共有状態（選択範囲、進捗、設定など）
      this.screens = new Map();     // name -> factory(ctx) => screen
      this.current = null;          // { name, instance, cleanup }
    }
  
    register(name, factory) {
      this.screens.set(name, factory);
    }
  
    async go(name, params = {}) {
      // 1) 現在画面の後片付け
      if (this.current?.cleanup) {
        try { await this.current.cleanup(); } catch {}
      }
      this.rootEl.innerHTML = "";
  
      // 2) 次画面生成
      const factory = this.screens.get(name);
      if (!factory) throw new Error(`Unknown screen: ${name}`);
  
      // ctxに params を反映（画面遷移の引数）
      this.ctx = { ...this.ctx, ...params, screen: name };
  
      const instance = factory(this.ctx, this);
      const { el, cleanup } = await instance.mount();
  
      this.rootEl.appendChild(el);
      this.current = { name, instance, cleanup: cleanup ?? null };
    }
  }
  