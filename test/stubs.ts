// Minimal DOM/canvas/audio stubs so the UI layer runs headless under vitest.

export function stubCanvasCtx(): CanvasRenderingContext2D {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, p) => {
      if (typeof p !== 'string') return undefined;
      return (t[p] ??= () => {});
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

export interface StubEl {
  textContent: string;
  innerHTML: string;
  className: string;
  style: Record<string, unknown>;
  width: number;
  height: number;
  classList: {
    add(c: string): void;
    remove(c: string): void;
    toggle(c: string, v?: boolean): void;
    contains(c: string): boolean;
  };
  getContext(): CanvasRenderingContext2D;
}

export function makeEl(): StubEl {
  const set = new Set<string>();
  return {
    textContent: '', innerHTML: '', className: '', style: {}, width: 0, height: 0,
    classList: {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c, v) => (v ? set.add(c) : set.delete(c)),
      contains: (c) => set.has(c),
    },
    getContext: stubCanvasCtx,
  };
}

export interface StubDom {
  els: Record<string, StubEl>;
  listeners: Record<string, (ev: KeyboardEvent) => void>;
  store: Record<string, string>;
  raf: { cb: FrameRequestCallback | null };
  key(k: string): void;
  frames(n: number): void;
}

/** Install window/document/localStorage/AudioContext/rAF globals. */
export function installDom(): StubDom {
  const els: Record<string, StubEl> = {};
  const listeners: Record<string, (ev: KeyboardEvent) => void> = {};
  const store: Record<string, string> = {};
  const raf: { cb: FrameRequestCallback | null } = { cb: null };

  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.document = {
    getElementById: (id: string) => (els[id] ??= makeEl()),
    createElement: () => makeEl(),
  };
  g.addEventListener = (ev: string, fn: (ev: KeyboardEvent) => void) => { listeners[ev] = fn; };
  g.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
  g.AudioContext = function () {
    const node = new Proxy(
      {
        getChannelData: () => new Float32Array(16),
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return node; },
        start() {}, stop() {},
      } as Record<string, unknown>,
      { get: (t, p) => (typeof p === 'string' && p in t ? t[p] : () => node) },
    );
    return new Proxy(
      { state: 'running', currentTime: 0, sampleRate: 44100, destination: {} } as Record<string, unknown>,
      { get: (t, p) => (typeof p === 'string' && p in t ? t[p] : () => node) },
    );
  };
  g.requestAnimationFrame = (fn: FrameRequestCallback) => { raf.cb = fn; return 1; };
  g.devicePixelRatio = 1;
  g.innerWidth = 1440;
  g.innerHeight = 900;

  return {
    els, listeners, store, raf,
    key(k: string) {
      listeners.keydown?.({ key: k, preventDefault() {}, metaKey: false, ctrlKey: false } as unknown as KeyboardEvent);
    },
    frames(n: number) {
      for (let i = 0; i < n; i++) raf.cb?.(performance.now() + i * 16);
    },
  };
}
