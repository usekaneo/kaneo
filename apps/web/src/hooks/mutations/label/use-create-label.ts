import { useMutation } from "@tanstack/react-query";
import createLabel from "@/fetchers/label/create-label";

function useCreateLabel() {
  return useMutation({
    mutationFn: createLabel,
  });
}

export default useCreateLabel;
