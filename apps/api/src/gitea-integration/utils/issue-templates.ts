/**
 * Central template utilities for Gitea issue body generation
 * Handles both HTML comment metadata (invisible) and markdown formats
 */

/**
 * Metadata structure for Kaneo tasks used in Gitea issue templates
 */
export interface TaskMetadata {
  taskId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  userEmail: string | null;
  action: "created" | "updated";
}

/**
 * Configuration options for template generation
 */
export interface TemplateOptions {
  useBidirectionalDescriptions?: boolean;
}

/**
 * Status mapping for human-readable display names
 */
export const STATUS_DISPLAY_NAMES: Record<string, string> = {
  "to-do": "To Do",
  "in-progress": "In Progress",
  "in-review": "In Review",
  done: "Done",
  archived: "Archived",
  planned: "Planned",
} as const;

/**
 * Generate status display name for better readability
 * @param status - Raw status value from database
 * @returns Human-readable status display name
 */
function getStatusDisplayName(status: string): string {
  return STATUS_DISPLAY_NAMES[status] || status;
}

/**
 * Generate Gitea issue body with metadata
 * @param metadata Task information
 * @param options Template options
 * @returns Formatted issue body
 */
export function generateGiteaIssueBody(
  metadata: TaskMetadata,
  options: TemplateOptions = {},
): string {
  const { useBidirectionalDescriptions = true } = options;
  const statusDisplay = getStatusDisplayName(metadata.status);
  const timestamp = new Date().toISOString();
  const actionText = metadata.action === "created" ? "Created" : "Updated";

  if (useBidirectionalDescriptions) {
    // Option 1: Use HTML comments for invisible metadata
    return `${metadata.description || "No description provided"}

<!-- KANEO_METADATA
Task ID: ${metadata.taskId}
Status: ${statusDisplay}
Priority: ${metadata.priority || "Not set"}
Assigned to: ${metadata.userEmail || "Unassigned"}
${actionText} at: ${timestamp}
KANEO_METADATA -->`;
  }

  // Option 2: Use visible markdown format
  return `**Task ${metadata.action} in Kaneo**

**Description:**
${metadata.description || "No description provided"}

**Details:**
- Task ID: ${metadata.taskId}
- Status: ${statusDisplay}
- Priority: ${metadata.priority || "Not set"}
- Assigned to: ${metadata.userEmail || "Unassigned"}

---
*This issue was automatically ${metadata.action} from Kaneo task management system.*`;
}

/**
 * Clean issue body from all Kaneo metadata formats
 * Removes both HTML comments and legacy markdown formats
 */
export function cleanKaneoMetadata(issueBody: string): string {
  return (
    issueBody
      // Remove HTML comment metadata (new format)
      .replace(/<!-- KANEO_METADATA[\s\S]*?KANEO_METADATA -->/g, "")
      // Remove legacy markdown metadata formats
      .replace(
        /---\s*Task id on kaneo: [^\n]+\s*Status: [^\n]+\s*Priority: [^\n]+\s*Assignee: [^\n]+\s*(Created|Updated) at: [^\n]+\s*$/g,
        "",
      )
      // Remove legacy template formats with Task Status
      .replace(
        /---\s*\*\*Task Status:\*\* [^\n]+\s*\*\*Details:\*\*[\s\S]*?---\s*\*This issue was automatically (created|updated) from Kaneo task management system\.\*\s*$/g,
        "",
      )
      // Remove legacy template formats with visible markdown
      .replace(
        /\*\*Task (created|updated) in Kaneo\*\*[\s\S]*?---\s*\*This issue was automatically (created|updated) from Kaneo task management system\.\*\s*$/g,
        "",
      )
      // Remove standalone status lines
      .replace(/---\s*\*\*Task Status:\*\* [^\n]+/g, "")
      .replace(/---\s*\*\*Kaneo Status:\*\* [^\n]+/g, "")
      .replace(/\*\*Task Status:\*\* [^\n]+/g, "")
      .replace(/\*\*Kaneo Status:\*\* [^\n]+/g, "")
      // Clean up legacy link patterns
      .replace(/\*Linked to Gitea issue: [^\*]+\*/g, "")
      .replace(/\*Created from Gitea issue: [^\*]+\*/g, "")
      .trim()
  );
}

/**
 * Parse Kaneo metadata from Gitea issue body
 * Supports both HTML comments and legacy formats
 */
export function parseKaneoTaskId(issueBody: string): string | null {
  // Try HTML comment format first
  const htmlCommentMatch = issueBody.match(
    /<!-- KANEO_METADATA[\s\S]*?Task ID:\s*([^\n\r]+)[\s\S]*?KANEO_METADATA -->/,
  );
  if (htmlCommentMatch) {
    return htmlCommentMatch[1]?.trim() || null;
  }

  // Fallback to legacy format
  const legacyMatch = issueBody.match(/Task id on kaneo:\s*([^\n\r]+)/);
  return legacyMatch?.[1]?.trim() || null;
}
