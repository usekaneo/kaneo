import { describe, expect, it } from "vite-plus/test";
import { resolveImportConnection } from "./resolve-import-connection";

describe("resolveImportConnection", () => {
  it("sends PLANKA an API key when one is given", () => {
    expect(
      resolveImportConnection(
        {
          source: "planka",
          url: "https://planka.example.com",
          apiKey: "key-123456",
          username: "ana",
          password: "hunter22",
        },
        {},
      ),
    ).toEqual({
      connection: {
        source: "planka",
        url: "https://planka.example.com",
        apiKey: "key-123456",
      },
      secrets: ["key-123456", "hunter22"],
      credentialHint: "Check the API key.",
    });
  });

  it("signs in to PLANKA with a password otherwise", () => {
    const resolved = resolveImportConnection(
      {
        source: "planka",
        url: "https://planka.example.com",
        username: "ana",
        password: "hunter22",
      },
      {},
    );

    expect(resolved.connection).toEqual({
      source: "planka",
      url: "https://planka.example.com",
      username: "ana",
      password: "hunter22",
    });
    expect(resolved.credentialHint).toBe("Check the username and password.");
  });

  it("falls back to the server's Trello API key", () => {
    expect(
      resolveImportConnection(
        { source: "trello", token: "token-123456" },
        { TRELLO_API_KEY: " app-key " },
      ).connection,
    ).toEqual({ source: "trello", apiKey: "app-key", token: "token-123456" });

    expect(
      resolveImportConnection(
        { source: "trello", token: "token-123456", apiKey: "own-key" },
        { TRELLO_API_KEY: "app-key" },
      ).connection,
    ).toEqual({ source: "trello", apiKey: "own-key", token: "token-123456" });
  });

  it("signs in to Jira with or without an email", () => {
    const hint =
      "Check the email and API token, or the personal access token for Jira Data Center.";

    expect(
      resolveImportConnection(
        {
          source: "jira",
          url: "https://acme.atlassian.net",
          email: "ana@example.com",
          apiToken: "jira-token-123456",
        },
        {},
      ),
    ).toEqual({
      connection: {
        source: "jira",
        url: "https://acme.atlassian.net",
        email: "ana@example.com",
        apiToken: "jira-token-123456",
      },
      secrets: ["jira-token-123456"],
      credentialHint: hint,
    });

    expect(
      resolveImportConnection(
        {
          source: "jira",
          url: "https://jira.example.com",
          apiToken: "pat-123456",
        },
        {},
      ),
    ).toEqual({
      connection: {
        source: "jira",
        url: "https://jira.example.com",
        apiToken: "pat-123456",
      },
      secrets: ["pat-123456"],
      credentialHint: hint,
    });
  });

  it("asks for a Trello API key when there is none", () => {
    expect(() =>
      resolveImportConnection({ source: "trello", token: "token-123456" }, {}),
    ).toThrow("Add a Trello API key.");
  });
});
