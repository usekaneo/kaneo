import {
  anonymousClient,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "../../../api/src/lib/auth";
import { ac, admin, member, owner } from "./permissions";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:1337",
  plugins: [
    anonymousClient(),
    organizationClient({
      ac,
      roles: {
        member,
        admin,
        owner,
      },
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
});
