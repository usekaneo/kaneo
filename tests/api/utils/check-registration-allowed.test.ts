import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLimit = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: (...args: unknown[]) => mockLimit(...args),
            }),
          }),
        }),
      }),
    }),
  },
}));

import {
  checkPasswordRegistrationAllowed,
  checkRegistrationAllowed,
} from "../../../apps/api/src/utils/check-registration-allowed";

const DISABLE_REGISTRATION_KEY = "DISABLE_REGISTRATION";
const DISABLE_PASSWORD_REGISTRATION_KEY = "DISABLE_PASSWORD_REGISTRATION";

const validInvitation = {
  id: "inv-1",
  email: "guest@example.com",
  workspaceId: "ws-1",
  workspaceName: "Acme",
  inviterName: "Ada",
  expiresAt: new Date(Date.now() + 60_000),
  status: "pending",
};

describe("checkRegistrationAllowed", () => {
  const originalEnv = process.env[DISABLE_REGISTRATION_KEY];

  beforeEach(() => {
    mockLimit.mockReset();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[DISABLE_REGISTRATION_KEY];
    } else {
      process.env[DISABLE_REGISTRATION_KEY] = originalEnv;
    }
  });

  it("allows registration when DISABLE_REGISTRATION is not true", async () => {
    delete process.env[DISABLE_REGISTRATION_KEY];

    const result = await checkRegistrationAllowed("anyone@example.com");

    expect(result.allowed).toBe(true);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("blocks registration when disabled and no invitationId is provided", async () => {
    process.env[DISABLE_REGISTRATION_KEY] = "true";

    const result = await checkRegistrationAllowed("guest@example.com");

    expect(result.allowed).toBe(false);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("allows registration when disabled and a valid invitation is found", async () => {
    process.env[DISABLE_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([validInvitation]);

    const result = await checkRegistrationAllowed("guest@example.com", "inv-1");

    expect(result.allowed).toBe(true);
    expect(result.invitation?.id).toBe("inv-1");
  });

  it("blocks registration when invitation lookup returns no rows", async () => {
    process.env[DISABLE_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([]);

    const result = await checkRegistrationAllowed(
      "guest@example.com",
      "inv-missing",
    );

    expect(result.allowed).toBe(false);
  });

  it("blocks registration when invitation email does not match", async () => {
    process.env[DISABLE_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([]);

    const result = await checkRegistrationAllowed("other@example.com", "inv-1");

    expect(result.allowed).toBe(false);
  });

  it("allows registration when invitation email matches", async () => {
    process.env[DISABLE_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([validInvitation]);

    const result = await checkRegistrationAllowed("guest@example.com", "inv-1");

    expect(result.allowed).toBe(true);
  });
});

describe("checkPasswordRegistrationAllowed", () => {
  const originalEnv = process.env[DISABLE_PASSWORD_REGISTRATION_KEY];

  beforeEach(() => {
    mockLimit.mockReset();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[DISABLE_PASSWORD_REGISTRATION_KEY];
    } else {
      process.env[DISABLE_PASSWORD_REGISTRATION_KEY] = originalEnv;
    }
  });

  it("allows password registration when DISABLE_PASSWORD_REGISTRATION is not true", async () => {
    delete process.env[DISABLE_PASSWORD_REGISTRATION_KEY];

    const result = await checkPasswordRegistrationAllowed("anyone@example.com");

    expect(result.allowed).toBe(true);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("blocks password registration when disabled and no invitationId is provided", async () => {
    process.env[DISABLE_PASSWORD_REGISTRATION_KEY] = "true";

    const result = await checkPasswordRegistrationAllowed("guest@example.com");

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(
      "Password registration is currently disabled",
    );
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("allows password registration when disabled and a valid invitation is found", async () => {
    process.env[DISABLE_PASSWORD_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([validInvitation]);

    const result = await checkPasswordRegistrationAllowed(
      "guest@example.com",
      "inv-1",
    );

    expect(result.allowed).toBe(true);
    expect(result.invitation?.id).toBe("inv-1");
  });

  it("blocks password registration when invitation lookup returns no rows", async () => {
    process.env[DISABLE_PASSWORD_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([]);

    const result = await checkPasswordRegistrationAllowed(
      "guest@example.com",
      "inv-missing",
    );

    expect(result.allowed).toBe(false);
  });

  it("blocks password registration when invitation email does not match", async () => {
    process.env[DISABLE_PASSWORD_REGISTRATION_KEY] = "true";
    mockLimit.mockResolvedValue([]);

    const result = await checkPasswordRegistrationAllowed(
      "other@example.com",
      "inv-1",
    );

    expect(result.allowed).toBe(false);
  });
});
