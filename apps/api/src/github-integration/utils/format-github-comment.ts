export function formatGitHubComment({
  number,
  priority,
  status,
}: {
  number: number;
  priority: string;
  status: string;
}) {
  return `🎯 **Task created in Kaneo**

A new task has been created from this issue:
- **Task #${number}**
- **Priority:** ${priority}
- **Status:** ${status}

*This issue will be automatically synchronized with your Kaneo project.*`;
}
