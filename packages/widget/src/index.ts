import { createSDK } from "./core/sdk.js";
import type {
  InitOptions,
  Identity,
  OpenOptions,
  WidgetUser,
  EventName,
  EventMap,
  EventHandler,
  Unsubscribe,
} from "./types.js";

import { SDK_VERSION } from "./version.js";

export { SDK_VERSION };
export type {
  InitOptions,
  Identity,
  OpenOptions,
  WidgetUser,
  EventName,
  EventMap,
  EventHandler,
  Unsubscribe,
};

const sdk = createSDK();

export const Quackback = {
  version: SDK_VERSION,
  init(options: InitOptions): void {
    sdk.dispatch("init", options);
  },
  identify(identity?: Identity): void {
    sdk.dispatch("identify", identity);
  },
  logout(): void {
    sdk.dispatch("logout");
  },
  open(options?: OpenOptions): void {
    sdk.dispatch("open", options);
  },
  close(): void {
    sdk.dispatch("close");
  },
  showLauncher(): void {
    sdk.dispatch("showLauncher");
  },
  hideLauncher(): void {
    sdk.dispatch("hideLauncher");
  },
  // State queries — synchronous reads of internal state.
  isOpen(): boolean {
    return sdk.isOpen();
  },
  getUser(): WidgetUser | null {
    return sdk.getUser();
  },
  isIdentified(): boolean {
    return sdk.isIdentified();
  },
  on<T extends EventName>(name: T, handler: EventHandler<T>): Unsubscribe {
    return sdk.dispatch("on", name, handler) as Unsubscribe;
  },
  off<T extends EventName>(name: T, handler?: EventHandler<T>): void {
    sdk.dispatch("off", name, handler);
  },
  metadata(patch: Record<string, string | null>): void {
    sdk.dispatch("metadata", patch);
  },
  /** Allow or stop host-page visitor analytics; `false` also removes the stored device id. */
  tracking(enabled: boolean): void {
    sdk.dispatch("tracking", enabled);
  },
  destroy(): void {
    sdk.dispatch("destroy");
  },
};

export default Quackback;
