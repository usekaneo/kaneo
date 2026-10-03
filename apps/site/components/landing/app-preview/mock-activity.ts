import messages from "../../../../../i18n/en-US.json";
import { fillMessage } from "./fill-message";

export type PreviewActivity = {
  id: string;
  actorName: string;
  // What the actor did, phrased to follow their name.
  action: string;
  comment?: string;
  taskId: string;
  createdAt: string;
};

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const MOCK_ACTIVITY: PreviewActivity[] = [
  {
    id: "a-1",
    actorName: "Dwight Schrute",
    action: messages.workspace.home.activity.commented,
    comment:
      "Beet research is a legitimate business expense. @Jim the receipts are in your drawer.",
    taskId: "t-105",
    createdAt: minutesAgo(12),
  },
  {
    id: "a-2",
    actorName: "Michael Scott",
    action: messages.workspace.home.activity.commented,
    comment: "Needs more menace. Way more menace.",
    taskId: "t-203",
    createdAt: minutesAgo(48),
  },
  {
    id: "a-3",
    actorName: "Pam Beesly",
    action: fillMessage(messages.activity.changedStatus, {
      from: "To Do",
      to: "In Progress",
    }),
    taskId: "t-201",
    createdAt: minutesAgo(130),
  },
  {
    id: "a-4",
    actorName: "Michael Scott",
    action: fillMessage(messages.activity.assignedTo, { name: "Jim Halpert" }),
    taskId: "t-108",
    createdAt: minutesAgo(60 * 5),
  },
  {
    id: "a-5",
    actorName: "Dwight Schrute",
    action: messages.activity.created,
    taskId: "t-104",
    createdAt: minutesAgo(60 * 27),
  },
];
