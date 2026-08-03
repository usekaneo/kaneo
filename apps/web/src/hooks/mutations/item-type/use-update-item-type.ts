import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateItemType from "@/fetchers/item-type/update-item-type";

function useUpdateItemType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateItemType,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["item-types"] }),
  });
}

export default useUpdateItemType;
