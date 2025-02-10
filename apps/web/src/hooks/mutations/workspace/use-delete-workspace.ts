import deleteWorkspace from '@/fetchers/workspace/delete-workspace';
import { useMutation } from '@tanstack/react-query';

function useDeleteWorkspace({ id }: { id: string }) {
  return useMutation({
    mutationFn: () =>
      deleteWorkspace({
        id,
      }),
  });
}

export default useDeleteWorkspace;
