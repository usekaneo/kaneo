import type { AnyRouter } from "@tanstack/react-router";

type LazyComponent = { preload?: () => Promise<unknown> };

export function preloadRouteComponents(router: AnyRouter, pathname: string) {
  const routes = router.routesById as Record<
    string,
    { options: { component?: LazyComponent } }
  >;
  try {
    for (const match of router.matchRoutes(pathname, {})) {
      void routes[match.routeId]?.options.component
        ?.preload?.()
        .catch(() => undefined);
    }
  } catch {
    return;
  }
}
