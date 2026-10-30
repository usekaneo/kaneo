import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import {
  adminUsersApi,
  adminWithTarget,
} from "./helpers/admin/admin-users-api";
import { resetTestDatabase } from "./helpers/database";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64");

const endpoints = (userId: string) => [
  {
    path: "",
    method: "POST",
    body: { name: "New", email: "new@example.com", role: "admin" },
  },
  { path: `/${userId}/password-reset-email`, method: "POST" },
  { path: `/${userId}/verification-email`, method: "POST" },
  { path: `/${userId}/email-verified`, method: "PUT" },
  {
    path: `/${userId}/avatar`,
    method: "PUT",
    body: { contentType: "image/png", data: PNG },
  },
  { path: `/${userId}/avatar`, method: "DELETE" },
];

beforeEach(resetTestDatabase);

describe("admin user lifecycle endpoints", () => {
  it("reject anonymous callers, regular users, and administrator API keys", async () => {
    const { app, admin, target } = await adminWithTarget();
    const { key } = await auth.api.createApiKey({
      body: { userId: admin.userId, name: "Lifecycle test" },
    });
    const callers = [
      { headers: {}, status: 401 },
      { headers: { cookie: target.cookies }, status: 403 },
      { headers: { "x-api-key": key }, status: 403 },
      { headers: { authorization: `Bearer ${key}` }, status: 403 },
    ];

    for (const { headers, status } of callers) {
      const request = adminUsersApi(app, headers);
      for (const endpoint of endpoints(target.userId)) {
        const response = await request(endpoint.path, endpoint);
        expect(response.status, `${endpoint.method} ${endpoint.path}`).toBe(
          status,
        );
      }
    }
    expect(await readAuditLog()).toEqual([]);
  });

  it("answer 404 for an unknown user", async () => {
    const { asAdmin } = await adminWithTarget();
    for (const endpoint of endpoints("missing-user").slice(1)) {
      const response = await asAdmin(endpoint.path, endpoint);
      expect(response.status, `${endpoint.method} ${endpoint.path}`).toBe(404);
    }
    expect(await readAuditLog()).toEqual([]);
  });
});
