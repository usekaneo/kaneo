/**
 * Central template utilities for Gitea issue body generation
 * Handles both HTML comment metadata (invisible) and markdown formats
 *
 * @example Basic usage
 * ```typescript
 * const metadata = { taskId: "task_123", title: "Fix bug", action: "created" };
 * const body = generateIssueBody(metadata);
 * console.log(body); // "Fix bug\n\n<!-- Kaneo Task: task_123 -->"
 * ```
 *
 * @example Advanced template with options
 * ```typescript
 * const options = { useBidirectionalDescriptions: true };
 * const body = generateIssueBody(metadata, "Custom description", options);
 * ```
 */

/**
 * Metadata structure for Kaneo tasks used in Gitea issue templates
 *
 * @example Task metadata creation
 * ```typescript
 * const taskMetadata: TaskMetadata = {
 *   taskId: "task_abc123",
 *   title: "Implement user authentication",
 *   description: "Add JWT-based authentication system",
 *   status: "in-progress",
 *   priority: "high",
 *   userEmail: "developer@example.com",
 *   action: "created"
 * };
 * ```
 */
export interface TaskMetadata {
  /** Unique identifier for the task */
  taskId: string;
  /** Human-readable task title */
  title: string;
  /** Optional detailed description of the task */
  description: string | null;
  /** Current task status (to-do, in-progress, done, etc.) */
  status: string;
  /** Priority level (low, medium, high, critical) */
  priority: string | null;
  /** Email of assigned user, if any */
  userEmail: string | null;
  /** Action being performed (created, updated) */
  action: "created" | "updated";
}

/**
 * Configuration options for template generation
 * Controls behavior of issue body creation and parsing
 *
 * @example Enable bidirectional sync
 * ```typescript
 * const options: TemplateOptions = {
 *   useBidirectionalDescriptions: true
 * };
 * const body = generateIssueBody(metadata, description, options);
 * ```
 */
export interface TemplateOptions {
  /** Whether to allow description updates from Gitea back to Kaneo */
  useBidirectionalDescriptions?: boolean;
}

/**
 * Status mapping for human-readable display names
 * Maps internal status codes to user-friendly display names
 *
 * @example Usage in UI components
 * ```typescript
 * const displayName = STATUS_DISPLAY_NAMES[task.status] || task.status;
 * console.log(`Status: ${displayName}`); // "Status: In Progress"
 * ```
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
 * Generate human-readable status display name with fallback
 * @param status - Raw status value from database
 * @returns Human-readable status display name or original status if no mapping exists
 *
 * @example Status display
 * ```typescript
 * const display = getStatusDisplayName("in-progress");
 * console.log(display); // "In Progress"
 *
 * const unknown = getStatusDisplayName("custom-status");
 * console.log(unknown); // "custom-status" (fallback to original)
 * ```
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
