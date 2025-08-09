/**
 * Lazy-loaded Gitea Integration Settings Component
 * This helps reduce initial bundle size by code-splitting the complex settings form
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, lazy } from "react";

// Lazy load the heavy Gitea integration component
const GiteaIntegrationSettingsComponent = lazy(() =>
  import("./gitea-integration-settings").then((module) => ({
    default: module.GiteaIntegrationSettings,
  })),
);

/**
 * Loading skeleton for Gitea integration settings
 * Provides visual feedback while the component loads
 */
function GiteaIntegrationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Lazy-loaded wrapper for Gitea Integration Settings
 * Improves initial page load performance through code splitting
 */
export function LazyGiteaIntegrationSettings({
  projectId,
}: { projectId: string }) {
  return (
    <Suspense fallback={<GiteaIntegrationSkeleton />}>
      <GiteaIntegrationSettingsComponent projectId={projectId} />
    </Suspense>
  );
}
