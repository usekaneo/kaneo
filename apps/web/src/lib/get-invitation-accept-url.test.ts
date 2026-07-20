import { afterEach, describe, expect, it, vi } from "vitest";
import { getInvitationAcceptUrl } from "./get-invitation-accept-url";

describe("getInvitationAcceptUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses VITE_CLIENT_URL when set", () => {
    vi.stubEnv("VITE_CLIENT_URL", "https://app.example.com");

    expect(getInvitationAcceptUrl("inv-123")).toBe(
      "https://app.example.com/invitation/accept/inv-123",
    );
  });

  it("falls back to clientUrl option when VITE_CLIENT_URL is unset", () => {
    vi.unstubAllEnvs();

    expect(
      getInvitationAcceptUrl("inv-123", {
        clientUrl: "https://canonical.example.com",
      }),
    ).toBe("https://canonical.example.com/invitation/accept/inv-123");
  });

  it("falls back to clientUrl option when VITE_CLIENT_URL is empty", () => {
    vi.stubEnv("VITE_CLIENT_URL", "");

    expect(
      getInvitationAcceptUrl("inv-123", {
        clientUrl: "https://canonical.example.com",
      }),
    ).toBe("https://canonical.example.com/invitation/accept/inv-123");
  });

  it("returns null when no base URL is available", () => {
    vi.unstubAllEnvs();

    expect(getInvitationAcceptUrl("inv-123")).toBeNull();
    expect(getInvitationAcceptUrl("inv-123", { clientUrl: "" })).toBeNull();
  });

  it("strips trailing slash from base URL", () => {
    vi.stubEnv("VITE_CLIENT_URL", "https://app.example.com/");

    expect(getInvitationAcceptUrl("inv-123")).toBe(
      "https://app.example.com/invitation/accept/inv-123",
    );
  });
});
