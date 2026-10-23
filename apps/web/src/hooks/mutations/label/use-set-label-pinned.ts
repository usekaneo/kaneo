import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PinnedLabel } from "@/fetchers/label/get-pinned-labels";
import setLabelPinned from "@/fetchers/label/set-label-pinned";
import { PINNED_LABELS_KEY } from "@/hooks/queries/label/use-get-pinned-labels";

type Variables = { label: PinnedLabel; pinned: boolean };

function useSetLabelPinned() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ label, pinned }: Variables) =>
      setLabelPinned({ id: label.id, pinned }),
    onMutate: async ({ label, pinned }: Variables) => {
      await queryClient.cancelQueries({ queryKey: PINNED_LABELS_KEY });
      const previous =
        queryClient.getQueryData<PinnedLabel[]>(PINNED_LABELS_KEY);
      queryClient.setQueryData<PinnedLabel[]>(PINNED_LABELS_KEY, (pins = []) =>
        pinned
          ? pins.some((pin) => pin.id === label.id)
            ? pins
            : [...pins, label]
          : pins.filter((pin) => pin.id !== label.id),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(PINNED_LABELS_KEY, context?.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PINNED_LABELS_KEY }),
  });
}

export default useSetLabelPinned;
