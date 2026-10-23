import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { workspaceAccessColumns } from "../../workspace/can-read-workspace";
import { loadStoredRoles } from "../../workspace/filter-readable-workspaces";
import {
  type PermissionMap,
  rolesAllow,
  satisfies,
} from "../../utils/role-permissions";
import { splitRoles } from "../../utils/split-roles";
import { classifyProjectColumns, type GlobalStatus } from "./global-status";

const READ_BOARD = { workspace: ["read"], project: ["read"], task: ["read"] };
const MOVE_TASKS = { task: ["update"] };

export type BoardScopeFilter = { workspaceId?: string; projectId?: string };

/**
 * Every workspace the caller belongs to and may read tasks in, with the active
 * projects they can open there, and each project's columns placed on the
 * board-wide statuses. Instance admins see their own memberships, not the
 * whole instance.
 */
export async function loadBoardScope(
  userId: string,
  apiKeyScope: PermissionMap | null,
  filter: BoardScopeFilter = {},
): Promise<BoardScope> {
  const memberships = await db
    .select({
      id: workspaceTable.id,
      name: workspaceTable.name,
      slug: workspaceTable.slug,
      ...workspaceAccessColumns,
    })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      filter.workspaceId
        ? eq(workspaceTable.id, filter.workspaceId)
        : sql`true`,
    )
    .orderBy(
      sql`lower(${workspaceTable.name})`,
      workspaceTable.id,
      workspaceUserTable.joinedAt,
    );

  const unique = [...new Map(memberships.map((row) => [row.id, row])).values()];
  const storedRoles = await loadStoredRoles(unique);
  const allows = (row: (typeof unique)[number], permissions: PermissionMap) =>
    (!apiKeyScope || satisfies(apiKeyScope, permissions)) &&
    (row.instanceAdmin ||
      rolesAllow(
        splitRoles(row.role),
        storedRoles.get(row.id) ?? [],
        permissions,
      ));

  const workspaces = unique
    .filter((row) => allows(row, READ_BOARD))
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      canMoveTasks: allows(row, MOVE_TASKS),
    }));

  if (workspaces.length === 0) return emptyScope(workspaces);

  const projects = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      icon: projectTable.icon,
      workspaceId: projectTable.workspaceId,
    })
    .from(projectTable)
    .where(
      and(
        inArray(
          projectTable.workspaceId,
          workspaces.map((workspace) => workspace.id),
        ),
        isNull(projectTable.archivedAt),
        filter.projectId ? eq(projectTable.id, filter.projectId) : undefined,
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(sql`lower(${projectTable.name})`, projectTable.id);

  if (projects.length === 0) return emptyScope(workspaces);

  const columns = await db
    .select({
      id: columnTable.id,
      projectId: columnTable.projectId,
      slug: columnTable.slug,
      name: columnTable.name,
      icon: columnTable.icon,
      isFinal: columnTable.isFinal,
      position: columnTable.position,
    })
    .from(columnTable)
    .where(
      inArray(
        columnTable.projectId,
        projects.map((project) => project.id),
      ),
    )
    .orderBy(asc(columnTable.position), asc(columnTable.id));

  const columnIds: Record<GlobalStatus, string[]> = {
    "to-do": [],
    "in-progress": [],
    done: [],
  };
  const projectsWithColumns = projects.map((project) => {
    const own = columns.filter((column) => column.projectId === project.id);
    const statuses = classifyProjectColumns(own);
    return {
      ...project,
      columns: own.map(({ id, projectId: _projectId, ...column }) => {
        const globalStatus = statuses.get(column.slug) ?? null;
        if (globalStatus) columnIds[globalStatus].push(id);
        return { ...column, globalStatus };
      }),
    };
  });

  return { workspaces, projects: projectsWithColumns, columnIds };
}

function emptyScope(workspaces: BoardScope["workspaces"]) {
  return {
    workspaces,
    projects: [],
    columnIds: { "to-do": [], "in-progress": [], done: [] },
  } satisfies BoardScope;
}

export type BoardScope = {
  workspaces: {
    id: string;
    name: string;
    slug: string;
    canMoveTasks: boolean;
  }[];
  projects: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    workspaceId: string;
    columns: {
      slug: string;
      name: string;
      icon: string | null;
      isFinal: boolean;
      position: number;
      globalStatus: GlobalStatus | null;
    }[];
  }[];
  columnIds: Record<GlobalStatus, string[]>;
};
