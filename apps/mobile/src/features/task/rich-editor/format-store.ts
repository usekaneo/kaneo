import { useSyncExternalStore } from "react";

import { emptyFormatState, type EditorFormatState } from "./editor-commands";

export type FormatStore = {
  get: () => EditorFormatState;
  set: (state: EditorFormatState) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createFormatStore(): FormatStore {
  let state = emptyFormatState;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useFormatState(store: FormatStore): EditorFormatState {
  return useSyncExternalStore(store.subscribe, store.get);
}
