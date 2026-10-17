import { describe, expect, it } from "vite-plus/test";
import { formatProviderList } from "@/components/project/automations/format-provider-list";

describe("formatProviderList", () => {
  it("joins provider names as alternatives", () => {
    expect(formatProviderList(["GitLab"], "en-US")).toBe("GitLab");
    expect(formatProviderList(["Gitea", "GitLab"], "en-US")).toBe(
      "Gitea or GitLab",
    );
    expect(formatProviderList(["GitHub", "Gitea", "GitLab"], "en-US")).toBe(
      "GitHub, Gitea, or GitLab",
    );
  });

  it("falls back to commas for an unknown locale tag", () => {
    expect(formatProviderList(["Gitea", "GitLab"], "not a locale")).toBe(
      "Gitea, GitLab",
    );
  });
});
