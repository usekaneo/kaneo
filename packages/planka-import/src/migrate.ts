import { labelColorToHex } from "./colors.js";
import type { KaneoClient } from "./kaneo.js";
import { toProjectKey, uniqueKey } from "./keys.js";
import {
  boardProjectName,
  buildDescription,
  DEFAULT_PRIORITY,
  formatComment,
  planColumns,
  sortCards,
  toDueDate,
} from "./mapping.js";
import {
  MIGRATABLE_LIST_TYPES,
  type PlankaBoard,
  type PlankaClient,
  type PlankaProject,
  type PlankaUser,
} from "./planka.js";

export type BoardTarget = {
  project: PlankaProject;
  board: PlankaBoard;
  boardCountInProject: number;
};

export type BoardReport = {
  board: string;
  project: string;
  projectName: string;
  projectKey: string | null;
  kaneoProjectId: string | null;
  columns: number;
  tasks: number;
  labels: number;
  comments: number;
  assignees: number;
  checklistItems: number;
  skippedLists: string[];
  skippedAttachments: number;
  warnings: string[];
  failed: boolean;
  error?: string;
};

export type MigrateOptions = {
  planka: PlankaClient;
  kaneo: KaneoClient;
  workspaceId: string;
  targets: BoardTarget[];
  dryRun: boolean;
  skipComments: boolean;
  projectIcon?: string;
  onProgress?: (message: string) => void;
};

export async function migrate(options: MigrateOptions): Promise<BoardReport[]> {
  const {
    planka,
    kaneo,
    workspaceId,
    targets,
    dryRun,
    skipComments,
    projectIcon = "Layout",
    onProgress = () => {},
  } = options;

  const takenKeys = new Set<string>();
  const membersByEmail = new Map<string, string>();

  if (!dryRun) {
    for (const project of await kaneo.listProjects(workspaceId)) {
      if (project.slug) takenKeys.add(project.slug);
    }
    for (const member of await kaneo.listMembers(workspaceId)) {
      if (member.email)
        membersByEmail.set(member.email.toLowerCase(), member.id);
    }
  }

  const reports: BoardReport[] = [];

  for (const target of targets) {
    const projectName = boardProjectName(
      target.project.name,
      target.board.name,
      target.boardCountInProject,
    );

    const report: BoardReport = {
      board: target.board.name,
      project: target.project.name,
      projectName,
      projectKey: null,
      kaneoProjectId: null,
      columns: 0,
      tasks: 0,
      labels: 0,
      comments: 0,
      assignees: 0,
      checklistItems: 0,
      skippedLists: [],
      skippedAttachments: 0,
      warnings: [],
      failed: false,
    };

    try {
      await migrateBoard({
        planka,
        kaneo,
        workspaceId,
        target,
        projectName,
        projectIcon,
        dryRun,
        skipComments,
        takenKeys,
        membersByEmail,
        report,
        onProgress,
      });
    } catch (error) {
      report.failed = true;
      report.error = error instanceof Error ? error.message : String(error);
    }

    reports.push(report);
  }

  return reports;
}

