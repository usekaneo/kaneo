export { useQuackbackInit } from "./use-init.js";
export type { UseQuackbackInitOptions } from "./use-init.js";
export { useQuackback } from "./use-quackback.js";
export { useQuackbackEvent } from "./use-event.js";

// Re-export the singleton + types so users can import everything from one subpath.
export { default as Quackback } from "../index.js";
export type {
  InitOptions,
  Identity,
  OpenOptions,
  WidgetUser,
  EventName,
  EventMap,
  EventHandler,
  Unsubscribe,
} from "../types.js";
