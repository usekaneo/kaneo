import { Schema } from "effect";

const NullableString = Schema.NullOr(Schema.String);

export const CurrentUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: NullableString,
  role: NullableString,
});
export type CurrentUser = typeof CurrentUser.Type;

export const Workspace = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: NullableString,
  description: NullableString,
  createdAt: Schema.String,
  role: NullableString,
});
export type Workspace = typeof Workspace.Type;

export const WorkspaceList = Schema.Array(Workspace);

export const OrganizationList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
    logo: Schema.optionalKey(NullableString),
    description: Schema.optionalKey(NullableString),
    metadata: Schema.optionalKey(Schema.NullOr(Schema.Unknown)),
    createdAt: Schema.Unknown,
  }),
);
export type OrganizationList = typeof OrganizationList.Type;

export const Project = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  icon: NullableString,
  description: NullableString,
  archivedAt: NullableString,
  position: Schema.Number,
  lastTaskNumber: Schema.Number,
});
export type Project = typeof Project.Type;

export const ProjectList = Schema.Array(Project);

export const BoardLabel = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.String,
});
export type BoardLabel = typeof BoardLabel.Type;

export const BoardTask = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  number: Schema.NullOr(Schema.Number),
  status: Schema.String,
  priority: Schema.String,
  startDate: NullableString,
  dueDate: NullableString,
  createdAt: Schema.String,
  assigneeId: NullableString,
  assigneeName: NullableString,
  projectId: Schema.String,
  position: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  labels: Schema.optionalKey(Schema.Array(BoardLabel)),
});
export type BoardTask = typeof BoardTask.Type;

export const BoardColumn = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  isFinal: Schema.Boolean,
  tasks: Schema.Array(BoardTask),
});
export type BoardColumn = typeof BoardColumn.Type;

export const BoardPage = Schema.Struct({
  data: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
    workspaceId: Schema.String,
    columns: Schema.Array(BoardColumn),
  }),
  pagination: Schema.Struct({
    total: Schema.Number,
    page: Schema.Number,
    totalPages: Schema.Number,
    relatedTotalPages: Schema.optionalKey(Schema.Number),
  }),
});
export type BoardPage = typeof BoardPage.Type;

export const AssignedTask = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
  status: Schema.String,
  statusName: NullableString,
  priority: Schema.String,
  dueDate: NullableString,
  projectName: Schema.String,
  projectSlug: Schema.String,
});
export type AssignedTask = typeof AssignedTask.Type;

export const AssignedTasks = Schema.Struct({
  tasks: Schema.Array(AssignedTask),
  total: Schema.Number,
});

export const TaskDetail = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  workspaceId: Schema.optionalKey(Schema.String),
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
  description: NullableString,
  status: Schema.String,
  priority: Schema.String,
  startDate: NullableString,
  dueDate: NullableString,
  createdAt: Schema.String,
  assigneeId: NullableString,
  assigneeName: NullableString,
});
export type TaskDetail = typeof TaskDetail.Type;

export const Column = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  position: Schema.Number,
  color: NullableString,
  isFinal: Schema.Boolean,
});
export type Column = typeof Column.Type;

export const ColumnList = Schema.Array(Column);

export const WorkspaceMember = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
});
export type WorkspaceMember = typeof WorkspaceMember.Type;

export const WorkspaceMemberList = Schema.Array(WorkspaceMember);
