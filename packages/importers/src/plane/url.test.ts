import { describe, expect, it } from "vite-plus/test";
import { MISSING_WORKSPACE_MESSAGE, parsePlaneUrl } from "./url.js";

describe("parsePlaneUrl", () => {
  it.each([
    ["https://app.plane.so/acme/projects/123/issues", "acme"],
    ["https://app.plane.so/acme/", "acme"],
    ["app.plane.so/acme", "acme"],
    ["  APP.PLANE.SO/acme?tab=all#top  ", "acme"],
    ["http://app.plane.so/acme/settings", "acme"],
    ["https://api.plane.so/api/v1/workspaces/acme/projects/", "acme"],
    ["https://plane.so/acme", "acme"],
  ])("maps the cloud URL %s to api.plane.so", (url, slug) => {
    expect(parsePlaneUrl(url)).toEqual({
      apiBaseUrl: "https://api.plane.so",
      workspaceSlug: slug,
    });
  });

  it.each([
    [
      "https://plane.example.com/acme/projects/1/issues/",
      "https://plane.example.com",
      "acme",
    ],
    ["plane.example.com/acme", "https://plane.example.com", "acme"],
    ["http://localhost:8080/my-team/", "http://localhost:8080", "my-team"],
    [
      "https://plane.example.com:8443/acme",
      "https://plane.example.com:8443",
      "acme",
    ],
    [
      "https://plane.example.com/api/v1/workspaces/ops/projects/",
      "https://plane.example.com",
      "ops",
    ],
    [
      "https://plane.example.com/caf%C3%A9",
      "https://plane.example.com",
      "café",
    ],
  ])("keeps the self-hosted origin for %s", (url, apiBaseUrl, slug) => {
    expect(parsePlaneUrl(url)).toEqual({ apiBaseUrl, workspaceSlug: slug });
  });

  it("prefers an explicit workspace slug", () => {
    expect(parsePlaneUrl("https://api.plane.so", " acme ")).toEqual({
      apiBaseUrl: "https://api.plane.so",
      workspaceSlug: "acme",
    });
    expect(
      parsePlaneUrl("https://plane.example.com/other/projects", "/acme/"),
    ).toEqual({
      apiBaseUrl: "https://plane.example.com",
      workspaceSlug: "acme",
    });
  });

  it("assumes Plane Cloud when only a slug is given", () => {
    expect(parsePlaneUrl("", "acme")).toEqual({
      apiBaseUrl: "https://api.plane.so",
      workspaceSlug: "acme",
    });
  });

  it.each([
    "https://api.plane.so",
    "https://app.plane.so",
    "https://plane.example.com",
    "https://plane.example.com/god-mode/general",
    "https://app.plane.so/profile/activity",
    "https://app.plane.so/accounts/forgot-password",
    "https://app.plane.so/sign-in",
    "https://plane.example.com/api/v1/users/me/",
    "",
    "   ",
    "ftp://plane.example.com/acme",
    "https://",
  ])("asks for a workspace URL when %j has no slug", (url) => {
    expect(() => parsePlaneUrl(url)).toThrow(MISSING_WORKSPACE_MESSAGE);
  });

  it("explains the expected URL shape", () => {
    expect(MISSING_WORKSPACE_MESSAGE).toBe(
      "Add your Plane workspace URL, for example https://app.plane.so/your-workspace",
    );
  });
});
