import { useMutation, useQueryClient } from "@tanstack/react-query";
import updatePerson, {
  type UpdatePersonRequest,
} from "@/fetchers/people/update-person";

function useUpdatePerson(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: UpdatePersonRequest) => updatePerson(userId, json),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["people", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["departments", workspaceId] });
    },
  });
}

export default useUpdatePerson;
