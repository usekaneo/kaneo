import type Redis from "ioredis";
import * as v from "valibot";
import { closeRedis, getRedisPub, getRedisSub } from "../redis";
import type {
  BroadcastAdapter,
  BroadcastMessage,
  UserBroadcast,
} from "./broadcast-adapter";

const CHANNEL_PREFIX = "kaneo:ws:";
const CHANNEL_SUFFIX = ":broadcast";
const CHANNEL_PATTERN = `${CHANNEL_PREFIX}*${CHANNEL_SUFFIX}`;

const USER_CHANNEL_PREFIX = "kaneo:ws-user:";
const USER_CHANNEL_PATTERN = `${USER_CHANNEL_PREFIX}*${CHANNEL_SUFFIX}`;

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

const userBroadcastSchema = v.object({
  userId: v.string(),
  message: v.looseObject({ type: v.string() }),
  origin: v.optional(v.string()),
});

export class RedisBroadcastAdapter implements BroadcastAdapter {
  private subscribed = false;
  private userSubscribed = false;
  private _pmessageHandler:
    | ((pattern: string, channel: string, data: string) => void)
    | null = null;
  private _userPmessageHandler:
    | ((pattern: string, channel: string, data: string) => void)
    | null = null;

  async publish(msg: BroadcastMessage): Promise<void> {
    await getRedisPub().publish(
      this.channelForProject(msg.projectId),
      JSON.stringify(msg),
    );
  }

  async publishToUser(msg: UserBroadcast): Promise<void> {
    await getRedisPub().publish(
      this.channelForUser(msg.userId),
      JSON.stringify(msg),
    );
  }

  async subscribe(handler: (msg: BroadcastMessage) => void): Promise<void> {
    if (this.subscribed) return;
    this.subscribed = true;

    // Pattern-subscribe to ALL project channels at once
    // "pmessage" fires for pattern subscriptions (not "message")
    this._pmessageHandler = (
      pattern: string,
      _channel: string,
      data: string,
    ) => {
      if (pattern !== CHANNEL_PATTERN) return;
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
    };
    (getRedisSub() as Redis).on("pmessage", this._pmessageHandler);
    await getRedisSub().psubscribe(CHANNEL_PATTERN);
  }

  async subscribeToUser(handler: (msg: UserBroadcast) => void): Promise<void> {
    if (this.userSubscribed) return;
    this.userSubscribed = true;

    this._userPmessageHandler = (
      pattern: string,
      channel: string,
      data: string,
    ) => {
      if (pattern !== USER_CHANNEL_PATTERN) return;
      try {
        const parsed = v.safeParse(userBroadcastSchema, JSON.parse(data));
        if (!parsed.success) {
          console.error("Invalid user broadcast message:", parsed.issues);
          return;
        }
        if (channel !== this.channelForUser(parsed.output.userId)) {
          console.error("User broadcast channel and payload disagree");
          return;
        }
        handler(parsed.output as UserBroadcast);
      } catch (err) {
        console.error("Failed to parse user broadcast message:", err);
      }
    };
    (getRedisSub() as Redis).on("pmessage", this._userPmessageHandler);
    await getRedisSub().psubscribe(USER_CHANNEL_PATTERN);
  }

  async shutdown(): Promise<void> {
    const sub = getRedisSub() as Redis;

    if (this._pmessageHandler) {
      sub.off("pmessage", this._pmessageHandler);
      this._pmessageHandler = null;
    }
    if (this._userPmessageHandler) {
      sub.off("pmessage", this._userPmessageHandler);
      this._userPmessageHandler = null;
    }

    // Unsubscribe from the pattern, which covers all project channels
    await getRedisSub().punsubscribe(CHANNEL_PATTERN);
    await getRedisSub().punsubscribe(USER_CHANNEL_PATTERN);
    this.subscribed = false;
    this.userSubscribed = false;
    await closeRedis();
  }

  private channelForProject(projectId: string): string {
    return `${CHANNEL_PREFIX}${projectId}${CHANNEL_SUFFIX}`;
  }

  private channelForUser(userId: string): string {
    return `${USER_CHANNEL_PREFIX}${userId}${CHANNEL_SUFFIX}`;
  }
}
