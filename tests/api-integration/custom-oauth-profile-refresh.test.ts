import { randomUUID } from "node:crypto";
import { DrizzleQueryError, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { buildAvatarUrl } from "../../apps/api/src/user/avatar";
import { resetTestDatabase } from "./helpers/database";
import {
  CUSTOM_OAUTH_CALLBACK_URL,
  signInWithCustomOAuth,
} from "./helpers/custom-oauth";

vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "kaneo-test";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "kaneo-test-secret";
  process.env.CUSTOM_OAUTH_AUTHORIZATION_URL =
    "https://idp.example.com/authorize";
  process.env.CUSTOM_OAUTH_TOKEN_URL = "https://idp.example.com/token";
});

const SUBJECT = "provider-subject-1";
const PICTURE = "https://idp.example.com/avatars/jane.png";

function claims(overrides: Record<string, unknown> = {}) {
  return {
    sub: SUBJECT,
    email: "jane@example.com",
    email_verified: true,
    name: "Jane Provider",
    ...overrides,
  };
}

async function seedUser(
  overrides: Partial<typeof schema.userTable.$inferInsert> = {},
) {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${randomUUID()}`,
      email: "jane@example.com",
      emailVerified: true,
      name: "Jane Local",
      ...overrides,
    })
    .returning();
  if (!user) throw new Error("Failed to seed user");
  return user;
}

async function seedLinkedUser(
  overrides: Partial<typeof schema.userTable.$inferInsert> = {},
) {
  const user = await seedUser(overrides);
  await db.insert(schema.accountTable).values({
    accountId: SUBJECT,
    providerId: "custom",
    userId: user.id,
  });
  return user;
}

async function storeUpload(userId: string) {
  const [avatar] = await db
    .insert(schema.userAvatarTable)
    .values({
      userId,
      mimeType: "image/png",
      size: 8,
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    })
    .returning({ id: schema.userAvatarTable.id });
  if (!avatar) throw new Error("Failed to seed avatar");
  const image = buildAvatarUrl(avatar.id);
  await db
    .update(schema.userTable)
    .set({ image })
    .where(eq(schema.userTable.id, userId));
  return image;
}

async function loadUser(email: string) {
  const [user] = await db
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      email: schema.userTable.email,
      emailVerified: schema.userTable.emailVerified,
      image: schema.userTable.image,
      locale: schema.userTable.locale,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email));
  return user;
}

async function signIn(overrides: Record<string, unknown> = {}) {
  const { app } = createApp();
  const response = await signInWithCustomOAuth(app, claims(overrides));
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(CUSTOM_OAUTH_CALLBACK_URL);
  return { app, response };
}

describe("API integration: custom OAuth profile refresh", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("sign-up", () => {
    it("accepts the shared social sign-in endpoint with the registered callback", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image,locale");
      const { app } = createApp();
      const response = await signInWithCustomOAuth(
        app,
        claims({ picture: PICTURE, locale: "de" }),
        "/api/auth/oauth2/callback/custom",
        "/api/auth/sign-in/social",
      );

      expect(response.headers.get("location")).toBe(CUSTOM_OAUTH_CALLBACK_URL);
      expect(await loadUser("jane@example.com")).toMatchObject({
        image: PICTURE,
        locale: "de-DE",
      });
    });

    it("keeps the existing provider ID when both id and sub are present", async () => {
      await signIn({ id: "legacy-provider-id", sub: "other-subject" });

      const accounts = await db
        .select({ accountId: schema.accountTable.accountId })
        .from(schema.accountTable);
      expect(accounts).toEqual([{ accountId: "legacy-provider-id" }]);
    });

    it("stores the managed picture and the supported locale", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image,locale");

      await signIn({ picture: PICTURE, locale: "de" });

      expect(await loadUser("jane@example.com")).toMatchObject({
        name: "Jane Provider",
        image: PICTURE,
        locale: "de-DE",
      });
    });

    it("stores no picture or locale it cannot use", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image,locale");

      await signIn({ picture: "javascript:alert(1)", locale: "sv" });

      expect(await loadUser("jane@example.com")).toMatchObject({
        image: null,
        locale: null,
      });
    });

    it("keeps storing the raw claims while no field is managed", async () => {
      await signIn({ picture: PICTURE, locale: "de" });

      expect(await loadUser("jane@example.com")).toMatchObject({
        name: "Jane Provider",
        image: PICTURE,
        locale: "de",
      });
    });
  });

  describe("returning users", () => {
    it("refreshes only the managed fields", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
      await seedLinkedUser({ image: null, locale: "en-US" });

      await signIn({ picture: PICTURE, locale: "de" });

      expect(await loadUser("jane@example.com")).toMatchObject({
        name: "Jane Provider",
        image: null,
        locale: "en-US",
      });
    });

    it("leaves the profile alone while no field is managed", async () => {
      await seedLinkedUser({ locale: "en-US" });

      await signIn({ picture: PICTURE, locale: "de" });

      expect(await loadUser("jane@example.com")).toMatchObject({
        name: "Jane Local",
        image: null,
        locale: "en-US",
      });
    });

    it("never changes the email of a user linked with another address", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image,locale");
      await seedLinkedUser({
        email: "local@example.com",
        emailVerified: false,
      });

      await signIn({ email: "other@example.com", picture: PICTURE });

      expect(await loadUser("local@example.com")).toMatchObject({
        name: "Jane Provider",
        email: "local@example.com",
        emailVerified: false,
        image: PICTURE,
      });
      expect(await loadUser("other@example.com")).toBeUndefined();
    });

    it("still marks the email verified when the provider verified it", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
      await seedLinkedUser({ emailVerified: false });

      await signIn();

      expect(await loadUser("jane@example.com")).toMatchObject({
        name: "Jane Provider",
        emailVerified: true,
      });
    });

    it("refreshes a verified local user it links on the first sign-in", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,locale");
      const user = await seedUser({ locale: "en-US" });

      await signIn({ locale: "de" });

      expect(await loadUser("jane@example.com")).toMatchObject({
        id: user.id,
        name: "Jane Provider",
        locale: "de-DE",
      });
      const accounts = await db
        .select({ providerId: schema.accountTable.providerId })
        .from(schema.accountTable)
        .where(eq(schema.accountTable.userId, user.id));
      expect(accounts).toEqual([{ providerId: "custom" }]);
    });
  });

  describe("profile picture", () => {
    it("replaces an upload with the provider's picture and deletes the upload", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const user = await seedLinkedUser();
      const upload = await storeUpload(user.id);

      const { app } = await signIn({ picture: PICTURE });

      expect(await loadUser("jane@example.com")).toMatchObject({
        image: PICTURE,
      });
      expect(await db.select().from(schema.userAvatarTable)).toHaveLength(0);
      expect((await app.request(upload)).status).toBe(404);
    });

    it("keeps an upload while the provider sends no picture", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const user = await seedLinkedUser();
      const upload = await storeUpload(user.id);

      await signIn();

      expect(await loadUser("jane@example.com")).toMatchObject({
        image: upload,
      });
      expect(await db.select().from(schema.userAvatarTable)).toHaveLength(1);
    });

    it("clears a picture the provider no longer sends", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      await seedLinkedUser({ image: PICTURE });

      await signIn();

      expect(await loadUser("jane@example.com")).toMatchObject({
        image: null,
      });
    });
  });

  it.each([undefined, "sv"])(
    "keeps the stored locale when the claim is %p",
    async (locale) => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "locale");
      await seedLinkedUser({ locale: "fr-FR" });

      await signIn({ locale });

      expect(await loadUser("jane@example.com")).toMatchObject({
        locale: "fr-FR",
      });
    },
  );

  it("completes the sign-in when the refresh fails", async () => {
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
    await seedLinkedUser();
    const update = getDatabase().update.bind(getDatabase());
    vi.spyOn(getDatabase(), "update").mockImplementation((table) => {
      if (table === schema.userTable) {
        throw new DrizzleQueryError(
          'update "user" set "name" = $1',
          ["Jane Provider"],
          Object.assign(new Error("Connection terminated"), {
            code: "ECONNRESET",
          }),
        );
      }
      return update(table);
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { response } = await signIn();

    expect(response.headers.getSetCookie().join("; ")).toContain(
      "session_token=",
    );
    expect(errors).toHaveBeenCalledWith("Managed profile refresh failed:", {
      error: "Error",
      code: "ECONNRESET",
    });
    expect(JSON.stringify(errors.mock.calls)).not.toContain("Jane Provider");
    expect(await loadUser("jane@example.com")).toMatchObject({
      name: "Jane Local",
    });
  });

  it("refuses provider sign-ins through the social callback", async () => {
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
    const { app } = createApp();

    const response = await signInWithCustomOAuth(
      app,
      claims(),
      "/api/auth/callback/custom",
    );

    expect(response.status).toBe(404);
    expect(await loadUser("jane@example.com")).toBeUndefined();
    expect(await db.select().from(schema.sessionTable)).toHaveLength(0);
  });
});
