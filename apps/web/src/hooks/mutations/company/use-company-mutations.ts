import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createDepartment,
  deleteDepartment,
} from "@/fetchers/company/departments";
import updateCompanySettings, {
  type UpdateCompanySettingsRequest,
} from "@/fetchers/company/update-company-settings";

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: UpdateCompanySettingsRequest) =>
      updateCompanySettings(json),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["company-settings", workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["people", workspaceId] });
    },
  });
}

export function useCreateDepartment(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createDepartment(workspaceId, name),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["departments", workspaceId] }),
  });
}

export function useDeleteDepartment(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDepartment(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["people", workspaceId] });
    },
  });
}
