import * as v from "valibot";
import { closeRedis, getRedisPub, getRedisSub } from "../redis";
import type { BroadcastAdapter, BroadcastMessage } from "./broadcast-adapter";

const CHANNEL_PREFIX = "kaneo:ws:";
const CHANNEL_SUFFIX = ":broadcast";
const CHANNEL_PATTERN = `${CHANNEL_PREFIX}*${CHANNEL_SUFFIX}`;

const broadcastMessageSchema = v.object({
  projectId: v.string(),
  message: v.object({
    type: v.string(),
    projectId: v.string(),
    taskId: v.optional(v.string()),
    sourceTaskId: v.optional(v.string()),
    targetTaskId: v.optional(v.string()),
  }),
  excludeInitiatorId: v.optional(v.string()),
});

export class RedisBroadcastAdapter implements BroadcastAdapter {
  private subscribed = false;

  async publish(msg: BroadcastMessage): Promise<void> {
    await getRedisPub().publish(
      this.channelForProject(msg.projectId),
      JSON.stringify(msg),
    );
  }

  async subscribe(handler: (msg: BroadcastMessage) => void): Promise<void> {
    if (this.subscribed) return;
    this.subscribed = true;

    // Pattern-subscribe to ALL project channels at once
    await getRedisSub().psubscribe(CHANNEL_PATTERN);

    // "pmessage" fires for pattern subscriptions (not "message")
    getRedisSub().on(
      "pmessage",
      (_pattern: string, _channel: string, data: string) => {
        try {
          const parsed = v.safeParse(broadcastMessageSchema, JSON.parse(data));
          if (!parsed.success) {
            console.error("Invalid broadcast message:", parsed.issues);
            return;
          }
          handler(parsed.output);
        } catch (err) {
          console.error("Failed to parse broadcast message:", err);
        }
      },
    );
  }

  async shutdown(): Promise<void> {
    // Unsubscribe from the pattern — covers all project channels
    await getRedisSub().punsubscribe(CHANNEL_PATTERN);
    closeRedis();
  }

  private channelForProject(projectId: string): string {
    return `${CHANNEL_PREFIX}${projectId}${CHANNEL_SUFFIX}`;
  }
}
