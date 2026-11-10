import { outboundMessageSchema, type OutboundMessage } from "./protocol.js";
export type { OutboundMessage } from "./protocol.js";

export type InboundMessage =
  | { type: "quackback:init"; data?: unknown }
  | { type: "quackback:identify"; data: unknown }
  | { type: "quackback:device"; data: string | null }
  | { type: "quackback:metadata"; data: Record<string, string> }
  | { type: "quackback:open"; data?: unknown }
  | { type: "quackback:locale"; data: string }
  | { type: "quackback:mobile"; data: boolean };

export interface BridgeOptions {
  getIframe: () => HTMLIFrameElement | null;
  origin: string;
}

export interface Bridge {
  send(type: InboundMessage["type"], data?: unknown): void;
  onMessage(handler: (msg: OutboundMessage) => void): () => void;
  dispose(): void;
}

export function createBridge(opts: BridgeOptions): Bridge {
  const handlers = new Set<(msg: OutboundMessage) => void>();

  const listener = (event: MessageEvent) => {
    if (event.origin !== opts.origin) return;
    const frame = opts.getIframe()?.contentWindow;
    if (!frame || event.source !== frame) return;
    const parsed = outboundMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const msg = parsed.data;
    for (const h of handlers) {
      try {
        h(msg);
      } catch {
        /* swallow */
      }
    }
  };
  window.addEventListener("message", listener);

  return {
    send(type, data) {
      const iframe = opts.getIframe();
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage({ type, data }, opts.origin);
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    dispose() {
      window.removeEventListener("message", listener);
      handlers.clear();
    },
  };
}
