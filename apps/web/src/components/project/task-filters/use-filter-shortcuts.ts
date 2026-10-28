import { useEffect, useRef } from "react";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import type { FilterSubject } from "./filter-subject";
import { trackFilterOrder } from "./track-filter-order";

export function useFilterShortcuts(
  subjects: FilterSubject[],
  clearFilters: () => void,
) {
  const order = useRef<string[]>([]);
  const activeIds = subjects
    .filter((subject) => subject.selected.length > 0)
    .map((subject) => subject.id);
  const activeKey = activeIds.join("\n");

  useEffect(() => {
    order.current = trackFilterOrder(
      order.current,
      activeKey ? activeKey.split("\n") : [],
    );
  }, [activeKey]);

  const enabled = { enabled: activeIds.length > 0 };
  useShortcut("clearAllFilters", clearFilters, enabled);
  useShortcut(
    "clearLastFilter",
    () => {
      const last = order.current.at(-1);
      subjects.find((subject) => subject.id === last)?.onClear();
    },
    enabled,
  );
}
