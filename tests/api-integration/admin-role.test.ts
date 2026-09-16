import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

async function createUser(role: "admin" | "user") {
  const email = `${randomUUID()}@example.com`;
  const password = "admin-role-test-password";
  const signUp = await request("/sign-up/email", {
    name: "Role test user",
    email,
    password,
  });
  expect(signUp.status).toBe(200);
  const { user } = (await signUp.json()) as { user: { id: string } };
  await db
    .update(schema.userTable)
    .set({ role })
    .where(eq(schema.userTable.id, user.id));
  const response = await request("/sign-in/email", { email, password });
  expect(response.status).toBe(200);
  const { token } = (await response.json()) as { token: string };
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie).toContain("better-auth.session");
  return { id: user.id, cookie, token };
}

function request(path: string, body: unknown, headers: HeadersInit = {}) {
  return auth.handler(
    new Request(`http://localhost:1337/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

async function getRole(id: string) {
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, id));
  return user.role;
}

describe.each(["/admin/set-role", "/admin/update-user"])(
  "API integration: %s",
  (path) => {
    function body(userId: string, role: string | string[]) {
      return path === "/admin/set-role"
        ? { userId, role }
        : { userId, data: { role } };
    }

    beforeEach(resetTestDatabase);

    it.each([
      { role: "user" },
      { role: ["user"] },
      { role: [] },
      { role: "admin" },
    ])("rejects setting your own role to $role", async ({ role }) => {
      const admin = await createUser("admin");
      const response = await request(path, body(admin.id, role), {
        Cookie: admin.cookie,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "YOU_CANNOT_CHANGE_YOUR_OWN_ROLE",
      });
      expect(await getRole(admin.id)).toBe("admin");
    });

    it("rejects changing your own role using a bearer token", async () => {
      const admin = await createUser("admin");
      const response = await request(path, body(admin.id, "user"), {
        Authorization: `Bearer ${admin.token}`,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "YOU_CANNOT_CHANGE_YOUR_OWN_ROLE",
      });
      expect(await getRole(admin.id)).toBe("admin");
    });

    it("allows managing another user but preserves the remaining admin", async () => {
      const admin = await createUser("admin");
      const other = await createUser("user");
      const headers = { Cookie: admin.cookie };

      expect(
        (await request(path, body(other.id, "admin"), headers)).status,
      ).toBe(200);
      expect(await getRole(other.id)).toBe("admin");
      expect(
        (await request(path, body(admin.id, "user"), headers)).status,
      ).toBe(400);
      expect(
        (await request(path, body(other.id, "user"), headers)).status,
      ).toBe(200);
      expect(
        (await request(path, body(admin.id, "user"), headers)).status,
      ).toBe(400);
      expect(await getRole(admin.id)).toBe("admin");
      expect(await getRole(other.id)).toBe("user");
    });

    it("denies a demoted admin even with their old session cookie", async () => {
      const admin = await createUser("admin");
      const other = await createUser("admin");
      expect(
        (
          await request(path, body(other.id, "user"), {
            Cookie: admin.cookie,
          })
        ).status,
      ).toBe(200);

      const response = await request(path, body(admin.id, "user"), {
        Cookie: other.cookie,
      });
      expect(response.status).toBe(403);
      expect(await getRole(admin.id)).toBe("admin");
    });

    it("requires authentication", async () => {
      const admin = await createUser("admin");
      const response = await request(path, body(admin.id, "user"));
      expect(response.status).toBe(401);
      expect(await getRole(admin.id)).toBe("admin");
    });

    it("preserves an administrator when admins concurrently demote each other", async () => {
      const admin = await createUser("admin");
      const other = await createUser("admin");
      // Multiple roles must still count as an administrator.
      await db
        .update(schema.userTable)
        .set({ role: "user,admin" })
        .where(eq(schema.userTable.id, other.id));

      const context = await auth.$context;
      const updateUser = context.internalAdapter.updateUser.bind(
        context.internalAdapter,
      );
      let release = () => {};
      const bothAuthorized = new Promise<void>((resolve) => {
        release = resolve;
      });
      let arrivals = 0;
      // Hold both writes until both requests have passed authorization.
      vi.spyOn(context.internalAdapter, "updateUser").mockImplementation(
        async (...args) => {
          if (++arrivals === 2) release();
          await bothAuthorized;
          return updateUser(...args);
        },
      );

      const responses = await Promise.all([
        request(path, body(other.id, "user"), { Cookie: admin.cookie }),
        request(path, body(admin.id, "user"), { Cookie: other.cookie }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 400,
      ]);
      const rejected = responses.find((response) => response.status === 400);
      expect(await rejected?.json()).toMatchObject({
        code: "CANNOT_REMOVE_LAST_ADMIN",
      });
      const roles = await Promise.all([getRole(admin.id), getRole(other.id)]);
      expect(
        roles.filter((role) => role?.split(",").includes("admin")),
      ).toHaveLength(1);
    });
  },
);

it("allows an admin to update their own profile without changing their role", async () => {
  await resetTestDatabase();
  const admin = await createUser("admin");
  const response = await request(
    "/admin/update-user",
    { userId: admin.id, data: { name: "Updated name" } },
    { Cookie: admin.cookie },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ name: "Updated name" });
  expect(await getRole(admin.id)).toBe("admin");
});
