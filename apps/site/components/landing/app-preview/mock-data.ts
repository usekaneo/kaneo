import type { ExternalLink } from "@/types/external-link";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

// Extended task type – same base Task but with embedded labels and
// optional external links (just like the real API returns them).
export type TaskWithExtras = Task & {
  labels?: Array<{ id: string; name: string; color: string }>;
  externalLinks?: Array<ExternalLink>;
};

// ------------------------------------------------------------------
// Mock workspace
// ------------------------------------------------------------------
export const MOCK_WORKSPACE = {
  id: "ws-preview",
  name: "Dunder Mifflin",
  slug: "dunder",
};

// ------------------------------------------------------------------
// Mock workspace labels
// ------------------------------------------------------------------
export const MOCK_WORKSPACE_LABELS = [
  { id: "lbl-1", name: "urgent", color: "#ef4444" },
  { id: "lbl-2", name: "sales", color: "#6366f1" },
  { id: "lbl-3", name: "hr", color: "#10b981" },
  { id: "lbl-4", name: "bears", color: "#f59e0b" },
  { id: "lbl-5", name: "cinema", color: "#8b5cf6" },
];

// ------------------------------------------------------------------
// Mock users
// ------------------------------------------------------------------
export const MOCK_USERS = {
  members: [
    { userId: "u-1", user: { name: "Michael Scott", image: null } },
    { userId: "u-2", user: { name: "Dwight Schrute", image: null } },
    { userId: "u-3", user: { name: "Jim Halpert", image: null } },
    { userId: "u-4", user: { name: "Pam Beesly", image: null } },
  ],
};

// ------------------------------------------------------------------
// Helper timestamps / dates
// ------------------------------------------------------------------
const CREATED_AT = "2024-01-01T00:00:00.000Z";
const UPDATED_AT = "2024-07-01T00:00:00.000Z";

const d = (offset: number): string => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString();
};

// ------------------------------------------------------------------
// Project 1: Scranton Branch
// ------------------------------------------------------------------
const SCR_ID = "p-1";
const WS_ID = "ws-preview";

const scrTasks: TaskWithExtras[] = [
  {
    id: "t-101",
    number: 1,
    title: "Plan Dundie Awards ceremony",
    description:
      "Book Chili's, prepare trophies, write acceptance speech (just in case), and arrange the PowerPoint slideshow.",
    priority: "high",
    status: "in-progress",
    position: 1,
    startDate: d(-3),
    dueDate: d(2),
    userId: "u-1",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Michael Scott",
    assigneeImage: null,
    labels: [{ id: "lbl-3", name: "hr", color: "#10b981" }],
  },
  {
    id: "t-102",
    number: 2,
    title: "Negotiate new paper contract with Prince Family Paper",
    description:
      "Undercut their pricing while maintaining a friendly relationship. Do not mention the secret intel.",
    priority: "medium",
    status: "in-progress",
    position: 2,
    startDate: d(1),
    dueDate: d(5),
    userId: "u-3",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Jim Halpert",
    assigneeImage: null,
    labels: [{ id: "lbl-2", name: "sales", color: "#6366f1" }],
  },
  {
    id: "t-103",
    number: 3,
    title: "Organize Pretzel Day logistics",
    description:
      "Coordinate with the pretzel vendor, manage the queue system, and prevent stampedes near the reception desk.",
    priority: "urgent",
    status: "to-do",
    position: 1,
    startDate: d(-4),
    dueDate: d(-1),
    userId: "u-4",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Pam Beesly",
    assigneeImage: null,
    labels: [{ id: "lbl-1", name: "urgent", color: "#ef4444" }],
  },
  {
    id: "t-104",
    number: 4,
    title: "Update fire safety training video",
    description:
      "The current video references a fax machine nobody uses anymore. Replace fire extinguisher scene. Do NOT involve Kevin.",
    priority: "low",
    status: "to-do",
    position: 2,
    startDate: d(7),
    dueDate: d(14),
    userId: "u-2",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Dwight Schrute",
    assigneeImage: null,
    labels: [],
  },
  {
    id: "t-105",
    number: 5,
    title: "Review Dwight's beet farm expense report",
    description:
      "He's submitted $400 in 'office-related beet research'. Finance needs a sign-off before the quarter closes.",
    priority: "high",
    status: "in-review",
    position: 1,
    startDate: d(-1),
    dueDate: d(3),
    userId: "u-3",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Jim Halpert",
    assigneeImage: null,
    labels: [{ id: "lbl-4", name: "bears", color: "#f59e0b" }],
  },
  {
    id: "t-106",
    number: 6,
    title: "Complete CPR recertification",
    description:
      "Annual requirement. Staple has agreed to leave the mannequin face intact this time.",
    priority: "medium",
    status: "done",
    position: 1,
    startDate: d(18),
    dueDate: null,
    userId: "u-4",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Pam Beesly",
    assigneeImage: null,
    labels: [{ id: "lbl-3", name: "hr", color: "#10b981" }],
  },
  {
    id: "t-107",
    number: 7,
    title: "Migrate contact database off the index cards",
    description:
      "Dwight insists the card system is more secure. It isn't. Move everything to Salesforce.",
    priority: "medium",
    status: "done",
    position: 2,
    startDate: d(23),
    dueDate: null,
    userId: "u-2",
    projectId: SCR_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Dwight Schrute",
    assigneeImage: null,
    labels: [{ id: "lbl-2", name: "sales", color: "#6366f1" }],
  },
];

