import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function OidcSignInButton() {
  const handleOidcSignIn = async () => {
    try {
      const { error } = await authClient.signIn.oauth2({
        providerId: "oidc",
        callbackURL: "/dashboard",
      });

      if (error) {
        toast.error(error.message || "Failed to sign in with OIDC");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign in");
    }
  };

  return (
    <Button onClick={handleOidcSignIn} variant="outline" className="w-full">
      Sign in with OIDC
    </Button>
  );
}
