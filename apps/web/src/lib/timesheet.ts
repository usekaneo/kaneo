import { addDays, format, isSameDay, startOfWeek } from "date-fns";

export type TimesheetEntry = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskNumber: number | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  userName: string | null;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
};

export type TimesheetRow = {
  taskId: string;
  taskTitle: string;
  taskKey: string;
  perDay: number[];
  total: number;
};

export type TimesheetProject = {
  projectId: string;
  projectName: string;
  rows: TimesheetRow[];
  perDay: number[];
  total: number;
};

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// A running entry has no duration yet; count it up to `now`.
export function entrySeconds(entry: TimesheetEntry, now: Date): number {
  if (entry.duration !== null && entry.endTime) return entry.duration;
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(entry.startTime).getTime()) / 1000),
  );
}

// Groups a week's entries by project, then task, in local-time days. An entry
// that crosses midnight counts on the day it started, which is how people
// read their own timesheets.
export function buildTimesheet(
  entries: TimesheetEntry[],
  days: Date[],
  now: Date,
) {
  const projects = new Map<string, TimesheetProject>();
  const perDay = days.map(() => 0);

  for (const entry of entries) {
    const dayIndex = days.findIndex((d) =>
      isSameDay(d, new Date(entry.startTime)),
    );
    if (dayIndex === -1) continue;
    const seconds = entrySeconds(entry, now);

    let project = projects.get(entry.projectId);
    if (!project) {
      project = {
        projectId: entry.projectId,
        projectName: entry.projectName,
        rows: [],
        perDay: days.map(() => 0),
        total: 0,
      };
      projects.set(entry.projectId, project);
    }

    let row = project.rows.find((r) => r.taskId === entry.taskId);
    if (!row) {
      row = {
        taskId: entry.taskId,
        taskTitle: entry.taskTitle,
        taskKey:
          entry.taskNumber !== null
            ? `${entry.projectSlug}-${entry.taskNumber}`
            : entry.projectSlug,
        perDay: days.map(() => 0),
        total: 0,
      };
      project.rows.push(row);
    }

    row.perDay[dayIndex] += seconds;
    row.total += seconds;
    project.perDay[dayIndex] += seconds;
    project.total += seconds;
    perDay[dayIndex] += seconds;
  }

  const sorted = [...projects.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );
  for (const project of sorted) {
    project.rows.sort((a, b) => b.total - a.total);
  }

  return {
    projects: sorted,
    perDay,
    total: perDay.reduce((sum, s) => sum + s, 0),
  };
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function timesheetCsv(
  entries: TimesheetEntry[],
  headers: string[],
  now: Date,
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const entry of entries) {
    const start = new Date(entry.startTime);
    const hours = (entrySeconds(entry, now) / 3600).toFixed(2);
    lines.push(
      [
        format(start, "yyyy-MM-dd"),
        format(start, "HH:mm"),
        entry.endTime ? format(new Date(entry.endTime), "HH:mm") : "",
        hours,
        entry.userName ?? "",
        entry.projectName,
        entry.taskTitle,
        entry.description ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // Excel reads a UTF-8 CSV correctly only with the byte order mark.
  return `﻿${lines.join("\r\n")}\r\n`;
}
