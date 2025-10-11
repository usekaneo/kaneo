import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/auth/check-email")({
  component: CheckEmail,
  validateSearch: (search: Record<string, unknown>) => ({
    email: search.email as string | undefined,
  }),
});

function CheckEmail() {
  const { email } = useSearch({ from: "/auth/check-email" });

  return (
    <>
      <PageTitle title="Check Your Email" />
      <AuthLayout title="Check your email">
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We've sent you a temporary login link. Please check your inbox at{" "}
              <span className="text-foreground font-medium">
                {email || "your email address"}
              </span>
              .
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="ghost"
              asChild
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to="/auth/sign-in">Back to login</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
