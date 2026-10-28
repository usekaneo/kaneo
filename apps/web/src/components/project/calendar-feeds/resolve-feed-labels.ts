type LabelSource = {
  id: string;
  name: string;
  color: string;
};

export type FeedLabel = {
  id: string;
  name: string | null;
  color: string;
};

export function resolveFeedLabels(
  labelIds: string[],
  labels: LabelSource[],
): FeedLabel[] {
  return labelIds.map((id) => {
    const label = labels.find((candidate) => candidate.id === id);
    return label
      ? { id, name: label.name, color: label.color }
      : { id, name: null, color: "" };
  });
}
