// Keep the interval registered so it resumes after the tab becomes visible
// again; background refetching is disabled separately in the query options.
export function getVisibleTabRefetchInterval(intervalMs: number) {
  return intervalMs;
}

export const visibleTabRefetchDefaults = {
  refetchIntervalInBackground: false,
} as const;
