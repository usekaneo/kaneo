import createProject from "@/fetchers/project/create-project";
import { useMutation } from "@tanstack/react-query";

export function useCreateProject({
  name,
  slug,
  icon,
}: { name: string; slug: string; icon: string }) {
  return useMutation({
    mutationFn: () => createProject({ name, slug, icon }),
  });
}
