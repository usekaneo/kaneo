import type {
  EventName,
  EventMap,
  EventHandler,
  Unsubscribe,
} from "../types.js";

export interface Emitter {
  on<T extends EventName>(name: T, handler: EventHandler<T>): Unsubscribe;
  off<T extends EventName>(name: T, handler?: EventHandler<T>): void;
  emit<T extends EventName>(name: T, payload: EventMap[T]): void;
}

export function createEmitter(): Emitter {
  // Internal storage uses `any` arrays; the public API preserves full type-safety.
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners: { [K in EventName]?: any[] } = {};

  return {
    on(name, handler) {
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = (listeners[name] ??= []);
      list.push(handler);
      return () => {
        const current = listeners[name];
        if (!current) return;
        listeners[name] = current.filter((h) => h !== handler);
      };
    },

    off(name, handler) {
      if (!handler) {
        delete listeners[name];
        return;
      }
      const current = listeners[name];
      if (!current) return;
      listeners[name] = current.filter((h) => h !== handler);
    },

    emit(name, payload) {
      const list = listeners[name];
      if (!list) return;
      for (const h of list) {
        try {
          h(payload);
        } catch {
          // swallow — one bad handler shouldn't break the rest
        }
      }
    },
  };
}
