import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { buildAvatarUrl } from "../../apps/api/src/user/avatar";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { createWorkspaceMember } from "./helpers/fixtures";

type App = ReturnType<typeof createApp>["app"];

const PICTURE = "https://id.example.com/jane.png";
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64");

async function linkCustomAccount(userId: string) {
  await db.insert(schema.accountTable).values({
    accountId: `sub-${randomUUID()}`,
    providerId: "custom",
    userId,
  });
}

async function signUpProviderUser(app: App) {
  const session = await signUpWithSession(app, {
    email: "jane@example.com",
    name: "Jane Doe",
  });
  await linkCustomAccount(session.userId);
  return session;
}

async function setImage(userId: string, image: string | null) {
  await db
    .update(schema.userTable)
    .set({ image })
    .where(eq(schema.userTable.id, userId));
}

async function storeUpload(userId: string) {
  const [avatar] = await db
    .insert(schema.userAvatarTable)
    .values({
      userId,
      mimeType: "image/png",
      size: 9,
      data: Buffer.from(PNG, "base64"),
    })
    .returning({ id: schema.userAvatarTable.id });
  if (!avatar) throw new Error("Failed to seed avatar");
  const image = buildAvatarUrl(avatar.id);
  await setImage(userId, image);
  return image;
}

async function loadProfile(userId: string) {
  const [user] = await db
    .select({
      name: schema.userTable.name,
      email: schema.userTable.email,
      emailVerified: schema.userTable.emailVerified,
      image: schema.userTable.image,
      locale: schema.userTable.locale,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user;
}

function listAvatars() {
  return db
    .select({ id: schema.userAvatarTable.id })
    .from(schema.userAvatarTable);
}

function updateUser(
  app: App,
  headers: Record<string, string>,
  data: Record<string, unknown>,
) {
  return app.request("/api/auth/update-user", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
}

function adminUpdateUser(
  app: App,
  cookies: string,
  userId: string,
  data: Record<string, unknown>,
) {
  return app.request("/api/auth/admin/update-user", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ userId, data }),
  });
}

function uploadAvatar(app: App, cookies: string) {
  return app.request("/api/user/avatar", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ contentType: "image/png", data: PNG }),
  });
}

function removeAvatar(app: App, cookies: string) {
  return app.request("/api/user/avatar", {
    method: "DELETE",
    headers: { cookie: cookies },
  });
}

async function expectManagedRefusal(response: Response) {
  expect(response.status).toBe(403);
  expect(await readErrorBody(response)).toMatchObject({
    code: "PROFILE_FIELD_MANAGED_BY_PROVIDER",
  });
}