export const WEB_PROJECT: ProjectWithTasks = {
  id: SCR_ID,
  name: "Scranton Branch",
  slug: "SCR",
  description: "Day-to-day operations of the Scranton office.",
  icon: null,
  workspaceId: WS_ID,
  isPublic: false,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  columns: [
    {
      id: "to-do",
      name: "To Do",
      order: 0,
      isFinal: false,
      projectId: SCR_ID,
      tasks: scrTasks.filter((t) => t.status === "to-do"),
    },
    {
      id: "in-progress",
      name: "In Progress",
      order: 1,
      isFinal: false,
      projectId: SCR_ID,
      tasks: scrTasks.filter((t) => t.status === "in-progress"),
    },
    {
      id: "in-review",
      name: "In Review",
      order: 2,
      isFinal: false,
      projectId: SCR_ID,
      tasks: scrTasks.filter((t) => t.status === "in-review"),
    },
    {
      id: "done",
      name: "Done",
      order: 3,
      isFinal: true,
      projectId: SCR_ID,
      tasks: scrTasks.filter((t) => t.status === "done"),
    },
  ],
};

// ------------------------------------------------------------------
// Project 2: Threat Level Midnight
// ------------------------------------------------------------------
const TLM_ID = "p-2";

const tlmTasks: TaskWithExtras[] = [
  {
    id: "t-201",
    number: 1,
    title: "Edit the casino heist sequence",
    description:
      "Michael Scarn's dialogue in act 2 needs tightening. The line 'Threat Level Midnight' should land harder.",
    priority: "high",
    status: "in-progress",
    position: 1,
    startDate: d(2),
    dueDate: d(7),
    userId: "u-1",
    projectId: TLM_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Michael Scott",
    assigneeImage: null,
    labels: [{ id: "lbl-5", name: "cinema", color: "#8b5cf6" }],
  },
  {
    id: "t-202",
    number: 2,
    title: "Rewrite the love interest subplot",
    description:
      "Catherine Zeta-Jones was unavailable. Recasting with Carol from the realtor office. Update all related scenes.",
    priority: "high",
    status: "to-do",
    position: 1,
    startDate: d(5),
    dueDate: d(10),
    userId: "u-4",
    projectId: TLM_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Pam Beesly",
    assigneeImage: null,
    labels: [{ id: "lbl-5", name: "cinema", color: "#8b5cf6" }],
  },
  {
    id: "t-203",
    number: 3,
    title: "Review Golden Face's villain monologue",
    description:
      "Dwight's delivery is technically correct but lacks menace. Consider additional coaching.",
    priority: "urgent",
    status: "in-review",
    position: 1,
    startDate: d(-2),
    dueDate: d(1),
    userId: "u-3",
    projectId: TLM_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Jim Halpert",
    assigneeImage: null,
    labels: [
      { id: "lbl-4", name: "bears", color: "#f59e0b" },
      { id: "lbl-5", name: "cinema", color: "#8b5cf6" },
    ],
  },
  {
    id: "t-204",
    number: 4,
    title: "Source ice hockey rink for final showdown",
    description:
      "The Scranton rink has agreed to a half-day rental. Confirm insurance waiver and bring spare zamboni driver.",
    priority: "medium",
    status: "to-do",
    position: 2,
    startDate: d(15),
    dueDate: d(21),
    userId: null,
    projectId: TLM_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    labels: [],
  },
  {
    id: "t-205",
    number: 5,
    title: "Score the opening title sequence",
    description:
      "Kevin has offered to handle the music. Nobody else applied. Finalize the saxophone arrangement.",
    priority: "medium",
    status: "done",
    position: 1,
    startDate: d(25),
    dueDate: null,
    userId: "u-3",
    projectId: TLM_ID,
    workspaceId: WS_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    assigneeName: "Jim Halpert",
    assigneeImage: null,
    labels: [{ id: "lbl-5", name: "cinema", color: "#8b5cf6" }],
  },
];

export const MOB_PROJECT: ProjectWithTasks = {
  id: TLM_ID,
  name: "Threat Level Midnight",
  slug: "TLM",
  description: "Michael Scott's magnum opus. In production since 1996.",
  icon: null,
  workspaceId: WS_ID,
  isPublic: false,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  columns: [
    {
      id: "to-do",
      name: "To Do",
      order: 0,
      isFinal: false,
      projectId: TLM_ID,
      tasks: tlmTasks.filter((t) => t.status === "to-do"),
    },
    {
      id: "in-progress",
      name: "In Progress",
      order: 1,
      isFinal: false,
      projectId: TLM_ID,
      tasks: tlmTasks.filter((t) => t.status === "in-progress"),
    },
    {
      id: "in-review",
      name: "In Review",
      order: 2,
      isFinal: false,
      projectId: TLM_ID,
      tasks: tlmTasks.filter((t) => t.status === "in-review"),
    },
    {
      id: "done",
      name: "Done",
      order: 3,
      isFinal: true,
      projectId: TLM_ID,
      tasks: tlmTasks.filter((t) => t.status === "done"),
    },
  ],
};

export const MOCK_PROJECTS: ProjectWithTasks[] = [WEB_PROJECT, MOB_PROJECT];
