import createWorkspace from '@/fetchers/workspace/create-workspace';
import { useMutation } from '@tanstack/react-query';

function useCreateWorkspace({ name }: { name: string }) {
  return useMutation({
    mutationFn: () => createWorkspace({ name }),
  });
}

export default useCreateWorkspace;
