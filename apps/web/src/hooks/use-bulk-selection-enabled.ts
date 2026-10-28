import { useEffect } from "react";
import useBulkSelectionStore from "@/store/bulk-selection";

/** Turns bulk selection off while a view that cannot act on it is mounted. */
export function useBulkSelectionEnabled(enabled: boolean) {
  const setSelectionEnabled = useBulkSelectionStore(
    (state) => state.setSelectionEnabled,
  );
  useEffect(() => {
    setSelectionEnabled(enabled);
    return () => setSelectionEnabled(true);
  }, [enabled, setSelectionEnabled]);
}
