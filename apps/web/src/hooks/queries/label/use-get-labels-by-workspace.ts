import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import getLabelsByWorkspace from "@/fetchers/label/get-label-by-workspace";
import { localeCompareSort } from "@/lib/format";

function useGetLabelsByWorkspace(workspaceId: string) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;

  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsByWorkspace({ workspaceId }),
    select: (labels) =>
      [...labels].sort((a, b) => localeCompareSort(a.name, b.name, locale)),
  });
}

export default useGetLabelsByWorkspace;
