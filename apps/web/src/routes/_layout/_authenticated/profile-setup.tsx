import { ProfileSetupFlow } from "@/components/profile-setup/profile-setup-flow";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/profile-setup")({
  component: ProfileSetupFlow,
});
