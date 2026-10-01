import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import getLabelsByTask from "@/fetchers/label/get-labels-by-task";
import { localeCompareSort } from "@/lib/format";

function useGetLabelsByTask(taskId: string) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;

  return useQuery({
    queryKey: ["labels", taskId],
    queryFn: () => getLabelsByTask({ taskId }),
    select: (labels) =>
      [...labels].sort((a, b) => localeCompareSort(a.name, b.name, locale)),
    refetchOnMount: true,
  });
}

export default useGetLabelsByTask;
