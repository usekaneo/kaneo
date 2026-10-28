import { useMemo, useRef, useState } from "react";
import {
  applyOrder,
  moveItem,
} from "@/components/project/sortable/apply-order";

export function useSortableOrder<T extends { id: string }>(
  items: T[],
  save: (items: T[]) => Promise<unknown>,
) {
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const latestMove = useRef(0);
  const ordered = useMemo(
    () => applyOrder(items, pendingIds),
    [items, pendingIds],
  );

  const move = async (from: number, to: number) => {
    const next = moveItem(ordered, from, to);
    const token = ++latestMove.current;
    setPendingIds(next.map((item) => item.id));

    try {
      await save(next);
    } finally {
      if (latestMove.current === token) setPendingIds(null);
    }
  };

  return { ordered, move };
}
