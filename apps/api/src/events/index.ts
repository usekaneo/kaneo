import amqp, { type Channel, type Connection } from "amqplib";

const EXCHANGE_NAME = "kaneo.events";
const QUEUE_NAME = "kaneo.events.queue";

let connection: Connection | null = null;
let channel: Channel | null = null;

export type EventPayload<T = unknown> = {
  type: string;
  data: T;
  timestamp: string;
};

async function createConnection(): Promise<Connection> {
  return amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost:5672");
}

async function createChannel(conn: Connection): Promise<Channel> {
  const channel = await conn.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  return channel;
}

async function getChannel(): Promise<Channel> {
  if (!connection || !channel) {
    connection = await createConnection();
    channel = await createChannel(connection);

    connection.on("close", async () => {
      console.error("RabbitMQ connection closed. Attempting to reconnect...");
      connection = null;
      channel = null;
      await initializeEventBus();
    });
  }
  return channel;
}

export async function initializeEventBus(): Promise<void> {
  try {
    await getChannel();
  } catch (error) {
    console.error("Failed to initialize RabbitMQ:", error);
    throw error;
  }
}

export async function shutdownEventBus(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}

export async function publishEvent(
  eventType: string,
  data: unknown,
): Promise<void> {
  const channel = await getChannel();

  const payload: EventPayload = {
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    channel.publish(
      EXCHANGE_NAME,
      eventType,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  }
}

export async function subscribeToEvent<T>(
  eventType: string,
  handler: (data: T) => Promise<void>,
): Promise<void> {
  const channel = await getChannel();

  try {
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, eventType);

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        try {
          const payload = JSON.parse(msg.content.toString()) as EventPayload<T>;

          if (payload.type === eventType) {
            await handler(payload.data);
            channel.ack(msg);
          }
        } catch (error) {
          console.error(`Error processing event ${eventType}:`, error);
          channel.nack(msg, false, true);
        }
      },
      { noAck: false },
    );
  } catch (error) {
    console.error("Failed to subscribe to event:", error);
    throw error;
  }
}

initializeEventBus().catch(console.error);

process.on("SIGTERM", () => {
  shutdownEventBus().catch(console.error);
});
