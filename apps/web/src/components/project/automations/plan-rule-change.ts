type Rule = {
  id: string;
  integrationType: string;
  eventType: string;
  columnId: string;
};

type RuleChange =
  | { type: "upsert"; columnId: string }
  | { type: "delete"; id: string }
  | { type: "none" };

export function planRuleChange(
  rules: Rule[],
  integrationType: string,
  eventType: string,
  columnId: string | null,
): RuleChange {
  const rule = rules.find(
    (candidate) =>
      candidate.integrationType === integrationType &&
      candidate.eventType === eventType,
  );

  if (columnId) {
    return rule?.columnId === columnId
      ? { type: "none" }
      : { type: "upsert", columnId };
  }

  return rule ? { type: "delete", id: rule.id } : { type: "none" };
}
