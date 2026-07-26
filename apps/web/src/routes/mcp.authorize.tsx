import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { Button } from "@/components/ui/button";
import { useMcpAuthorizationDecision } from "@/hooks/mutations/mcp/use-authorization-decision";
import { useMcpAuthorizationRequest } from "@/hooks/queries/mcp/use-authorization-request";
import { authClient } from "@/lib/auth-client";

const authorizationSearchSchema = z.object({
  request_id: z.string().optional(),
});

export const Route = createFileRoute("/mcp/authorize")({
  component: McpAuthorizePage,
  validateSearch: authorizationSearchSchema,
});

function McpAuthorizePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/mcp/authorize" });
  const requestId = search.request_id ?? "";
  const request = useMcpAuthorizationRequest(requestId);
  const decision = useMcpAuthorizationDecision();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  if (!requestId || request.isError) {
    return (
      <AuthLayout
        title="Authorization failed"
        subtitle="This authorization request is invalid or has expired."
      >
        <p className="text-sm text-muted-foreground">
          Return to your MCP client and start the connection again.
        </p>
      </AuthLayout>
    );
  }

  if (request.isLoading || isSessionPending) {
    return (
      <AuthLayout title="Authorize MCP client" subtitle="Loading request…">
        <p className="text-sm text-muted-foreground">
          Checking the authorization request.
        </p>
      </AuthLayout>
    );
  }

  if (!session?.user) {
    const redirectTarget = `/mcp/authorize?request_id=${encodeURIComponent(requestId)}`;
    return (
      <AuthLayout
        title="Sign in to continue"
        subtitle="Sign in before approving this MCP client."
      >
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            void navigate({
              to: "/auth/sign-in",
              search: { redirect: redirectTarget },
            })
          }
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  const submitDecision = (approved: boolean) => {
    decision.mutate(
      { requestId, approved },
      {
        onSuccess: (redirect) => window.location.assign(redirect),
      },
    );
  };

  return (
    <AuthLayout
      title="Authorize MCP client"
      subtitle="Review this request before granting access to your Kaneo account."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This client will be able to act as you and access your workspaces.
          Only continue if you initiated this connection.
        </p>
        <div className="space-y-3 rounded-md border bg-muted/40 p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Client name (self-reported)
            </p>
            <p className="mt-1 text-sm">
              {request.data?.clientName ?? "MCP client"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Redirect URI
            </p>
            <p className="mt-1 break-all font-mono text-xs">
              {request.data?.redirectUri}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            className="flex-1"
            loading={decision.isPending && decision.variables?.approved}
            disabled={decision.isPending}
            onClick={() => submitDecision(true)}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={decision.isPending && !decision.variables?.approved}
            disabled={decision.isPending}
            onClick={() => submitDecision(false)}
          >
            Deny
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
