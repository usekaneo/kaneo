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
import db, { schema } from "../../apps/api/src/database";
import { adminWithTarget } from "./helpers/admin/admin-users-api";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64");
const PICTURE = "https://id.example.com/tom.png";

let setup: Awaited<ReturnType<typeof adminWithTarget>>;

beforeEach(async () => {
  await resetTestDatabase();
  setup = await adminWithTarget();
});
afterEach(() => vi.unstubAllEnvs());

const avatar = (method: string, body?: unknown) =>
  setup.asAdmin(`/${setup.target.userId}/avatar`, { method, body });
const upload = () => avatar("PUT", { contentType: "image/png", data: PNG });

async function targetImage() {
  const [user] = await db
    .select({ image: schema.userTable.image })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, setup.target.userId));
  return user?.image;
}

async function manageImageByProvider(image: string | null) {
  vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
  await db.insert(schema.accountTable).values({
    accountId: `sub-${randomUUID()}`,
    providerId: "custom",
    userId: setup.target.userId,
  });
  await db
    .update(schema.userTable)
    .set({ image })
    .where(eq(schema.userTable.id, setup.target.userId));
}

describe("admin avatar management", () => {
  it("sets and removes another user's avatar, recording each once", async () => {
    const set = await upload();
    expect(set.status, await set.clone().text()).toBe(200);
    const { image } = (await set.json()) as { image: string };
    expect(image).toMatch(/^\/api\/user\/avatar\//);
    expect(await targetImage()).toBe(image);
    const served = await setup.app.request(image);
    expect(served.status).toBe(200);

    const removed = await avatar("DELETE");
    expect(await removed.json()).toEqual({ removed: true });
    expect(await targetImage()).toBeNull();
    expect(await db.select().from(schema.userAvatarTable)).toEqual([]);

    const again = await avatar("DELETE");
    expect(await again.json()).toEqual({ removed: false });

    const rows = await readAuditLog();
    expect(rows.map((row) => row.action)).toEqual([
      "user.avatar_changed",
      "user.avatar_removed",
    ]);
    expect(rows.every((row) => row.targetId === setup.target.userId)).toBe(
      true,
    );
    expect(JSON.stringify(rows)).not.toContain(PNG);
  });

  it("rejects images that are not what they claim", async () => {
    const response = await avatar("PUT", {
      contentType: "image/jpeg",
      data: PNG,
    });
    expect(response.status).toBe(400);
    expect(await targetImage()).toBeNull();
    expect(await readAuditLog()).toEqual([]);
  });

  it("keeps a picture the identity provider manages", async () => {
    await manageImageByProvider(PICTURE);
    const set = await upload();
    expect(set.status).toBe(403);
    expect((await readErrorBody(set)).code).toBe(
      "PROFILE_FIELD_MANAGED_BY_PROVIDER",
    );
    expect((await avatar("DELETE")).status).toBe(403);
    expect(await targetImage()).toBe(PICTURE);
    expect(await readAuditLog()).toEqual([]);
  });

  it("can still withdraw an earlier Kaneo upload when the provider manages pictures", async () => {
    expect((await upload()).status).toBe(200);
    await manageImageByProvider((await targetImage()) ?? null);
    const removed = await avatar("DELETE");
    expect(removed.status).toBe(200);
    expect(await targetImage()).toBeNull();
  });
});
