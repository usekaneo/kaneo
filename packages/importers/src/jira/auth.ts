import type { JiraSite } from "./url.js";

export type JiraApiVersion = "2" | "3";

export type JiraAuth = {
  apiVersion: JiraApiVersion;
  authorization: string;
  rejectedMessage: string;
};

export type JiraAuthInput = {
  email?: string | null;
  apiToken?: string | null;
};

export const MISSING_EMAIL_MESSAGE =
  "Add the email address of your Atlassian account.";

export const MISSING_CLOUD_TOKEN_MESSAGE =
  "Add an Atlassian API token. Create one at id.atlassian.com.";

export const MISSING_SERVER_TOKEN_MESSAGE =
  "Add a Jira personal access token. Create one under your Jira profile > Personal Access Tokens.";

export const CLOUD_REJECTED_MESSAGE =
  "Jira rejected the email and API token. Create an API token at id.atlassian.com and try again.";

export const SERVER_REJECTED_MESSAGE =
  "Jira rejected the personal access token.";

export function resolveJiraAuth(
  site: JiraSite,
  input: JiraAuthInput,
): JiraAuth {
  const token = input.apiToken?.trim();
  const email = input.email?.trim();

  if (site.cloud) {
    if (!token) throw new Error(MISSING_CLOUD_TOKEN_MESSAGE);
    if (!email) throw new Error(MISSING_EMAIL_MESSAGE);
    return {
      apiVersion: "3",
      authorization: basicAuthorization(email, token),
      rejectedMessage: CLOUD_REJECTED_MESSAGE,
    };
  }

  if (!token) throw new Error(MISSING_SERVER_TOKEN_MESSAGE);
  return {
    apiVersion: "2",
    authorization: email ? basicAuthorization(email, token) : `Bearer ${token}`,
    rejectedMessage: SERVER_REJECTED_MESSAGE,
  };
}

export function basicAuthorization(user: string, secret: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(`${user}:${secret}`)) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}
