import {
  anonymousClient,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, admin, member, owner } from "./permissions";

const getBaseURL = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:1337";
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/");
  }
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  plugins: [
    anonymousClient(),
    lastLoginMethodClient(),
    magicLinkClient(),
    organizationClient({
      ac,
      roles: {
        member,
        admin,
        owner,
      },
    }),
  ],
});
