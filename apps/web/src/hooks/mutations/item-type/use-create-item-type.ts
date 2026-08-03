import { useMutation, useQueryClient } from "@tanstack/react-query";
import createItemType from "@/fetchers/item-type/create-item-type";

function useCreateItemType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItemType,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["item-types"] }),
  });
}

export default useCreateItemType;
