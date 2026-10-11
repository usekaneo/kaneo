import type { Session, User } from "better-auth/types";
import type { ApiKey } from "../../openapi";

export type PluginRequestAuth = {
  userId: string;
  userEmail: string;
  user: User | null;
  session: Session | null;
  apiKey?: ApiKey;
};

const requests = new WeakMap<Request, PluginRequestAuth>();

export function attachPluginRequestAuth(
  request: Request,
  auth: PluginRequestAuth,
): void {
  requests.set(request, auth);
}

export function readPluginRequestAuth(
  request: Request,
): PluginRequestAuth | undefined {
  return requests.get(request);
}
