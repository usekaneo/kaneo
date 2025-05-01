import createLabel from "@/fetchers/label/create-label";
import { useMutation } from "@tanstack/react-query";

function useCreateLabel() {
  return useMutation({
    mutationFn: createLabel,
  });
}

export default useCreateLabel;
