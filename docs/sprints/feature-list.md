# Sprint Planning for Kaneo — Feature List

This document enumerates the features required to add Jira-style sprint planning to Kaneo. Each feature carries an identifier, a priority, and the Jira behaviour it references. Priorities follow MoSCoW: Must (required for the first release), Should (required shortly after), Could (optional enhancements).

## A. Data Model and Project Settings

| ID | Feature | Description | Jira Reference | Priority |
|----|---------|-------------|----------------|----------|
| F-A1 | Sprint entity | First-class sprint object per project with name, goal, start date, end date, status (future, active, closed), and sort position. | Jira sprints exist per board with name, goal, and date range. | Must |
| F-A2 | Sprint ordering | Manual ordering of future sprints; the order defines the planning view sequence. | Jira backlog view allows reordering future sprints. | Must |
| F-A3 | Default sprint length setting | Project setting that stores the default sprint length in days; used to prefill the end date when a sprint is started without an explicit date range. | Jira uses a board-level default sprint duration. | Must |
| F-A4 | Sprint assignment on tasks | A nullable sprint reference on every task; a null value means the task sits in the backlog. | Jira issues carry a sprint field; unassigned issues sit in the backlog. | Must |
| F-A5 | Task type field | A type attribute on tasks that distinguishes bugs from other task types, so default sprint routing can be applied. | Jira work items carry a type (Bug, Story, Task). | Must |
| F-A6 | Sprint history retention | Closed sprints and their completed tasks remain stored and viewable; closed sprints are immutable. | Jira retains closed sprints and their issues as history. | Must |

## B. Sprint Lifecycle

| ID | Feature | Description | Jira Reference | Priority |
|----|---------|-------------|----------------|----------|
| F-B1 | Create sprint | Create a new future sprint; the system suggests a name (Sprint N) and accepts an optional goal and date range. | Jira offers a Create Sprint button in the backlog view. | Must |
| F-B2 | Rename sprint | Change the name of a future sprint at any time; renaming an active sprint is allowed while it runs. Closed sprints cannot be renamed. | Jira allows editing sprint names while future or active. | Must |
| F-B3 | Edit sprint details | Edit the goal, start date, and end date of future sprints; edit only the goal and end date of the active sprint. | Jira restricts edits to sprints that have not been completed. | Must |
| F-B4 | Reorder sprints | Reorder future sprints in the planning view. The active and closed sprints cannot be reordered. | Jira backlog view supports reordering future sprints. | Must |
| F-B5 | Start sprint | Start a future sprint, which sets its status to active, stamps the start date, and derives the end date from the entered dates or the default length. Only one sprint per project may be active. | Jira permits one active sprint per board unless parallel sprints are enabled. | Must |
| F-B6 | Close sprint wizard | Close the active sprint through a guided dialog that summarises completed and unfinished tasks, requires selection of a target sprint or the backlog for unfinished tasks, and executes the move in a single transaction. | Jira shows a Complete Sprint dialog that moves open issues to the next sprint or the backlog. | Must |
| F-B7 | Lifecycle guardrails | The system prevents editing closed sprints, prevents assigning tasks to closed sprints, and prevents closing a sprint that is not active. | Jira closed sprints are read-only. | Must |

## C. Task Assignment Rules

| ID | Feature | Description | Jira Reference | Priority |
|----|---------|-------------|----------------|----------|
| F-C1 | Bug default assignment | When a task of type Bug is created, it is assigned automatically to the active sprint if one exists; otherwise it goes to the backlog. | Jira teams commonly configure defaults for issue routing; this is a deliberate Kaneo-specific simplification. | Must |
| F-C2 | Non-bug default assignment | Tasks of any type other than Bug are assigned to the backlog by default. | Jira issues created outside a sprint context land in the backlog. | Must |
| F-C3 | Assignment restrictions | The sprint field of a task is editable only among the active sprint, future sprints, and the backlog. Closed sprints are never offered as an assignment target, and tasks that sit in a closed sprint keep their assignment. | Jira prevents moving issues into completed sprints. | Must |
| F-C4 | Bulk sprint moves | Move multiple tasks between the active sprint, future sprints, and the backlog in one action. | Jira supports bulk issue editing including sprint moves. | Should |

## D. Views and Navigation

| ID | Feature | Description | Jira Reference | Priority |
|----|---------|-------------|----------------|----------|
| F-D1 | Backlog and sprints view | The existing backlog view gains sprint sections: the active sprint summary and ordered future sprints above the backlog, and closed sprints in a collapsed history section. | Jira backlog view: sprints above, backlog below, closed sprints accessible through the sprint dropdown. | Must |
| F-D2 | Board sprint switcher | A sprint selector on the board that filters the board by active sprint, a selected future sprint, or the backlog. | Jira boards are filtered by the active sprint. | Should |
| F-D3 | Sprint badge on tasks | The sprint name appears on task rows in the planning view and in the task details; the field is editable subject to the assignment restrictions. | Jira displays the sprint field on the issue view. | Must |
| F-D4 | Sprint history view | A read-only view of each closed sprint listing its completed tasks, which preserves the history of implementation. | Jira sprint report lists issues completed and not completed in the sprint. | Should |
| F-D5 | Active sprint summary bar | A compact header showing the sprint name, goal, date range, days remaining, and a progress indicator of completed versus total tasks. | Jira displays sprint metadata on the board and backlog. | Should |

## E. Permissions, Audit, and Integrations

| ID | Feature | Description | Jira Reference | Priority |
|----|---------|-------------|----------------|----------|
| F-F1 | Manage sprints permission | Sprint creation, start, close, rename, and reorder require the project update permission; ordinary members may change task sprint assignments within the permitted targets. | Jira gates sprint start and completion behind the Manage Sprints permission. | Must |
| F-F2 | Realtime updates | Sprint changes are broadcast over the project WebSocket so that all clients refresh their sprint and board caches. | Jira updates boards in real time. | Must |
| F-F3 | REST API parity | Sprint endpoints are exposed through the typed REST API, so the typed Hono client and API consumers can query and manage sprints. | Jira exposes sprint operations through its REST API. | Must |
| F-F4 | Plugin and webhook events | Sprint lifecycle events are published on the internal event bus for future integrations. | Jira automation reacts to sprint events. | Could |
| F-F5 | GitHub sync compatibility | The sprint field is a local Kaneo attribute; the GitHub, Gitea, and GitLab integrations continue to sync without attempting to map sprints. | Jira sprint data has no direct GitHub equivalent. | Must |

## F. Reporting and Analytics

| ID | Feature | Description | Jira Reference | Priority |
|----|---------|-------------|----------------|----------|
| F-G1 | Close sprint summary | The close wizard reports the number of completed tasks and the number of unfinished tasks to be moved, plus the selected target. | Jira reports issues completed and incomplete at sprint close. | Must |
| F-G2 | Sprint report | A per-sprint report showing planned versus completed work and the tasks carried over. | Jira sprint report. | Could |
| F-G3 | Burndown chart | A burndown of remaining tasks or effort per day within the active sprint. | Jira burndown chart. | Could |

## Scope Boundaries

| Item | Decision |
|------|----------|
| Parallel sprints per project | Excluded; exactly one active sprint per project, as requested. |
| Burndown chart | Deferred; the core requirement is planning and history, not analytics. |
| Cross-project sprints | Excluded; sprints belong to a single project. |
| Reopening a closed sprint | Excluded; closed sprints are immutable to protect the implementation history. |
| Dedicated sprint permission statement | Deferred; sprint management reuses the existing project update permission to avoid migrating every workspace role (see gap analysis). |
