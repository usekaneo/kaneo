import { describe, expect, it } from "vite-plus/test";
import {
  basicAuthorization,
  CLOUD_REJECTED_MESSAGE,
  MISSING_CLOUD_TOKEN_MESSAGE,
  MISSING_EMAIL_MESSAGE,
  MISSING_SERVER_TOKEN_MESSAGE,
  resolveJiraAuth,
  SERVER_REJECTED_MESSAGE,
} from "./auth.js";

const CLOUD = { baseUrl: "https://acme.atlassian.net", cloud: true };
const SERVER = { baseUrl: "https://jira.example.com", cloud: false };

describe("resolveJiraAuth", () => {
  it("uses Basic auth with the email and API token on Jira Cloud", () => {
    expect(
      resolveJiraAuth(CLOUD, {
        email: " ada@example.com ",
        apiToken: " token-1 ",
      }),
    ).toEqual({
      apiVersion: "3",
      authorization: `Basic ${Buffer.from("ada@example.com:token-1").toString("base64")}`,
      rejectedMessage: CLOUD_REJECTED_MESSAGE,
    });
  });

  it("needs the Atlassian account email on Jira Cloud", () => {
    expect(() => resolveJiraAuth(CLOUD, { apiToken: "token-1" })).toThrow(
      MISSING_EMAIL_MESSAGE,
    );
    expect(() =>
      resolveJiraAuth(CLOUD, { email: "  ", apiToken: "token-1" }),
    ).toThrow(MISSING_EMAIL_MESSAGE);
  });

  it("sends a personal access token as a bearer on Data Center", () => {
    expect(resolveJiraAuth(SERVER, { apiToken: " pat-1 " })).toEqual({
      apiVersion: "2",
      authorization: "Bearer pat-1",
      rejectedMessage: SERVER_REJECTED_MESSAGE,
    });
  });

  it("uses Basic auth on Data Center when an email is given", () => {
    expect(
      resolveJiraAuth(SERVER, { email: "fred", apiToken: "secret" }),
    ).toMatchObject({
      apiVersion: "2",
      authorization: `Basic ${Buffer.from("fred:secret").toString("base64")}`,
    });
  });

  it("asks for a token before anything else", () => {
    expect(() => resolveJiraAuth(CLOUD, { email: "a@b.c" })).toThrow(
      MISSING_CLOUD_TOKEN_MESSAGE,
    );
    expect(() => resolveJiraAuth(SERVER, { apiToken: " " })).toThrow(
      MISSING_SERVER_TOKEN_MESSAGE,
    );
  });
});

describe("basicAuthorization", () => {
  it("encodes non-ASCII credentials as UTF-8", () => {
    expect(basicAuthorization("zoë@example.com", "pässword")).toBe(
      `Basic ${Buffer.from("zoë@example.com:pässword", "utf8").toString("base64")}`,
    );
  });
});
