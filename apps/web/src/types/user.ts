import type { User as BetterAuthUser } from "better-auth/types";

export type User = BetterAuthUser & {
  locale?: string | null;
  autoAssignSelf?: boolean | null;
  role?: string | null;
};