async function migrateBoard(context: {
  planka: PlankaClient;
  kaneo: KaneoClient;
  workspaceId: string;
  target: BoardTarget;
  projectName: string;
  projectIcon: string;
  dryRun: boolean;
  skipComments: boolean;
  takenKeys: Set<string>;
  membersByEmail: Map<string, string>;
  report: BoardReport;
  onProgress: (message: string) => void;
}): Promise<void> {
  const {
    planka,
    kaneo,
    workspaceId,
    target,
    projectName,
    projectIcon,
    dryRun,
    skipComments,
    takenKeys,
    membersByEmail,
    report,
    onProgress,
  } = context;

  onProgress(`Reading board "${target.board.name}" from PLANKA`);
  const bundle = await planka.getBoard(target.board.id);
  const included = bundle.included;

  const allLists = included.lists ?? [];
  const migratableLists = allLists.filter((list) =>
    MIGRATABLE_LIST_TYPES.includes(list.type),
  );
  report.skippedLists = allLists
    .filter((list) => !MIGRATABLE_LIST_TYPES.includes(list.type))
    .map((list) => list.name?.trim() || list.type);

  const columns = planColumns(migratableLists);
  for (const column of columns) {
    if (column.renamedFrom) {
      report.warnings.push(
        `List "${column.renamedFrom}" was imported as column "${column.name}" to avoid a naming conflict in Kaneo.`,
      );
    }
  }

  const slugByListId = new Map(
    columns.map((column) => [column.listId, column.slug]),
  );

  const cards = sortCards(
    (included.cards ?? []).filter((card) => slugByListId.has(card.listId)),
  );

  const taskLists = included.taskLists ?? [];
  const checklistItems = included.tasks ?? [];
  const cardLabels = included.cardLabels ?? [];
  const cardMemberships = included.cardMemberships ?? [];
  const boardLabels = included.labels ?? [];
  const usersById = new Map<string, PlankaUser>(
    (included.users ?? []).map((user) => [user.id, user]),
  );

  report.columns = columns.length;
  report.tasks = cards.length;
  report.checklistItems = checklistItems.length;
  report.skippedAttachments = (included.attachments ?? []).length;

  const usedLabelIds = new Set(
    cardLabels
      .filter((link) => cards.some((card) => card.id === link.cardId))
      .map((link) => link.labelId),
  );
  report.labels = boardLabels.filter((label) =>
    usedLabelIds.has(label.id),
  ).length;

  if (dryRun) {
    // The comment count is the denormalized per-card total, so a dry run can
    // report it without fetching every card's comment thread.
    report.comments = skipComments
      ? 0
      : cards.reduce((total, card) => total + (card.commentsTotal ?? 0), 0);
    report.projectKey = toProjectKey(projectName);
    return;
  }

  const projectKey = uniqueKey(toProjectKey(projectName), takenKeys);
  takenKeys.add(projectKey);
  report.projectKey = projectKey;

  onProgress(`Creating project "${projectName}" (${projectKey})`);
  const project = await kaneo.createProject({
    name: projectName,
    workspaceId,
    icon: projectIcon,
    slug: projectKey,
  });
  report.kaneoProjectId = project.id;

  // Kaneo seeds every new project with four default columns. They are empty at
  // this point, so removing them before creating ours keeps the board a 1:1
  // mirror of PLANKA instead of leaving unused columns behind.
  for (const existing of await kaneo.listColumns(project.id)) {
    await kaneo.deleteColumn(existing.id);
  }

  for (const column of columns) {
    await kaneo.createColumn(project.id, {
      name: column.name,
      isFinal: column.isFinal,
    });
  }

  const labelIdByPlankaId = new Map<string, { name: string; color: string }>();
  for (const label of boardLabels) {
    if (!usedLabelIds.has(label.id)) continue;

    const name = label.name?.trim() || label.color;
    const color = labelColorToHex(label.color);
    // Register the label at workspace level first so it shows up in Kaneo's
    // label picker, not only on the tasks that happen to carry it.
    await kaneo.createLabel({ name, color, workspaceId });
    labelIdByPlankaId.set(label.id, { name, color });
  }

  let taskIndex = 0;
  for (const card of cards) {
    taskIndex++;
    onProgress(
      `Importing task ${taskIndex}/${cards.length} into "${projectName}"`,
    );

    const status = slugByListId.get(card.listId);
    if (!status) continue;

    const cardChecklists = taskLists.filter((tl) => tl.cardId === card.id);
    const description = buildDescription(card, cardChecklists, checklistItems);

    const assigneeId = resolveAssignee(
      card.id,
      cardMemberships,
      usersById,
      membersByEmail,
    );
    if (assigneeId) report.assignees++;

    const dueDate = toDueDate(card);

    const task = await kaneo.createTask(project.id, {
      title: card.name,
      description,
      status,
      priority: DEFAULT_PRIORITY,
      ...(dueDate ? { dueDate } : {}),
      ...(assigneeId ? { userId: assigneeId } : {}),
    });

    for (const link of cardLabels) {
      if (link.cardId !== card.id) continue;
      const label = labelIdByPlankaId.get(link.labelId);
      if (!label) continue;

      await kaneo.createLabel({
        name: label.name,
        color: label.color,
        workspaceId,
        taskId: task.id,
      });
    }

    if (skipComments || card.commentsTotal === 0) continue;

    const { comments, users } = await planka.listComments(card.id);
    for (const user of users) usersById.set(user.id, user);

    for (const comment of comments) {
      const author = comment.userId ? usersById.get(comment.userId) : undefined;
      await kaneo.createComment(task.id, formatComment(comment, author));
      report.comments++;
    }
  }
}

function resolveAssignee(
  cardId: string,
  memberships: { cardId: string; userId: string }[],
  usersById: Map<string, PlankaUser>,
  membersByEmail: Map<string, string>,
): string | undefined {
  // PLANKA allows several members per card; Kaneo has a single assignee, so we
  // take the first member who also exists in the target workspace.
  for (const membership of memberships) {
    if (membership.cardId !== cardId) continue;

    const email = usersById.get(membership.userId)?.email?.toLowerCase();
    if (!email) continue;

    const kaneoUserId = membersByEmail.get(email);
    if (kaneoUserId) return kaneoUserId;
  }

  return undefined;
}
