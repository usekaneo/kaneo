import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProfileSetupFlow } from "@/components/profile-setup/profile-setup-flow";

export const Route = createFileRoute("/_layout/_authenticated/profile-setup")({
  component: ProfileSetupFlow,
  beforeLoad: async ({ context }) => {
    const user = context.user;

    if (user?.name) {
      throw redirect({ to: "/dashboard" });
    }
  },
});
