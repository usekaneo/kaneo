import { AsyncLocalStorage } from "node:async_hooks";
import { EventEmitter } from "node:events";

const EVENTS = new EventEmitter();
EVENTS.setMaxListeners(100);
export const eventContext = new AsyncLocalStorage<{ initiatorId: string }>();

export type EventPayload<T = unknown> = {
  type: string;
  data: T;
  timestamp: string;
};

type EventOptions = { waitForHandlers?: boolean; requireDelivery?: boolean };

export async function shutdownEventBus(): Promise<void> {
  EVENTS.removeAllListeners();
}

export async function publishEvent(
  eventType: string,
  data: unknown,
  options?: EventOptions,
): Promise<void> {
  let enhancedData = null;
  if (typeof data === "object" && data !== null) {
    const store = eventContext.getStore();
    enhancedData = { ...data, initiatorId: store?.initiatorId };
  }

  const payload: EventPayload = {
    type: eventType,
    data: enhancedData || data,
    timestamp: new Date().toISOString(),
  };

  try {
    if (options?.waitForHandlers || options?.requireDelivery) {
      // EventEmitter.emit discards promises. Bounded producers must await the
      // actual subscriber wrappers before starting their next item.
      for (const listener of EVENTS.listeners(eventType))
        await listener(payload, options);
    } else {
      EVENTS.emit(eventType, payload);
    }
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  }
}

export async function subscribeToEvent<T>(
  eventType: string,
  handler: (data: T, options?: EventOptions) => Promise<void>,
): Promise<void> {
  try {
    EVENTS.on(
      eventType,
      async (payload: EventPayload<T>, options?: EventOptions) => {
        try {
          await handler(payload.data, options);
        } catch (error) {
          if (options?.requireDelivery) throw error;
          console.error(`Error processing event ${eventType}:`, error);
        }
      },
    );
  } catch (error) {
    console.error("Failed to subscribe to event:", error);
    throw error;
  }
}

process.on("SIGTERM", () => {
  shutdownEventBus().catch(console.error);
});
