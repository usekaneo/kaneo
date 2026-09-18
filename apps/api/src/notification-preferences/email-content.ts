import type { ActivityEmailProps, EmailBrand } from "@kaneo/email";

// One place that decides what each notification email says and where its
// buttons go. Every email uses the same mother layout (packages/email).

export type EmailContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceLogo: string | null;
  projectName: string | null;
  taskTitle: string | null;
  /** Where the main button goes: the task, the leave page, … */
  actionUrl: string | null;
};

export type NotificationEmail = {
  subject: string;
  category: string;
  props: ActivityEmailProps;
};

export const clientUrl = () =>
  (process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

type Data = Record<string, unknown> | null;

const str = (data: Data, key: string) => {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const num = (data: Data, key: string) => {
  const value = data?.[key];
  return typeof value === "number" ? value : null;
};

/** Rich-text comments arrive as HTML or markdown; emails show plain words. */
function plain(text: string | null, max = 280) {
  if (!text) return null;
  const clean = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`>#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function leadTime(minutes: number | null) {
  if (!minutes) return "soon";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `in ${days} ${days === 1 ? "day" : "days"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `in ${minutes} minutes`;
}

function formatDay(day: string | null) {
  if (!day) return null;
  const date = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function dateRange(start: string | null, end: string | null) {
  const from = formatDay(start);
  const to = formatDay(end);
  if (!from) return null;
  return !to || to === from ? from : `${from} – ${to}`;
}

const LEAVE_TYPES: Record<string, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
};

function money(minor: number | null, currency: string | null) {
  if (minor === null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

const monthName = (year: number | null, month: number | null) =>
  year && month
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month - 1, 15)))
    : null;

const humanStatus = (status: string | null) =>
  status
    ? status.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    : null;

export function brandFor(context: EmailContext): EmailBrand {
  return {
    name: context.workspaceName,
    // Only a hosted https image; data URLs are blocked by most mail clients.
    logoUrl: context.workspaceLogo?.startsWith("https://")
      ? context.workspaceLogo
      : null,
  };
}

export function buildNotificationEmail(input: {
  type: string;
  eventData: Data;
  context: EmailContext;
  recipientName: string | null;
  fallback: { title: string; body: string };
}): NotificationEmail {
  const { type, eventData: data, context, fallback } = input;
  const workspace = context.workspaceName;
  const task = context.taskTitle ?? str(data, "taskTitle") ?? "a task";
  const project = context.projectName;
  const open = context.actionUrl;
  const base = {
    brand: brandFor(context),
    manageUrl: `${clientUrl()}/dashboard/settings/account/notifications`,
  };
  const taskCard = {
    title: task,
    subtitle: project ? `${project} · ${workspace}` : workspace,
  };
  const openTask = open ? { label: "Open task", url: open } : null;
  const taskReason = `You get this because you work on tasks in ${workspace}.`;

  switch (type) {
    case "task_assignee_changed":
    case "task_created": {
      const heading =
        type === "task_created"
          ? `New task for you: ${task}`
          : `You've been assigned: ${task}`;
      return {
        subject: heading,
        category: "task_assigned",
        props: {
          ...base,
          preview: `${task} is now on your plate${project ? ` in ${project}` : ""}.`,
          eyebrow: "Task assigned",
          heading,
          intro: "It's yours now. Open it to see the details and get started.",
          card: {
            ...taskCard,
            status: { label: "Assigned to you", tone: "info" },
          },
          primary: openTask,
          reason: taskReason,
        },
      };
    }
    case "task_status_changed": {
      const from = humanStatus(str(data, "oldStatus"));
      const to = humanStatus(str(data, "newStatus"));
      return {
        subject: to ? `${task} moved to ${to}` : `${task} changed status`,
        category: "task_status",
        props: {
          ...base,
          preview: to ? `${task} is now ${to}.` : `${task} changed status.`,
          eyebrow: "Status changed",
          heading: to ? `${task} is now ${to}` : `${task} changed status`,
          card: {
            ...taskCard,
            status: to ? { label: to, tone: "success" } : null,
            details:
              from && to ? [{ label: "Moved", value: `${from} → ${to}` }] : [],
          },
          primary: openTask,
          reason: "You get this because the task is assigned to you.",
        },
      };
    }
    case "task_comment":
    case "task_mention": {
      const mention = type === "task_mention";
      const who =
        str(data, mention ? "mentionerName" : "commenterName") ?? "Someone";
      const heading = mention
        ? `${who} mentioned you in ${task}`
        : `${who} commented on ${task}`;
      const words = plain(str(data, "commentPreview"));
      return {
        subject: heading,
        category: mention ? "task_mention" : "task_comment",
        props: {
          ...base,
          preview: words ?? heading,
          eyebrow: mention ? "Mention" : "New comment",
          heading,
          card: taskCard,
          quote: words ? { author: who, text: words } : null,
          primary: open
            ? { label: mention ? "Reply" : "View comment", url: open }
            : null,
          reason: mention
            ? "You get this because someone mentioned you."
            : "You get this because the task is assigned to you.",
        },
      };
    }
    case "due_date_reminder":
    case "task_overdue": {
      const overdue = type === "task_overdue";
      const when = leadTime(num(data, "leadTimeMinutes"));
      const due = formatDay(str(data, "dueDate"));
      return {
        subject: overdue ? `Overdue: ${task}` : `Due ${when}: ${task}`,
        category: overdue ? "task_overdue" : "task_due",
        props: {
          ...base,
          preview: overdue
            ? `${task} is past its due date.`
            : `${task} is due ${when}.`,
          eyebrow: overdue ? "Overdue" : "Due soon",
          heading: overdue ? `${task} is overdue` : `${task} is due ${when}`,
          card: {
            ...taskCard,
            status: overdue
              ? { label: "Overdue", tone: "danger" }
              : { label: "Due soon", tone: "warning" },
            details: due ? [{ label: "Due", value: due }] : [],
          },
          callout: overdue
            ? {
                tone: "danger",
                text: "Finish it, or move the due date so the plan stays honest.",
              }
            : null,
          primary: openTask,
          reason: "You get this because the task is assigned to you.",
        },
      };
    }
    case "time_entry_created":
      return {
        subject: `Time logged on ${task}`,
        category: "time_entry",
        props: {
          ...base,
          preview: `Someone logged time on ${task}.`,
          eyebrow: "Time tracked",
          heading: `Time was logged on ${task}`,
          card: taskCard,
          primary: openTask,
          reason: "You get this because you own the task.",
        },
      };
    case "leave_requested": {
      const who = str(data, "userName") ?? "Someone";
      const kind = LEAVE_TYPES[str(data, "type") ?? ""] ?? "Leave";
      const range = dateRange(str(data, "startDate"), str(data, "endDate"));
      const days = num(data, "days");
      return {
        subject: `${who} asked for ${kind.toLowerCase()}${range ? ` (${range})` : ""}`,
        category: "leave_requested",
        props: {
          ...base,
          preview: `${who} is waiting for your decision.`,
          eyebrow: "Leave request",
          heading: `${who} asked for ${kind.toLowerCase()}`,
          intro: "Approve or reject it; they'll get an email either way.",
          card: {
            title: kind,
            subtitle: range,
            status: { label: "Waiting for you", tone: "warning" },
            details: [
              ...(days !== null
                ? [{ label: "Working days", value: String(days) }]
                : []),
              { label: "Workspace", value: workspace },
            ],
          },
          quote: str(data, "reason")
            ? { author: who, text: str(data, "reason") as string }
            : null,
          primary: open ? { label: "Review request", url: open } : null,
          reason: `You get this because you approve leave in ${workspace}.`,
        },
      };
    }
    case "leave_approved":
    case "leave_rejected":
    case "leave_cancelled": {
      const kind = LEAVE_TYPES[str(data, "type") ?? ""] ?? "Leave";
      const range = dateRange(str(data, "startDate"), str(data, "endDate"));
      const actor = str(data, "actorName") ?? "Your approver";
      const note = str(data, "note");
      const outcome =
        type === "leave_approved"
          ? { word: "approved", tone: "success" as const, label: "Approved" }
          : type === "leave_rejected"
            ? { word: "rejected", tone: "danger" as const, label: "Rejected" }
            : {
                word: "called off",
                tone: "neutral" as const,
                label: "Cancelled",
              };
      return {
        subject: `Your ${kind.toLowerCase()} was ${outcome.word}${range ? ` (${range})` : ""}`,
        category: "leave_decided",
        props: {
          ...base,
          preview: `${actor} ${outcome.word} your ${kind.toLowerCase()}.`,
          eyebrow: "Leave update",
          heading: `Your ${kind.toLowerCase()} was ${outcome.word}`,
          intro:
            type === "leave_approved"
              ? "Enjoy the time off. It's on the team calendar now."
              : type === "leave_rejected"
                ? "Talk to your approver if you'd like to pick other dates."
                : "Those days are working days again.",
          card: {
            title: kind,
            subtitle: range,
            status: { label: outcome.label, tone: outcome.tone },
            details: [{ label: "Decided by", value: actor }],
          },
          quote: note ? { author: actor, text: note } : null,
          primary: open ? { label: "View my leave", url: open } : null,
          reason: `You get this because you asked for leave in ${workspace}.`,
        },
      };
    }
    case "expense_submitted": {
      const who = str(data, "userName") ?? "Someone";
      const amount = money(num(data, "amount"), str(data, "currency"));
      const category = str(data, "category") ?? "Expense";
      const spent = formatDay(str(data, "spentOn"));
      const note = str(data, "description");
      return {
        subject: `${who} submitted an expense${amount ? ` of ${amount}` : ""}`,
        category: "expense_submitted",
        props: {
          ...base,
          preview: `${who} is waiting for your approval.`,
          eyebrow: "Expense",
          heading: `${who} submitted ${amount ?? "an expense"}`,
          intro: "Check the receipt and approve or reject it.",
          card: {
            title: amount ?? category,
            subtitle: category,
            status: { label: "Waiting for you", tone: "warning" },
            details: [
              ...(spent ? [{ label: "Spent on", value: spent }] : []),
              { label: "Workspace", value: workspace },
            ],
          },
          quote: note ? { author: who, text: note } : null,
          primary: open ? { label: "Review expense", url: open } : null,
          reason: `You get this because you approve expenses in ${workspace}.`,
        },
      };
    }
    case "expense_approved":
    case "expense_rejected":
    case "expense_paid": {
      const amount = money(num(data, "amount"), str(data, "currency"));
      const actor = str(data, "actorName") ?? "Your approver";
      const outcome =
        type === "expense_paid"
          ? { word: "paid back", tone: "success" as const, label: "Paid" }
          : type === "expense_approved"
            ? { word: "approved", tone: "success" as const, label: "Approved" }
            : { word: "rejected", tone: "danger" as const, label: "Rejected" };
      return {
        subject: `Your expense${amount ? ` of ${amount}` : ""} was ${outcome.word}`,
        category: "expense_decided",
        props: {
          ...base,
          preview: `${actor} marked your expense ${outcome.label.toLowerCase()}.`,
          eyebrow: "Expense update",
          heading: `Your expense was ${outcome.word}`,
          intro:
            type === "expense_approved"
              ? "It will be paid back with the next payout."
              : type === "expense_paid"
                ? "The money is on its way to you."
                : "Ask your approver if something was missing.",
          card: {
            title: amount ?? "Expense",
            subtitle: str(data, "category"),
            status: { label: outcome.label, tone: outcome.tone },
            details: [{ label: "By", value: actor }],
          },
          primary: open ? { label: "View my expenses", url: open } : null,
          reason: `You get this because you submitted an expense in ${workspace}.`,
        },
      };
    }
    case "payslip_ready": {
      const period = monthName(num(data, "year"), num(data, "month"));
      const forPeriod = period ? ` for ${period}` : "";
      return {
        subject: `Your payslip${forPeriod} is ready`,
        category: "payslip",
        props: {
          ...base,
          preview: `Your payslip${forPeriod} is ready to view.`,
          eyebrow: "Payroll",
          heading: `Your payslip${forPeriod} is ready`,
          // Pay is private: the email only says where to look.
          intro:
            "For your privacy the amounts are not in this email. Open Kaneo to see them.",
          card: period
            ? {
                title: period,
                subtitle: workspace,
                status: { label: "Ready", tone: "success" },
              }
            : null,
          primary: open ? { label: "View payslip", url: open } : null,
          reason: `You get this because you are paid through ${workspace}.`,
        },
      };
    }
    case "workspace_created":
      return {
        subject: `Welcome to ${workspace}`,
        category: "workspace",
        props: {
          ...base,
          preview: `${workspace} is ready.`,
          eyebrow: "Welcome",
          heading: `${workspace} is ready`,
          intro: "Invite your team, create a project and start planning.",
          primary: open ? { label: "Open workspace", url: open } : null,
          reason: "You get this because you created this workspace.",
        },
      };
    default:
      return {
        subject: fallback.title,
        category: "other",
        props: {
          ...base,
          preview: fallback.body,
          heading: fallback.title,
          intro: fallback.body,
          primary: open ? { label: "Open in Kaneo", url: open } : null,
          reason: `You get this because you're a member of ${workspace}.`,
        },
      };
  }
}
