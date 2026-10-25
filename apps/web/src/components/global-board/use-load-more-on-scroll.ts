import { useEffect, useState } from "react";

type PagedQuery = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  fetchNextPage: () => unknown;
};

/**
 * Fetches the next page while the returned sentinel is near the bottom of its
 * parent, which must be the scroll container. A sentinel that stays visible after a page lands
 * keeps loading, so short pages still fill a tall lane.
 */
export function useLoadMoreOnScroll(query: PagedQuery) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [nearEnd, setNearEnd] = useState(false);

  useEffect(() => {
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearEnd(entry?.isIntersecting ?? false),
      { root: sentinel.parentElement, rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    // After a failed page, wait for the "Load more" button instead of retrying.
    if (nearEnd && hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage();
    }
  }, [nearEnd, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return setSentinel;
}
