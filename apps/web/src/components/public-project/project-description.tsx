import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getPublicProjectDescription } from "@/fetchers/task/get-description-pages";

export function PublicProjectDescription({
  project,
}: {
  project: {
    id: string;
    description: string | null;
    descriptionDeferred?: boolean;
  };
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["public-project-description", project.id],
    queryFn: ({ signal }) => getPublicProjectDescription(project.id, signal),
    enabled: !!project.descriptionDeferred,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  if (project.descriptionDeferred && query.isLoading)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("tasks:descriptionLoading")}
      </p>
    );
  if (project.descriptionDeferred && query.isError)
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        {t("tasks:descriptionLoadError")}{" "}
        <button
          type="button"
          className="underline"
          onClick={() => void query.refetch()}
        >
          {t("tasks:descriptionRetry")}
        </button>
      </p>
    );
  const text = project.descriptionDeferred ? query.data : project.description;
  return text ? (
    <p className="text-xs text-muted-foreground truncate">{text}</p>
  ) : null;
}
