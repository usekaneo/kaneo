import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthToggle } from "@/components/auth/toggle";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getConfig } from "@/fetchers/config/get-config";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { authClient } from "@/lib/auth-client";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  validateSearch: signUpSearchSchema,
  beforeLoad: async ({ search }) => {
    const config = await getConfig();

    const hasInvitation = !!search.invitationId;
    if (config.disableRegistration && !hasInvitation) {
      throw redirect({ to: "/auth/sign-in", replace: true });
    }
  },
});

function SignUp() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/sign-up" });
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const { data: config } = useGetConfig();

  const invitationId = search.invitationId;
  const prefillEmail = search.email;

  const handleGuestAccess = async () => {
    setIsGuestLoading(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success("Signed in as guest");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign in as guest",
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <>
      <PageTitle title="Create Account" />
      <AuthLayout
        title="Create account"
        subtitle={
          invitationId
            ? "Create an account to accept your invitation"
            : "Get started with your workspace"
        }
      >
        <div className="space-y-4 mt-6">
          {invitationId && (
            <Alert>
              <AlertDescription>
                After creating your account, you'll be able to accept your
                workspace invitation.
              </AlertDescription>
            </Alert>
          )}

          {config?.hasGuestAccess && !invitationId && (
            <>
              <Button
                variant="outline"
                onClick={handleGuestAccess}
                disabled={isGuestLoading}
                className="w-full mb-0"
                size="sm"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                {isGuestLoading ? "Signing in..." : "Continue as guest"}
              </Button>
              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  or
                </span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </>
          )}
          <SignUpForm invitationId={invitationId} defaultEmail={prefillEmail} />
          <AuthToggle
            message="Already have an account?"
            linkText="Sign in"
            linkTo="/auth/sign-in"
          />
        </div>
      </AuthLayout>
    </>
  );
}
