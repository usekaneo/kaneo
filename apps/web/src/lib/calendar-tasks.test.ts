import { describe, expect, it } from "vite-plus/test";
import { buildMonthAgenda } from "@/components/calendar/month-agenda-model";
import {
  buildMonthWeeks,
  packWeekLanes,
} from "@/components/calendar/month-grid-model";
import { toCalendarTasks } from "./calendar-tasks";

const parent: {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
} = {
  id: "parent",
  title: "Parent",
  startDate: "2026-08-10",
  dueDate: "2026-08-12",
};
const child = {
  id: "child",
  title: "Child",
  startDate: "2026-08-20",
  dueDate: "2026-08-21",
};
const relation = {
  sourceTaskId: "parent",
  targetTaskId: "child",
  relationType: "subtask",
};
const source = (tasks: (typeof parent)[]) => ({
  columns: [{ tasks }],
  plannedTasks: [],
});

describe("toCalendarTasks", () => {
  it("schedules one parent box with dated and undated children, including planned tasks", () => {
    const undated = { ...child, id: "undated", startDate: null, dueDate: null };
    const tasks = toCalendarTasks(
      { columns: [{ tasks: [parent, child] }], plannedTasks: [undated] },
      [relation, { ...relation, targetTaskId: "undated" }],
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(parent.id);
    expect(tasks[0].subtasks).toEqual([child, undated]);
    expect(tasks[0].scheduleStart.getDate()).toBe(10);
    expect(tasks[0].scheduleEnd.getDate()).toBe(21);
  });

  it("keeps the same group in lanes, overflow, and the agenda", () => {
    const tasks = toCalendarTasks(source([parent, child]), [relation]);
    const week = buildMonthWeeks(new Date(2026, 7, 1), 1).find((week) =>
      week.some((day) => day.getMonth() === 7 && day.getDate() === 10),
    )!;
    const visible = packWeekLanes(week, tasks, 1);
    expect(visible.segments).toHaveLength(1);
    expect(visible.segments[0].task.subtasks).toEqual([child]);
    const overflow = packWeekLanes(week, tasks, 0);
    expect(overflow.hiddenCountByDay[0]).toBe(1);
    expect(overflow.tasksByDay[0]).toEqual(tasks);
    const agenda = buildMonthAgenda(new Date(2026, 7, 1), tasks);
    expect(agenda).toHaveLength(12);
    expect(
      agenda.every(
        (day) =>
          day.tasks.length === 1 && day.tasks[0].subtasks[0].id === child.id,
      ),
    ).toBe(true);
  });

  it("widens a dated parent's span in both directions for out-of-range children", () => {
    const earlier = {
      ...child,
      id: "earlier",
      startDate: "2026-08-05",
      dueDate: "2026-08-06",
    };
    const tasks = toCalendarTasks(source([parent, earlier, child]), [
      relation,
      { ...relation, targetTaskId: "earlier" },
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(parent.id);
    expect(tasks[0].scheduleStart.getDate()).toBe(5);
    expect(tasks[0].scheduleEnd.getDate()).toBe(21);
    const childWeek = buildMonthWeeks(new Date(2026, 7, 1), 1).find((week) =>
      week.some((day) => day.getMonth() === 7 && day.getDate() === 20),
    )!;
    expect(packWeekLanes(childWeek, tasks, 1).segments[0].task.id).toBe(
      parent.id,
    );
    expect(
      buildMonthAgenda(new Date(2026, 7, 1), tasks).find(
        ({ day }) => day.getDate() === 20,
      )?.tasks[0].id,
    ).toBe(parent.id);
    const hidden = toCalendarTasks(
      source([parent, earlier, child]),
      [relation, { ...relation, targetTaskId: "earlier" }],
      source([parent]),
    );
    expect(hidden[0].scheduleStart.getDate()).toBe(10);
    expect(hidden[0].scheduleEnd.getDate()).toBe(12);
    expect(parent.startDate).toBe("2026-08-10");
    expect(parent.dueDate).toBe("2026-08-12");
  });

  it("does not attach children excluded by visibility or other filters", () => {
    const tasks = toCalendarTasks(source([parent]), [relation]);
    expect(tasks[0].subtasks).toEqual([]);
    expect(toCalendarTasks(source([child]), [relation])[0].id).toBe(child.id);
    const filtered = toCalendarTasks(
      source([parent, child]),
      [relation],
      source([child]),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(parent.id);
    expect(filtered[0].subtasks).toEqual([child]);
    expect(
      toCalendarTasks(source([parent, child]), [relation], source([])),
    ).toEqual([]);
  });

  it("uses descendant dates for an undated parent and flattens nested children once", () => {
    const root = { ...parent, startDate: null, dueDate: null };
    const grandchild = { ...child, id: "grandchild", startDate: "2026-08-15" };
    const tasks = toCalendarTasks(
      { columns: [{ tasks: [root, child, grandchild] }], plannedTasks: [] },
      [
        relation,
        { ...relation, sourceTaskId: "child", targetTaskId: "grandchild" },
      ],
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(root.id);
    expect(tasks[0].subtasks.map((task) => task.id)).toEqual([
      child.id,
      grandchild.id,
    ]);
    expect(tasks[0].scheduleStart.getDate()).toBe(15);
    expect(tasks[0].scheduleEnd.getDate()).toBe(21);
  });

  it("handles missing data, unrelated links, multiple parents, and malformed cycles", () => {
    expect(toCalendarTasks(null, [])).toEqual([]);
    expect(
      toCalendarTasks(source([parent, child]), [
        { ...relation, relationType: "blocks" },
      ]),
    ).toHaveLength(2);
    const otherParent = { ...parent, id: "other" };
    const multiple = toCalendarTasks(source([parent, child, otherParent]), [
      relation,
      { ...relation, sourceTaskId: "other" },
    ]);
    expect(multiple).toHaveLength(2);
    expect(multiple.flatMap((task) => task.subtasks)).toEqual([child]);
    const cycle = toCalendarTasks(source([parent, child]), [
      relation,
      { ...relation, sourceTaskId: "child", targetTaskId: "parent" },
    ]);
    expect(cycle).toHaveLength(1);
    expect(cycle[0].subtasks).toHaveLength(1);
  });
});
