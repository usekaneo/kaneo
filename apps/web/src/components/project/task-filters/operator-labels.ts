type Translate = (key: string) => string;

export function operatorLabels(
  kind: "is" | "include",
  count: number,
  t: Translate,
) {
  if (kind === "include") {
    return {
      positive:
        count > 1
          ? t("tasks:boardFilters.operators.includeAnyOf")
          : t("tasks:boardFilters.operators.include"),
      negative: t("tasks:boardFilters.operators.exclude"),
    };
  }
  return count > 1
    ? {
        positive: t("tasks:boardFilters.operators.isAnyOf"),
        negative: t("tasks:boardFilters.operators.isNoneOf"),
      }
    : {
        positive: t("tasks:boardFilters.operators.is"),
        negative: t("tasks:boardFilters.operators.isNot"),
      };
}
