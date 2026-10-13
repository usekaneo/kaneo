import useGetProjects from "@/hooks/queries/project/use-get-projects";

export function useProjectSlugs(workspaceId: string) {
  const { data: projects = [] } = useGetProjects({ workspaceId });
  return (projectId: string, number: number | null | undefined) => {
    const slug = projects.find((project) => project.id === projectId)?.slug;
    return slug && number != null ? `${slug}-${number}` : null;
  };
}
