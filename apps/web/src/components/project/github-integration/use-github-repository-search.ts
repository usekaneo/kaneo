import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { collectRepositories } from "@/components/project/github-integration/collect-repositories";
import listRepositories, {
  FIRST_REPOSITORY_PAGE,
  type RepositoryPage,
} from "@/fetchers/github-integration/list-repositories";
import { authClient } from "@/lib/auth-client";

export const AUTO_FETCH_TARGET = 20;
export const AUTO_FETCH_LIMIT = 5;

type AutoFetchState = {
  scope: string;
  count: number;
  requestedAt: number;
};

export function useGithubRepositorySearch({
  projectId,
  search,
  enabled,
}: {
  projectId: string;
  search: string;
  enabled: boolean;
}) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const query = useInfiniteQuery({
    queryKey: ["github-repositories", projectId, userId, search],
    queryFn: ({ pageParam }) =>
      listRepositories(projectId, pageParam, search || undefined),
    initialPageParam: FIRST_REPOSITORY_PAGE as RepositoryPage,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    enabled: enabled && Boolean(userId),
  });
  const repositories = collectRepositories(query.data?.pages);
  const pageCount = query.data?.pages.length ?? 0;
  const scope = `${userId ?? ""}:${search}`;
  const [autoFetch, setAutoFetch] = useState<AutoFetchState>({
    scope,
    count: 0,
    requestedAt: 0,
  });
  const current =
    autoFetch.scope === scope ? autoFetch : { scope, count: 0, requestedAt: 0 };
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  const wantsMore =
    enabled &&
    search !== "" &&
    hasNextPage &&
    !isError &&
    repositories.length < AUTO_FETCH_TARGET &&
    current.count < AUTO_FETCH_LIMIT;
  const shouldAutoFetch =
    wantsMore && !isFetching && pageCount > current.requestedAt;

  useEffect(() => {
    if (!shouldAutoFetch) return;
    setAutoFetch({ scope, count: current.count + 1, requestedAt: pageCount });
    void fetchNextPage({ cancelRefetch: false });
  }, [shouldAutoFetch, scope, current.count, pageCount, fetchNextPage]);

  return {
    ...query,
    repositories,
    fetchingMore: query.isFetchingNextPage || wantsMore,
  };
}
