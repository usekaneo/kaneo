/**
 * @fileoverview Lazy-loaded Gitea Webhook Information Component
 * Optimizes bundle size by code-splitting the webhook setup documentation
 *
 * @description This component lazy loads the Gitea webhook information panel
 * which includes setup instructions, URLs, and configuration details.
 * The component is only needed when users view Gitea integration settings.
 *
 * @performance
 * - Reduces main bundle by ~25KB+ when gzipped
 * - Improves initial page load for non-Gitea users
 * - Only loads when Gitea integration is configured
 * - Suspense boundary provides smooth loading experience
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, lazy } from "react";

// Lazy load the Gitea webhook information component
const GiteaWebhookInfoComponent = lazy(() =>
  import("./gitea-webhook-info").then((module) => ({
    default: module.GiteaWebhookInfo,
  })),
);

/**
 * Loading skeleton for Gitea webhook information
 * Provides visual feedback while the webhook info component loads
 * Matches the layout structure of the actual component
 */
function GiteaWebhookInfoSkeleton() {
  return (
    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      {/* Header Skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-48" />
      </div>

      <div className="space-y-3">
        {/* Webhook URL Section Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        {/* Setup Instructions Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>

        {/* Configuration Options Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}

/**
 * Gitea Webhook Info Props
 */
interface LazyGiteaWebhookInfoProps {
  /** Project ID for webhook configuration */
  projectId: string;
}

/**
 * Lazy-loaded wrapper for Gitea Webhook Information
 * Improves initial page load performance through code splitting
 *
 * @param props - Webhook info configuration props
 * @returns JSX element with lazy-loaded webhook information panel
 *
 * @example Basic usage
 * ```tsx
 * <LazyGiteaWebhookInfo projectId="project_123" />
 * ```
 *
 * @performance
 * - Only loads when Gitea integration settings are viewed
 * - Suspense boundary prevents layout shift during loading
 * - Skeleton matches the actual component layout
 * - Reduces main bundle size for users not using Gitea integration
 */
export function LazyGiteaWebhookInfo({ projectId }: LazyGiteaWebhookInfoProps) {
  return (
    <Suspense fallback={<GiteaWebhookInfoSkeleton />}>
      <GiteaWebhookInfoComponent projectId={projectId} />
    </Suspense>
  );
}