describe("API integration: profile fields managed by the custom provider", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("POST /api/auth/update-user", () => {
    it.each([
      ["name", { name: "Janet Doe" }],
      ["locale", { locale: "fr-FR" }],
      ["image", { image: PICTURE }],
    ])("refuses a new %s and keeps the stored profile", async (field, data) => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", field);
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);
      const before = await loadProfile(userId);

      await expectManagedRefusal(
        await updateUser(app, { cookie: cookies }, data),
      );
      expect(await loadProfile(userId)).toEqual(before);
    });

    it("accepts the current managed values sent again", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image,locale");
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);
      await setImage(userId, PICTURE);

      const response = await updateUser(
        app,
        { cookie: cookies },
        { name: "Jane Doe", image: PICTURE, locale: null },
      );

      expect(response.status).toBe(200);
    });

    it("accepts changes to fields the provider does not manage", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);

      const response = await updateUser(
        app,
        { cookie: cookies },
        { name: "Jane Doe", locale: "de-DE", image: PICTURE },
      );

      expect(response.status).toBe(200);
      expect(await loadProfile(userId)).toMatchObject({
        name: "Jane Doe",
        locale: "de-DE",
        image: PICTURE,
      });
    });

    it("keeps profiles editable while no field is managed", async () => {
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);

      const response = await updateUser(
        app,
        { cookie: cookies },
        { name: "Janet Doe" },
      );

      expect(response.status).toBe(200);
      expect(await loadProfile(userId)).toMatchObject({ name: "Janet Doe" });
    });

    it("keeps profiles editable for people without a provider account", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image,locale");
      const { app } = createApp();
      const { userId, cookies } = await signUpWithSession(app, {
        email: "local@example.com",
        name: "Local Person",
      });

      const response = await updateUser(
        app,
        { cookie: cookies },
        { name: "Renamed Person", image: PICTURE, locale: "de-DE" },
      );

      expect(response.status).toBe(200);
      expect(await loadProfile(userId)).toMatchObject({
        name: "Renamed Person",
        image: PICTURE,
        locale: "de-DE",
      });
    });

    it.each(["x-api-key", "Authorization"])(
      "refuses a managed change sent with an API key in %s",
      async (header) => {
        vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
        const { app } = createApp();
        const { userId } = await signUpProviderUser(app);
        const { key } = await auth.api.createApiKey({
          body: { userId, name: "Managed profile test" },
        });

        const response = await updateUser(
          app,
          { [header]: header === "Authorization" ? `Bearer ${key}` : key },
          { name: "Janet Doe" },
        );
        expect(response.status).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "SESSION_REQUIRED",
        });
        expect(await loadProfile(userId)).toMatchObject({ name: "Jane Doe" });
      },
    );

    it("refuses a managed change sent with a session bearer token", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name");
      const { app } = createApp();
      const signUp = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "jane@example.com",
          password: "correct horse battery staple",
          name: "Jane Doe",
        }),
      });
      expect(signUp.status).toBe(200);
      const { token, user } = (await signUp.json()) as {
        token: string;
        user: { id: string };
      };
      await linkCustomAccount(user.id);

      await expectManagedRefusal(
        await updateUser(
          app,
          { Authorization: `Bearer ${token}` },
          { name: "Janet Doe" },
        ),
      );
      expect(await loadProfile(user.id)).toMatchObject({ name: "Jane Doe" });
    });
  });

  describe("POST /api/auth/admin/update-user", () => {
    async function setUp(managedFields = "name") {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", managedFields);
      const { app } = createApp();
      const admin = await signUpWithSession(app, {
        email: "admin@example.com",
        name: "Instance Admin",
        role: "admin",
      });
      const target = await createWorkspaceMember({ role: "member" });
      return { app, admin, target };
    }

    it.each([
      ["name", { name: "Renamed Member" }],
      ["image", { image: PICTURE }],
      ["locale", { locale: "fr-FR" }],
    ])("refuses a new %s for a provider user", async (field, data) => {
      const { app, admin, target } = await setUp(field);
      await linkCustomAccount(target.user.id);
      const before = await loadProfile(target.user.id);

      await expectManagedRefusal(
        await adminUpdateUser(app, admin.cookies, target.user.id, data),
      );
      expect(await loadProfile(target.user.id)).toEqual(before);
    });

    it("changes the email of a provider user when the managed name stays", async () => {
      const { app, admin, target } = await setUp();
      await linkCustomAccount(target.user.id);

      const response = await adminUpdateUser(
        app,
        admin.cookies,
        target.user.id,
        { name: target.user.name, email: "renamed@example.com" },
      );

      expect(response.status).toBe(200);
      expect(await loadProfile(target.user.id)).toMatchObject({
        name: target.user.name,
        email: "renamed@example.com",
        emailVerified: false,
      });
    });

    it("renames people without a provider account", async () => {
      const { app, admin, target } = await setUp();

      const response = await adminUpdateUser(
        app,
        admin.cookies,
        target.user.id,
        { name: "Renamed Member" },
      );

      expect(response.status).toBe(200);
      expect(await loadProfile(target.user.id)).toMatchObject({
        name: "Renamed Member",
      });
    });
  });

  describe("profile picture", () => {
    it("refuses an upload while the provider manages the picture", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { cookies } = await signUpProviderUser(app);

      await expectManagedRefusal(await uploadAvatar(app, cookies));
      expect(await listAvatars()).toHaveLength(0);
    });

    it("refuses removing the picture the provider sent", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);
      await setImage(userId, PICTURE);

      await expectManagedRefusal(
        await updateUser(app, { cookie: cookies }, { image: null }),
      );
      await expectManagedRefusal(await removeAvatar(app, cookies));
      expect(await loadProfile(userId)).toMatchObject({ image: PICTURE });
    });

    it("still removes a picture uploaded to Kaneo before", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);
      const upload = await storeUpload(userId);

      expect(
        (await updateUser(app, { cookie: cookies }, { image: null })).status,
      ).toBe(200);
      expect((await removeAvatar(app, cookies)).status).toBe(200);

      expect(await loadProfile(userId)).toMatchObject({ image: null });
      expect(await listAvatars()).toHaveLength(0);
      expect((await app.request(upload)).status).toBe(404);
    });

    it("also removes an upload when the file is deleted before the picture is cleared", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);
      await storeUpload(userId);

      expect((await removeAvatar(app, cookies)).status).toBe(200);
      expect(
        (await updateUser(app, { cookie: cookies }, { image: null })).status,
      ).toBe(200);

      expect(await loadProfile(userId)).toMatchObject({ image: null });
      expect(await listAvatars()).toHaveLength(0);
    });

    it("refuses replacing an upload with another one", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { userId, cookies } = await signUpProviderUser(app);
      const upload = await storeUpload(userId);

      await expectManagedRefusal(await uploadAvatar(app, cookies));
      await expectManagedRefusal(
        await updateUser(
          app,
          { cookie: cookies },
          { image: buildAvatarUrl("another-avatar") },
        ),
      );
      expect(await loadProfile(userId)).toMatchObject({ image: upload });
    });

    it("keeps uploads open for people without a provider account", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { cookies } = await signUpWithSession(app, {
        email: "local@example.com",
        name: "Local Person",
      });

      const response = await uploadAvatar(app, cookies);

      expect(response.status).toBe(200);
      expect(await listAvatars()).toHaveLength(1);
    });

    it("keeps removal open for people without a provider account", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
      const { app } = createApp();
      const { userId, cookies } = await signUpWithSession(app, {
        email: "local@example.com",
        name: "Local Person",
      });
      await storeUpload(userId);
      await setImage(userId, PICTURE);

      expect((await removeAvatar(app, cookies)).status).toBe(200);
      expect(await listAvatars()).toHaveLength(0);
      expect(
        (await updateUser(app, { cookie: cookies }, { image: null })).status,
      ).toBe(200);
      expect(await loadProfile(userId)).toMatchObject({ image: null });
    });

    it("keeps uploads open while the picture is not managed", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,locale");
      const { app } = createApp();
      const { cookies } = await signUpProviderUser(app);

      expect((await uploadAvatar(app, cookies)).status).toBe(200);
      expect((await removeAvatar(app, cookies)).status).toBe(200);
    });
  });

  describe("GET /api/user/me", () => {
    async function readManagedFields(app: App, cookies: string) {
      const response = await app.request("/api/user/me", {
        headers: { cookie: cookies },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        managedProfileFields: string[];
      };
      return body.managedProfileFields;
    }

    it("lists the managed fields for a provider user", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image,name");
      const { app } = createApp();
      const { cookies } = await signUpProviderUser(app);

      expect(await readManagedFields(app, cookies)).toEqual(["name", "image"]);
    });

    it("lists nothing for people without a provider account", async () => {
      vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image,name");
      const { app } = createApp();
      const { cookies } = await signUpWithSession(app, {
        email: "local@example.com",
        name: "Local Person",
      });

      expect(await readManagedFields(app, cookies)).toEqual([]);
    });
  });
});
