import { useLayoutEffect, useRef, useState } from "react";
import type { WidgetTab } from "./types.js";

export interface WidgetRoute {
  tab: WidgetTab;
  detail?: string;
  composer?: "message" | "feedback";
  articleId?: string;
  activity?: boolean;
}
export function useWidgetNavigation(initialTab: WidgetTab) {
  const [route, setRoute] = useState<WidgetRoute>({ tab: initialTab });
  const history = useRef<WidgetRoute[]>([]);
  const content = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const key = JSON.stringify(route);
  const currentKey = useRef(key);
  currentKey.current = key;
  const save = () => {
    positions.current.set(key, content.current?.scrollTop ?? 0);
    content.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (content.current)
      content.current.scrollTop = positions.current.get(key) ?? 0;
  }, [key]);
  return {
    resetScroll() {
      if (content.current) content.current.scrollTop = 0;
    },
    route,
    key,
    currentKey,
    content,
    canGoBack: history.current.length > 0,
    go(next: WidgetRoute) {
      save();
      history.current.push(route);
      setRoute(next);
    },
    navigate(tab: WidgetTab) {
      save();
      history.current = [];
      setRoute({ tab });
    },
    back() {
      save();
      setRoute(history.current.pop() ?? { tab: route.tab });
    },
  };
}
