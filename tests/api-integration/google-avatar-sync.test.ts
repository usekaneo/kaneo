import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { GOOGLE_AVATAR_ID_PREFIX } from "../../apps/api/src/user/avatar";
import saveAvatar from "../../apps/api/src/user/controllers/save-avatar";
import syncGoogleAvatar from "../../apps/api/src/user/controllers/sync-google-avatar";
import { GOOGLE_USERINFO_URL } from "../../apps/api/src/user/google-avatar";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const PNG_1 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
]);
const PNG_2 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02,
]);

function makeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

beforeEach(resetTestDatabase);
afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncGoogleAvatar", () => {
  it("downloads and stores the Google profile picture and updates it on subsequent sign-ins when changed", async () => {
    const { user } = await createWorkspaceMember();
    await db.insert(schema.accountTable).values({
      userId: user.id,
      providerId: "google",
      accountId: "google-sub-1",
      idToken: makeJwt({
        sub: "google-sub-1",
        picture: "https://lh3.googleusercontent.com/a/pic-1",
      }),
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(PNG_1, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const firstUrl = await syncGoogleAvatar({ userId: user.id });
    expect(firstUrl).toMatch(
      new RegExp(`^/api/user/avatar/${GOOGLE_AVATAR_ID_PREFIX}`),
    );

    const [storedFirst] = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.userId, user.id));
    expect(storedFirst).toBeDefined();
    expect(Buffer.from(storedFirst.data).equals(PNG_1)).toBe(true);

    const [updatedUser] = await db
      .select({ image: schema.userTable.image })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, user.id));
    expect(updatedUser.image).toBe(firstUrl);

    // Same bytes on next sign-in preserves the existing avatar ID (cache-friendly)
    fetchSpy.mockResolvedValueOnce(
      new Response(PNG_1, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const unchangedUrl = await syncGoogleAvatar({ userId: user.id });
    expect(unchangedUrl).toBe(firstUrl);

    // Changed bytes on next sign-in rotates the Google avatar ID and updates bytes
    fetchSpy.mockResolvedValueOnce(
      new Response(PNG_2, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const rotatedUrl = await syncGoogleAvatar({ userId: user.id });
    expect(rotatedUrl).not.toBe(firstUrl);
    expect(rotatedUrl).toMatch(
      new RegExp(`^/api/user/avatar/${GOOGLE_AVATAR_ID_PREFIX}`),
    );

    const [storedSecond] = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.userId, user.id));
    expect(Buffer.from(storedSecond.data).equals(PNG_2)).toBe(true);
  });

  it("preserves a custom uploaded Kaneo avatar on Google sign-in", async () => {
    const { user } = await createWorkspaceMember();
    const custom = await saveAvatar({
      userId: user.id,
      contentType: "image/png",
      data: PNG_1.toString("base64"),
    });
    await db
      .update(schema.userTable)
      .set({ image: custom.url })
      .where(eq(schema.userTable.id, user.id));

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await syncGoogleAvatar({
      userId: user.id,
      pictureUrl: "https://lh3.googleusercontent.com/a/new-google-pic",
    });

    expect(result).toBe(custom.url);
    expect(fetchSpy).not.toHaveBeenCalled();

    const [row] = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.userId, user.id));
    expect(row.id).toBe(custom.id);
    expect(Buffer.from(row.data).equals(PNG_1)).toBe(true);
  });

  it("preserves a custom upload stored in user_avatar before user.image is updated", async () => {
    const { user } = await createWorkspaceMember();
    const custom = await saveAvatar({
      userId: user.id,
      contentType: "image/png",
      data: PNG_1.toString("base64"),
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await syncGoogleAvatar({
      userId: user.id,
      pictureUrl: "https://lh3.googleusercontent.com/a/new-google-pic",
    });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    const [row] = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.userId, user.id));
    expect(row.id).toBe(custom.id);
    expect(Buffer.from(row.data).equals(PNG_1)).toBe(true);
  });

  it("falls back to Google userinfo when idToken does not contain a picture claim", async () => {
    const { user } = await createWorkspaceMember();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: "google-sub-2",
            picture: "https://lh3.googleusercontent.com/a/fallback-pic",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(PNG_1, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );

    const url = await syncGoogleAvatar({
      userId: user.id,
      idToken: makeJwt({ sub: "google-sub-2" }),
      accessToken: "ya29.access-token",
    });

    expect(url).toMatch(
      new RegExp(`^/api/user/avatar/${GOOGLE_AVATAR_ID_PREFIX}`),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      GOOGLE_USERINFO_URL,
      expect.any(Object),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://lh3.googleusercontent.com/a/fallback-pic",
      expect.any(Object),
    );
  });
});
