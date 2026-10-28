import { useEffect, useRef } from "react";
import { type BulkPicker, useBulkRequestStore } from "./bulk-request-store";

export function useBulkPickerRequest(
  picker: BulkPicker | undefined,
  setOpen: (open: boolean) => void,
) {
  const request = useBulkRequestStore((state) => state.request);
  const openedByRequest = useRef(false);

  useEffect(() => {
    if (!picker || request !== picker) return;
    useBulkRequestStore.getState().consume();
    openedByRequest.current = true;
    setOpen(true);
  }, [picker, request, setOpen]);

  return {
    openedByRequest: () => openedByRequest.current,
    openedManually: () => {
      openedByRequest.current = false;
    },
  };
}
