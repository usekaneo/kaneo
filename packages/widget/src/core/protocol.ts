import * as z from "zod/mini";

export const widgetUserSchema = z.object({
  id: z.string().check(z.minLength(1)),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.optional(z.nullable(z.string())),
});

export const viewSchema = z.enum([
  "home",
  "new-post",
  "changelog",
  "help",
  "chat",
  "messages",
  "tickets",
]);
const countSchema = z.number().check(z.int(), z.minimum(0));
export const eventSchemas = {
  ready: z.object({}),
  open: z.object({
    view: z.optional(viewSchema),
    postId: z.optional(z.string()),
    articleId: z.optional(z.string()),
    entryId: z.optional(z.string()),
  }),
  close: z.object({}),
  "post:created": z.object({
    id: z.string(),
    title: z.string(),
    board: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
    statusId: z.nullable(z.string()),
  }),
  vote: z.object({
    postId: z.string(),
    voted: z.boolean(),
    voteCount: countSchema,
  }),
  "comment:created": z.object({
    postId: z.string(),
    commentId: z.string(),
    parentId: z.nullable(z.string()),
  }),
  identify: z.object({
    success: z.boolean(),
    user: z.nullable(widgetUserSchema),
    anonymous: z.boolean(),
    error: z.optional(z.string()),
  }),
  "email-submitted": z.object({ email: z.string() }),
  unread: z.object({ count: countSchema }),
};

const eventMessageSchema = z.union([
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("ready"),
    payload: eventSchemas.ready,
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("open"),
    payload: eventSchemas.open,
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("close"),
    payload: eventSchemas.close,
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("post:created"),
    payload: eventSchemas["post:created"],
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("vote"),
    payload: eventSchemas.vote,
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("comment:created"),
    payload: eventSchemas["comment:created"],
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("identify"),
    payload: eventSchemas.identify,
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("email-submitted"),
    payload: eventSchemas["email-submitted"],
  }),
  z.object({
    type: z.literal("quackback:event"),
    name: z.literal("unread"),
    payload: eventSchemas.unread,
  }),
]);

export const outboundMessageSchema = z.union([
  z.object({ type: z.literal("quackback:ready") }),
  z.object({ type: z.literal("quackback:close") }),
  z.object({ type: z.literal("quackback:navigate"), url: z.string() }),
  z.object({ type: z.literal("quackback:expand"), expanded: z.boolean() }),
  z.object({
    type: z.literal("quackback:identify-result"),
    success: z.boolean(),
    user: z.optional(z.nullable(widgetUserSchema)),
    error: z.optional(z.string()),
  }),
  z.object({
    type: z.literal("quackback:auth-change"),
    user: z.nullable(widgetUserSchema),
  }),
  z.object({ type: z.literal("quackback:unread"), count: countSchema }),
  eventMessageSchema,
]);

export type OutboundMessage = z.infer<typeof outboundMessageSchema>;
export type WidgetUser = z.infer<typeof widgetUserSchema>;
export type EventMap = {
  [K in keyof typeof eventSchemas]: z.infer<(typeof eventSchemas)[K]>;
};
