import { describe, expect, it } from "vitest";
import { buildInvitationLink } from "./invitation-link";

describe("buildInvitationLink", () => {
  it("builds the accept route from the given origin", () => {
    expect(buildInvitationLink("inv-1", "https://kaneo.example.com")).toBe(
      "https://kaneo.example.com/invitation/accept/inv-1",
    );
  });

  it("keeps a non-standard port", () => {
    expect(buildInvitationLink("inv-2", "http://192.168.1.10:5173")).toBe(
      "http://192.168.1.10:5173/invitation/accept/inv-2",
    );
  });

  it("does not double the separator when the origin has a trailing slash", () => {
    expect(buildInvitationLink("inv-3", "https://kaneo.example.com/")).toBe(
      "https://kaneo.example.com/invitation/accept/inv-3",
    );
  });

  it("falls back to the browser origin when none is given", () => {
    // jsdom serves the suite from http://localhost:3000
    expect(buildInvitationLink("inv-4")).toBe(
      `${window.location.origin}/invitation/accept/inv-4`,
    );
  });
});
