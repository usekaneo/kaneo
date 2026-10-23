import { useQuery } from "@tanstack/react-query";
import getPinnedLabels from "@/fetchers/label/get-pinned-labels";

// Under "labels" so renaming or deleting a label refreshes the pins too.
export const PINNED_LABELS_KEY = ["labels", "pinned"] as const;

function useGetPinnedLabels() {
  return useQuery({
    queryKey: PINNED_LABELS_KEY,
    queryFn: getPinnedLabels,
  });
}

export default useGetPinnedLabels;
