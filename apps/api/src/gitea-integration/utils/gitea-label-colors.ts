export const giteaLabelColors = {
  "priority:low": "0EA5E9", // Blue
  "priority:medium": "EAB308", // Yellow
  "priority:high": "F97316", // Orange
  "priority:urgent": "EF4444", // Red

  "status:to-do": "207de5", // Gray
  "status:in-progress": "fbca04", // Blue
  "status:in-review": "8b5cf6", // Purple
  "status:done": "009800", // Green
  "status:planned": "A78BFA", // Light Purple
  "status:archived": "6B7280", // Gray

  kaneo: "6366F1", // Indigo
};

export function getLabelColor(labelName: string): string {
  return (
    giteaLabelColors[labelName as keyof typeof giteaLabelColors] || "6B7280"
  );
}
