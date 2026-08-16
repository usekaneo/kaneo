import * as Sentry from "@sentry/react";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

function captureCacheError(error: unknown, context: "query" | "mutation") {
  if (!(error instanceof Error)) return;
  // These are the noisy network-layer errors TanStack raises before any
  // fetcher-level error message exists; we still want them captured, but
  // without drowning the queue in offline-tab reloads.
  if (
    error.message.includes("Failed to fetch") ||
    error.message.includes("NetworkError") ||
    error.message.includes("Load failed")
  ) {
    Sentry.captureException(error, { tags: { area: `network.${context}` } });
    return;
  }
  Sentry.captureException(error, { tags: { area: `api.${context}` } });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => captureCacheError(error, "query"),
  }),
  mutationCache: new MutationCache({
    onError: (error) => captureCacheError(error, "mutation"),
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (error instanceof Error) {
          if (
            error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError") ||
            error.message.includes("CORS")
          ) {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;
