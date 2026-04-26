import type { BroadcastAdapter, BroadcastMessage } from "./broadcast-adapter";

export class InMemoryBroadcastAdapter implements BroadcastAdapter {
  private handler?: (msg: BroadcastMessage) => void;

  async publish(msg: BroadcastMessage): Promise<void> {
    // Deliver directly in the same process
    this.handler?.(msg);
  }

  async subscribe(handler: (msg: BroadcastMessage) => void): Promise<void> {
    this.handler = handler;
  }

  async shutdown(): Promise<void> {
    this.handler = undefined;
  }
}
