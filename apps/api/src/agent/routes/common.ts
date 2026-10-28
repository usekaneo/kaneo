import { errorResponse } from "../../openapi";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { requireEntitlement } from "../../billing/require-entitlement-middleware";
import { requireAgentSession } from "../access";

export const middleware = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  requireAgentSession,
];
export const mutationMiddleware = [...middleware, requireEntitlement];
export const errors = {
  400: errorResponse("Invalid request"),
  401: errorResponse("Authentication required"),
  402: errorResponse("Workspace entitlement required"),
  403: errorResponse(
    "Insufficient permissions, no user session, or not the conversation owner",
  ),
  404: errorResponse("Resource not found in this user's agent scope"),
  409: errorResponse("State changed or request ID conflicts"),
  429: errorResponse("Agent run limit reached"),
  503: errorResponse("Agent not configured"),
};
