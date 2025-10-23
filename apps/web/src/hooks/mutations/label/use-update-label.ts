import { useMutation } from "@tanstack/react-query";
import updateLabel from "@/fetchers/label/update-label";

function useUpdateLabel() {
  return useMutation({
    mutationFn: updateLabel,
  });
}

export default useUpdateLabel;
