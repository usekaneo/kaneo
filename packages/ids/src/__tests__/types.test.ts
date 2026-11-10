import { expectTypeOf, it } from "vite-plus/test";
import { z } from "zod";
import {
  createId,
  generateId,
  isTypeId,
  typeIdSchema,
  flexibleIdSchema,
  flexibleToTypeIdSchema,
  anyTypeIdSchema,
  uuidSchema,
} from "../index";
import type {
  AnyTypeId,
  ArticleId,
  EntityIdMap,
  EntityType,
  ExtractPrefix,
  IdPrefix,
  KbArticleId,
  PostCommentId,
  ConversationMessageId,
  PushDeviceId,
  JobId,
  TypeId,
} from "../index";

it("preserves full prefixes, catalogue mappings and named public types", () => {
  expectTypeOf<ExtractPrefix<TypeId<"post">>>().toEqualTypeOf<"post">();
  expectTypeOf<ExtractPrefix<PostCommentId>>().toEqualTypeOf<"post_comment">();
  expectTypeOf<
    ExtractPrefix<ConversationMessageId>
  >().toEqualTypeOf<"conversation_msg">();
  expectTypeOf<
    ExtractPrefix<"post_comment_00000000000000000000000000">
  >().toEqualTypeOf<"post_comment">();
  expectTypeOf<
    ExtractPrefix<PostCommentId | ConversationMessageId>
  >().toEqualTypeOf<"post_comment" | "conversation_msg">();
  expectTypeOf<ExtractPrefix<"invalid">>().toEqualTypeOf<never>();
  expectTypeOf<ExtractPrefix<AnyTypeId>>().toEqualTypeOf<IdPrefix>();
  expectTypeOf<keyof EntityIdMap>().toEqualTypeOf<EntityType>();
  expectTypeOf(
    createId("conversation_message"),
  ).toEqualTypeOf<ConversationMessageId>();
  expectTypeOf(createId("post_comment")).toEqualTypeOf<PostCommentId>();
  expectTypeOf(createId("kb_article")).toEqualTypeOf<ArticleId>();
  expectTypeOf<KbArticleId>().toEqualTypeOf<ArticleId>();
  expectTypeOf(createId("push_device")).toEqualTypeOf<PushDeviceId>();
  expectTypeOf(createId("job")).toEqualTypeOf<JobId>();
  expectTypeOf(generateId("post")).not.toEqualTypeOf<TypeId<"board">>();
  const value: string = generateId("post_comment");
  if (isTypeId(value, "post_comment")) {
    expectTypeOf(value).toEqualTypeOf<PostCommentId>();
  }
});

it("infers schema inputs as strings and outputs only the guarantees they validate", () => {
  const strict = typeIdSchema("post_comment");
  const flexibleUuid = flexibleIdSchema("post_comment");
  const flexibleTypeId = flexibleToTypeIdSchema("post_comment");
  expectTypeOf<z.input<typeof strict>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof strict>>().toEqualTypeOf<PostCommentId>();
  expectTypeOf<z.input<typeof flexibleUuid>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof flexibleUuid>>().toEqualTypeOf<string>();
  expectTypeOf<z.input<typeof flexibleTypeId>>().toEqualTypeOf<string>();
  expectTypeOf<
    z.output<typeof flexibleTypeId>
  >().toEqualTypeOf<PostCommentId>();
  expectTypeOf<z.input<typeof anyTypeIdSchema>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof anyTypeIdSchema>>().toEqualTypeOf<string>();
  expectTypeOf<z.input<typeof uuidSchema>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof uuidSchema>>().toEqualTypeOf<string>();
});
