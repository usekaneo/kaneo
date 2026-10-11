import { isWithinInterval } from "date-fns";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type DaySelection = { anchor: Date; current: Date };

/** Day cells expose their timestamp here so a drag can resolve the day under the pointer. */
const CALENDAR_DAY_ATTRIBUTE = "data-calendar-day";

function getDayAtPoint(x: number, y: number): Date | null {
  // Task bars sit above the day cells, so look through every layer at the point.
  for (const element of document.elementsFromPoint?.(x, y) ?? []) {
    const value = element.getAttribute(CALENDAR_DAY_ATTRIBUTE);
    if (value) return new Date(Number(value));
  }
  return null;
}

export function useDayRangeSelection(
  onSelect: ((from: Date, to: Date) => void) | undefined,
) {
  const [selection, setSelection] = useState<DaySelection | null>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const isSelecting = selection !== null;

  useEffect(() => {
    if (!isSelecting) return;

    const handleMove = (event: PointerEvent) => {
      const day = getDayAtPoint(event.clientX, event.clientY);
      if (!day) return;
      setSelection((previous) =>
        previous && previous.current.getTime() !== day.getTime()
          ? { ...previous, current: day }
          : previous,
      );
    };

    const handleUp = (event: PointerEvent) => {
      const current = selectionRef.current;
      setSelection(null);
      if (!current) return;
      const day =
        getDayAtPoint(event.clientX, event.clientY) ?? current.current;
      onSelectRef.current?.(current.anchor, day);
    };

    const handleCancel = () => setSelection(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [isSelecting]);

  const startSelection = useCallback((day: Date, event: ReactPointerEvent) => {
    if (!onSelectRef.current || event.button !== 0) return;
    setSelection({ anchor: day, current: day });
  }, []);

  const isDaySelected = useCallback(
    (day: Date) => {
      if (!selection) return false;
      const { anchor, current } = selection;
      return isWithinInterval(day, {
        start: anchor <= current ? anchor : current,
        end: anchor <= current ? current : anchor,
      });
    },
    [selection],
  );

  return { startSelection, isDaySelected };
}
