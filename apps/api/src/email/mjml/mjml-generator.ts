import mjml2html from "mjml";

export interface TaskAssignedEmailData {
  taskTitle: string;
  taskDescription?: string;
  assigneeName: string;
  projectName: string;
  taskUrl: string;
  dueDate?: Date;
  priority?: string;
}

export interface TaskStatusChangedEmailData {
  taskTitle: string;
  assigneeName: string;
  projectName: string;
  taskUrl: string;
  oldStatus: string;
  newStatus: string;
}

export interface TaskCommentAddedEmailData {
  taskTitle: string;
  taskUrl: string;
  assigneeName: string;
  commenterName: string;
  commentContent: string;
  projectName: string;
}

export interface TimeTrackingStartedEmailData {
  taskTitle: string;
  taskUrl: string;
  assigneeName: string;
  trackerName: string;
  projectName: string;
  startTime: Date;
  description?: string;
}

export interface TaskPriorityChangedEmailData {
  taskTitle: string;
  assigneeName: string;
  projectName: string;
  taskUrl: string;
  oldPriority: string;
  newPriority: string;
}

export interface WorkspaceCreatedEmailData {
  workspaceName: string;
  inviterName: string;
  inviteeName: string;
  workspaceUrl: string;
  role: string;
}

interface EmailContent {
  html: string;
  text: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateTextFallback(data: any, type: string): string {
  switch (type) {
    case "task-assigned":
      return `New Task Assigned

Hi ${data.assigneeName},

You have been assigned a new task:

Task: ${data.taskTitle}
Project: ${data.projectName}
${data.taskDescription ? `Description: ${data.taskDescription}` : ""}
${data.priority ? `Priority: ${data.priority}` : ""}
${data.dueDate ? `Due Date: ${formatDate(data.dueDate)}` : ""}

View task: ${data.taskUrl}

Best regards,
Kaneo Team`;

    case "task-status-changed":
      return `Task Status Updated

Hi ${data.assigneeName},

The status of your task has been updated:

Task: ${data.taskTitle}
Project: ${data.projectName}
Status changed from "${data.oldStatus}" to "${data.newStatus}"

View task: ${data.taskUrl}

Best regards,
Kaneo Team`;

    case "task-comment-added":
      return `New Comment Added

Hi ${data.assigneeName},

${data.commenterName} added a new comment to your task:

Task: ${data.taskTitle}
Project: ${data.projectName}
Comment: ${data.commentContent}

View task: ${data.taskUrl}

Best regards,
Kaneo Team`;

    case "time-tracking-started":
      return `Time Tracking Started

Hi ${data.assigneeName},

${data.trackerName} started tracking time on your task:

Task: ${data.taskTitle}
Project: ${data.projectName}
Started at: ${formatDate(data.startTime)}
${data.description ? `Description: ${data.description}` : ""}

View task: ${data.taskUrl}

Best regards,
Kaneo Team`;

    case "task-priority-changed":
      return `Task Priority Updated

Hi ${data.assigneeName},

The priority of your task has been updated:

Task: ${data.taskTitle}
Project: ${data.projectName}
Priority changed from "${data.oldPriority}" to "${data.newPriority}"

View task: ${data.taskUrl}

Best regards,
Kaneo Team`;

    case "workspace-created":
      return `Welcome to ${data.workspaceName}

Hi ${data.inviteeName},

${data.inviterName} has invited you to join the "${data.workspaceName}" workspace as ${data.role}.

Access your workspace: ${data.workspaceUrl}

Best regards,
Kaneo Team`;

    default:
      return "Kaneo Notification";
  }
}

const LOGO_URL =
  "https://camo.githubusercontent.com/df73909d5a5fa1b08d455d0ea938a5c3ab1474a9f06ecba59ed6427b23fb1860/68747470733a2f2f6173736574732e6b616e656f2e6170702f6c6f676f2d6d6f6e6f2d726f756e6465642e706e67";

interface DetailRow {
  label: string;
  value: string;
}

interface EmailLayoutOptions {
  title: string;
  preview: string;
  eyebrow: string;
  heroTitle: string;
  heroSubtitle?: string;
  bodyContent: string;
  action?: {
    label: string;
    url: string;
    secondaryText?: string;
  };
}

const labelCellStyle =
  "background:#F8FAFC;padding:12px 16px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4338CA;border-top-left-radius:12px;border-bottom-left-radius:12px;";
const valueCellStyle =
  "background:#F8FAFC;padding:12px 16px;font-size:14px;font-weight:500;color:#111827;border-top-right-radius:12px;border-bottom-right-radius:12px;";

const toSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const spacer = (height: number) => `<mj-spacer height="${height}px" />`;

const mergeSections = (sections: Array<string | undefined | false>): string =>
  sections.filter((section): section is string => Boolean(section)).join("\n");

const buildDetailTable = (rows: DetailRow[]): string => {
  if (!rows.length) {
    return "";
  }

  const detailRows = rows
    .map((row, index) => {
      const spacerRow =
        index === 0
          ? ""
          : '<tr><td colspan="2" style="height:8px;line-height:8px;font-size:0;"></td></tr>';

      return `${spacerRow}<tr>
          <td style="${labelCellStyle}">${row.label.toUpperCase()}</td>
          <td style="${valueCellStyle}">${row.value}</td>
        </tr>`;
    })
    .join("");

  return `
    <mj-table cellpadding="0" cellspacing="0" width="100%">
      ${detailRows}
    </mj-table>
  `;
};

const buildCallout = (title: string, content: string): string => `
  <mj-text padding="0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#F5F3FF;border-left:4px solid #6366F1;border-radius:12px;padding:16px 18px;">
          <div style="color:#4338CA;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:8px;">${title}</div>
          <div style="color:#1F2937;font-size:14px;line-height:22px;">${content}</div>
        </td>
      </tr>
    </table>
  </mj-text>
`;

const buildEmailLayout = ({
  title,
  preview,
  eyebrow,
  heroTitle,
  heroSubtitle,
  bodyContent,
  action,
}: EmailLayoutOptions): string => `
  <mjml>
    <mj-head>
      <mj-title>${title}</mj-title>
      <mj-preview>${preview}</mj-preview>
      <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      <mj-attributes>
        <mj-all font-family="Inter, system-ui, sans-serif" />
        <mj-text font-size="14px" color="#1F2937" line-height="22px" />
        <mj-button background-color="#6366F1" color="white" font-size="15px" font-weight="600" border-radius="999px" inner-padding="14px 24px" />
      </mj-attributes>
      <mj-style inline="inline">
        .card-shell { border-radius:24px !important; overflow:hidden; box-shadow:0 24px 60px rgba(99,102,241,0.18); }
        .hero-section { background:linear-gradient(135deg, #6366F1 0%, #4338CA 100%); }
        .hero-section table { width:100%; }
        .eyebrow-tag { display:inline-block; background:rgba(255,255,255,0.14); color:#FFFFFF; padding:6px 12px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; }
        .priority-high { background:#FEE2E2; color:#B91C1C; }
        .priority-medium { background:#FEF3C7; color:#92400E; }
        .priority-low { background:#DCFCE7; color:#047857; }
        .status-todo { background:#E2E8F0; color:#475569; }
        .status-in-progress { background:#DBEAFE; color:#1D4ED8; }
        .status-done { background:#DCFCE7; color:#047857; }
        .chip { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
      </mj-style>
    </mj-head>
    <mj-body background-color="#EEF2FF">
      <mj-section padding="32px 16px">
        <mj-column>
          <mj-wrapper css-class="card-shell" padding="0">
            <mj-section css-class="hero-section" padding="32px 32px 24px">
              <mj-column>
                <mj-table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="vertical-align: middle;">
                      <img src="${LOGO_URL}" alt="Kaneo" width="36" height="36" style="border-radius:12px; display:block;" />
                    </td>
                    <td style="vertical-align: middle; text-align:right;">
                      <span class="eyebrow-tag">${eyebrow}</span>
                    </td>
                  </tr>
                </mj-table>
                ${spacer(20)}
                <mj-text padding="0" font-size="24px" font-weight="600" color="#FFFFFF" line-height="32px">
                  ${heroTitle}
                </mj-text>
                ${
                  heroSubtitle
                    ? `<mj-text padding="12px 0 0 0" font-size="15px" color="rgba(255,255,255,0.85)" line-height="24px">${heroSubtitle}</mj-text>`
                    : ""
                }
              </mj-column>
            </mj-section>
            <mj-section background-color="#FFFFFF" padding="28px 32px 32px">
              <mj-column>
                ${bodyContent}
                ${
                  action
                    ? `${spacer(24)}
                <mj-button href="${action.url}" align="left">
                  ${action.label}
                </mj-button>
                ${
                  action.secondaryText
                    ? `<mj-text padding="12px 0 0 0" font-size="12px" color="#6B7280">${action.secondaryText}</mj-text>`
                    : ""
                }`
                    : ""
                }
              </mj-column>
            </mj-section>
          </mj-wrapper>
        </mj-column>
      </mj-section>
      <mj-section padding="0 16px 32px" text-align="center">
        <mj-column>
          <mj-text padding="0" font-size="12px" color="#6B7280" line-height="20px">
            This notification keeps your Kaneo projects moving. Manage your preferences anytime in Settings.
          </mj-text>
          <mj-text padding="8px 0 0 0" font-size="11px" color="#94A3B8">
            © 2025 Kaneo · Built for teams that execute.
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
`;

export function generateTaskAssignedEmail(
  data: TaskAssignedEmailData
): EmailContent {
  const detailRows: DetailRow[] = [
    { label: "Project", value: data.projectName },
    { label: "Assignee", value: data.assigneeName },
  ];

  if (data.priority) {
    detailRows.push({
      label: "Priority",
      value: `<span class="chip priority-${toSlug(data.priority)}">${
        data.priority
      }</span>`,
    });
  }

  if (data.dueDate) {
    detailRows.push({ label: "Due date", value: formatDate(data.dueDate) });
  }

  const bodyContent = mergeSections([
    `<mj-text padding="0 0 12px 0" font-size="18px" font-weight="600" color="#111827" line-height="26px">${data.taskTitle}</mj-text>`,
    `<mj-text padding="0 0 16px 0" font-size="14px" color="#475569" line-height="22px">${data.assigneeName}, you’ve just been assigned a new task. Review the highlights below and jump back into Kaneo when you’re ready.</mj-text>`,
    data.taskDescription
      ? `<mj-text padding="0 0 16px 0" font-size="14px" color="#1F2937" line-height="22px">${data.taskDescription}</mj-text>`
      : undefined,
    spacer(12),
    buildDetailTable(detailRows),
  ]);

  const heroSubtitle = data.dueDate
    ? `${data.projectName} • Due ${formatDate(data.dueDate)}`
    : data.projectName;

  const mjmlTemplate = buildEmailLayout({
    title: `Task assigned: ${data.taskTitle}`,
    preview: `${data.assigneeName} has assigned you to an issue`,
    eyebrow: "Task assignment",
    heroTitle: "You’ve got a new task",
    heroSubtitle,
    bodyContent,
    action: {
      label: "Open task in Kaneo",
      url: data.taskUrl,
      secondaryText:
        "You’ll be redirected to Kaneo to continue collaborating with your team.",
    },
  });

  const { html } = mjml2html(mjmlTemplate);
  const text = generateTextFallback(data, "task-assigned");

  return { html, text };
}

export function generateTaskStatusChangedEmail(
  data: TaskStatusChangedEmailData
): EmailContent {
  const newStatusClass = toSlug(data.newStatus);
  const oldStatusClass = toSlug(data.oldStatus);

  const detailRows: DetailRow[] = [
    { label: "Project", value: data.projectName },
    { label: "Assignee", value: data.assigneeName },
    {
      label: "Current status",
      value: `<span class="chip status-${newStatusClass}">${data.newStatus}</span>`,
    },
  ];

  const bodyContent = mergeSections([
    `<mj-text padding="0 0 12px 0" font-size="18px" font-weight="600" color="#111827" line-height="26px">${data.taskTitle}</mj-text>`,
    `<mj-text padding="0 0 16px 0" font-size="14px" color="#475569" line-height="22px">Status moved from <span class="chip status-${oldStatusClass}">${data.oldStatus}</span> to <span class="chip status-${newStatusClass}">${data.newStatus}</span>. Keep momentum by aligning with your team on the next steps.</mj-text>`,
    spacer(12),
    buildDetailTable(detailRows),
  ]);

  const mjmlTemplate = buildEmailLayout({
    title: `Status changed: ${data.taskTitle}`,
    preview: `Status changed from "${data.oldStatus}" to "${data.newStatus}"`,
    eyebrow: "Status update",
    heroTitle: `${data.taskTitle} status updated`,
    heroSubtitle: `${data.oldStatus} → ${data.newStatus}`,
    bodyContent,
    action: {
      label: "Review status in Kaneo",
      url: data.taskUrl,
      secondaryText:
        "Open the task to follow up, leave a note, or adjust the workflow.",
    },
  });

  const { html } = mjml2html(mjmlTemplate);
  const text = generateTextFallback(data, "task-status-changed");

  return { html, text };
}

export function generateTaskCommentAddedEmail(
  data: TaskCommentAddedEmailData
): EmailContent {
  const detailRows: DetailRow[] = [
    { label: "Project", value: data.projectName },
    { label: "Assigned to", value: data.assigneeName },
    { label: "Commenter", value: data.commenterName },
  ];

  const bodyContent = mergeSections([
    `<mj-text padding="0 0 12px 0" font-size="18px" font-weight="600" color="#111827" line-height="26px">${data.taskTitle}</mj-text>`,
    `<mj-text padding="0 0 16px 0" font-size="14px" color="#475569" line-height="22px">${data.commenterName} left new feedback on this task. Catch up on the context below and respond when you’re ready.</mj-text>`,
    buildCallout(`${data.commenterName} says`, data.commentContent),
    spacer(12),
    buildDetailTable(detailRows),
  ]);

  const mjmlTemplate = buildEmailLayout({
    title: `Comment added: ${data.taskTitle}`,
    preview: `${data.commenterName} added a comment`,
    eyebrow: "New comment",
    heroTitle: `${data.commenterName} left a comment`,
    heroSubtitle: `${data.projectName} • ${data.taskTitle}`,
    bodyContent,
    action: {
      label: "Reply in Kaneo",
      url: data.taskUrl,
      secondaryText:
        "Jump back into the discussion and keep the momentum going.",
    },
  });

  const { html } = mjml2html(mjmlTemplate);
  const text = generateTextFallback(data, "task-comment-added");

  return { html, text };
}

export function generateTimeTrackingStartedEmail(
  data: TimeTrackingStartedEmailData
): EmailContent {
  const detailRows: DetailRow[] = [
    { label: "Project", value: data.projectName },
    { label: "Assignee", value: data.assigneeName },
    { label: "Started by", value: data.trackerName },
    { label: "Start time", value: formatDate(data.startTime) },
  ];

  const bodyContent = mergeSections([
    `<mj-text padding="0 0 12px 0" font-size="18px" font-weight="600" color="#111827" line-height="26px">${data.taskTitle}</mj-text>`,
    `<mj-text padding="0 0 16px 0" font-size="14px" color="#475569" line-height="22px">${data.trackerName} kicked off a timer so everyone can see progress in real time.</mj-text>`,
    data.description
      ? `<mj-text padding="0 0 16px 0" font-size="14px" color="#1F2937" line-height="22px">${data.description}</mj-text>`
      : undefined,
    spacer(12),
    buildDetailTable(detailRows),
  ]);

  const mjmlTemplate = buildEmailLayout({
    title: `Time tracking started: ${data.taskTitle}`,
    preview: `${data.trackerName} started tracking time`,
    eyebrow: "Time tracking",
    heroTitle: `${data.trackerName} started tracking time`,
    heroSubtitle: `${data.projectName} • ${data.taskTitle}`,
    bodyContent,
    action: {
      label: "Open task timeline",
      url: data.taskUrl,
      secondaryText:
        "Check the live timer and coordinate the next steps with your team.",
    },
  });

  const { html } = mjml2html(mjmlTemplate);
  const text = generateTextFallback(data, "time-tracking-started");

  return { html, text };
}

export function generateTaskPriorityChangedEmail(
  data: TaskPriorityChangedEmailData
): EmailContent {
  const newPriorityClass = toSlug(data.newPriority);
  const oldPriorityClass = toSlug(data.oldPriority);

  const detailRows: DetailRow[] = [
    { label: "Project", value: data.projectName },
    { label: "Assignee", value: data.assigneeName },
    {
      label: "New priority",
      value: `<span class="chip priority-${newPriorityClass}">${data.newPriority}</span>`,
    },
    {
      label: "Previous priority",
      value: `<span class="chip priority-${oldPriorityClass}">${data.oldPriority}</span>`,
    },
  ];

  const bodyContent = mergeSections([
    `<mj-text padding="0 0 12px 0" font-size="18px" font-weight="600" color="#111827" line-height="26px">${data.taskTitle}</mj-text>`,
    `<mj-text padding="0 0 16px 0" font-size="14px" color="#475569" line-height="22px">Priority changed from <span class="chip priority-${oldPriorityClass}">${data.oldPriority}</span> to <span class="chip priority-${newPriorityClass}">${data.newPriority}</span>. Adjust timelines or expectations if needed.</mj-text>`,
    spacer(12),
    buildDetailTable(detailRows),
  ]);

  const mjmlTemplate = buildEmailLayout({
    title: `Priority changed: ${data.taskTitle}`,
    preview: `Priority changed from "${data.oldPriority}" to "${data.newPriority}"`,
    eyebrow: "Priority change",
    heroTitle: `${data.taskTitle} priority updated`,
    heroSubtitle: `${data.oldPriority} → ${data.newPriority}`,
    bodyContent,
    action: {
      label: "Review priority in Kaneo",
      url: data.taskUrl,
      secondaryText: "Coordinate with stakeholders to keep delivery on track.",
    },
  });

  const { html } = mjml2html(mjmlTemplate);
  const text = generateTextFallback(data, "task-priority-changed");

  return { html, text };
}

export function generateWorkspaceCreatedEmail(
  data: WorkspaceCreatedEmailData
): EmailContent {
  const detailRows: DetailRow[] = [
    { label: "Workspace", value: data.workspaceName },
    { label: "Invited by", value: data.inviterName },
    { label: "Your role", value: data.role },
  ];

  const bodyContent = mergeSections([
    `<mj-text padding="0 0 12px 0" font-size="18px" font-weight="600" color="#111827" line-height="26px">Hi ${data.inviteeName} 👋</mj-text>`,
    `<mj-text padding="0 0 16px 0" font-size="14px" color="#475569" line-height="22px">${data.inviterName} invited you to join the <strong>${data.workspaceName}</strong> workspace. Jump in to align projects, manage tasks, and collaborate with your team.</mj-text>`,
    spacer(12),
    buildDetailTable(detailRows),
  ]);

  const mjmlTemplate = buildEmailLayout({
    title: `Welcome to ${data.workspaceName}`,
    preview: `You've been invited to join ${data.workspaceName}`,
    eyebrow: "Workspace invite",
    heroTitle: `Welcome to ${data.workspaceName}`,
    heroSubtitle: `${data.inviterName} invited you as ${data.role}`,
    bodyContent,
    action: {
      label: "Access workspace",
      url: data.workspaceUrl,
      secondaryText: "Log in to Kaneo to start collaborating instantly.",
    },
  });

  const { html } = mjml2html(mjmlTemplate);
  const text = generateTextFallback(data, "workspace-created");

  return { html, text };
}
