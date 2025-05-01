import updateLabel from "@/fetchers/label/update-label";
import { useMutation } from "@tanstack/react-query";

function useUpdateLabel() {
  return useMutation({
    mutationFn: updateLabel,
  });
}

export default useUpdateLabel;
