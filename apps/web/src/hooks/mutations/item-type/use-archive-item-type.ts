import { useMutation, useQueryClient } from "@tanstack/react-query";
import archiveItemType from "@/fetchers/item-type/archive-item-type";

function useArchiveItemType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveItemType,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["item-types"] }),
  });
}

export default useArchiveItemType;
