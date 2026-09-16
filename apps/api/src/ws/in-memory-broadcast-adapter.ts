import type {
  BroadcastAdapter,
  BroadcastMessage,
  UserBroadcast,
} from "./broadcast-adapter";

export class InMemoryBroadcastAdapter implements BroadcastAdapter {
  private handler?: (msg: BroadcastMessage) => void;
  private userHandler?: (msg: UserBroadcast) => void;

  async publish(msg: BroadcastMessage): Promise<void> {
    // Deliver directly in the same process
    this.handler?.(msg);
  }

  async publishToUser(msg: UserBroadcast): Promise<void> {
    this.userHandler?.(msg);
  }

  async subscribe(handler: (msg: BroadcastMessage) => void): Promise<void> {
    this.handler = handler;
  }

  async subscribeToUser(handler: (msg: UserBroadcast) => void): Promise<void> {
    this.userHandler = handler;
  }

  async shutdown(): Promise<void> {
    this.handler = undefined;
    this.userHandler = undefined;
  }
}
