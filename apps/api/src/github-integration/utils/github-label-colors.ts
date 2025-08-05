export const githubLabelColors = {
  "priority:low": "0EA5E9", // Blue
  "priority:medium": "EAB308", // Yellow
  "priority:high": "F97316", // Orange
  "priority:urgent": "EF4444", // Red

  "status:to-do": "6B7280", // Gray
  "status:in-progress": "3B82F6", // Blue
  "status:done": "10B981", // Green
  "status:planned": "8B5CF6", // Purple
  "status:archived": "6B7280", // Gray

  kaneo: "6366F1", // Indigo
};

export function getLabelColor(labelName: string): string {
  return (
    githubLabelColors[labelName as keyof typeof githubLabelColors] || "6B7280"
  );
}
