import type { QueryClient } from "@tanstack/react-query";
import { configQueryOptions } from "@/hooks/queries/config/use-get-config";
import { currentUserQueryOptions } from "@/hooks/queries/user/use-managed-profile-fields";

// Offline fails at once and retries stay short, so the page opens quickly.
const LOADER_FETCH_OPTIONS = {
  networkMode: "always",
  retryDelay: 300,
} as const;

export async function prefetchManagedProfileFields(
  queryClient: QueryClient,
  userId: string | undefined,
) {
  try {
    const config = await queryClient.ensureQueryData({
      ...configQueryOptions(),
      ...LOADER_FETCH_OPTIONS,
    });
    if (!userId || config.customOAuthManagedProfileFields.length === 0) return;
    await queryClient.ensureQueryData({
      ...currentUserQueryOptions(userId),
      ...LOADER_FETCH_OPTIONS,
    });
  } catch {
    // The page renders anyway, and its own queries retry when it mounts.
  }
}
