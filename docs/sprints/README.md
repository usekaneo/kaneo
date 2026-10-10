# Sprint Planning for Kaneo

This folder contains the planning documents for adding Jira-style sprint planning to Kaneo.

| Document | Purpose |
|----------|---------|
| [Feature list](./feature-list.md) | The required features grouped by area, each with a Jira reference and a MoSCoW priority. |
| [Gap analysis](./gap-analysis.md) | The contrast between Kaneo's capability before the feature and the target, with reusable foundations and assumptions. |
| [Requirements and implementation plan](./requirements-implementation-plan.md) | Functional requirements, business rules, data model, API design, UI specification, and the phased implementation plan. |

## Scope summary

- Every task carries a sprint assignment; tasks of type Bug default to the active sprint, all other types default to the backlog.
- A task's sprint can be changed only among the active sprint, future sprints, and the backlog; closed sprints are immutable.
- Closing a sprint moves unfinished tasks to a selected target sprint or the backlog, while completed tasks remain in the closed sprint as the history of implementation.
- Project settings define the default sprint length in days.
- Sprints can be created, renamed, edited while future, and reordered, following Jira's sprint management as the behavioural reference.
- The sprint planning panel lists the tasks of every sprint section, and sprint-scheduled tasks leave the plain backlog list below.
- The board offers a sprint filter, and the backlog bulk toolbar moves the selected tasks between sprints and the backlog.
- Closing a sprint freezes a carry-over snapshot on the sprint, so every closed sprint reports planned versus completed work and lists the tasks that were carried over.

The gap analysis was written from public sources before implementation; the assumptions listed there were verified against this repository when the feature was implemented on the `feat/sprint-planning` branch.
