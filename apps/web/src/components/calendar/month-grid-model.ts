import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const DAYS_PER_WEEK = 7;

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Any task already normalized by `toScheduledTasks`. Kept minimal so the layout
 * math stays independent of the task payload.
 */
export type PackableTask = {
  id: string;
  scheduleStart: Date;
  scheduleEnd: Date;
};

export type WeekSegment<TTask extends PackableTask> = {
  task: TTask;
  lane: number;
  /** 1-based CSS grid line where the bar starts. */
  columnStart: number;
  /** Exclusive CSS grid line where the bar ends. */
  columnEnd: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekLayout<TTask extends PackableTask> = {
  segments: Array<WeekSegment<TTask>>;
  /** Per weekday index, how many tasks did not fit within `maxLanes`. */
  hiddenCountByDay: number[];
  /**
   * Per weekday index, every task overlapping that day — visible or not — in
   * the same order the lanes were packed. Backs the overflow popover.
   */
  tasksByDay: TTask[][];
};

/**
 * Week-aligned month grid: always whole weeks, so the first and last row can
 * carry days from the neighbouring months.
 */
export function buildMonthWeeks(
  visibleMonth: Date,
  weekStartsOn: WeekStartsOn,
): Date[][] {
  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let index = 0; index < days.length; index += DAYS_PER_WEEK) {
    weeks.push(days.slice(index, index + DAYS_PER_WEEK));
  }

  return weeks;
}

/**
 * Clips every task overlapping the week to that week's seven columns, then
 * greedily packs the clipped segments into lanes so overlapping tasks stack
 * instead of colliding. Segments past `maxLanes` are reported per day so the
 * cell can render an overflow hint.
 */
export function packWeekLanes<TTask extends PackableTask>(
  week: Date[],
  tasks: TTask[],
  maxLanes: number,
): WeekLayout<TTask> {
  const hiddenCountByDay = new Array<number>(DAYS_PER_WEEK).fill(0);
  const tasksByDay: TTask[][] = Array.from({ length: DAYS_PER_WEEK }, () => []);
  const weekStart = week[0];

  if (!weekStart) {
    return { segments: [], hiddenCountByDay, tasksByDay };
  }

  const lastDayIndex = DAYS_PER_WEEK - 1;

  const candidates = tasks
    .map((task) => {
      const startOffset = differenceInCalendarDays(
        task.scheduleStart,
        weekStart,
      );
      const endOffset = differenceInCalendarDays(task.scheduleEnd, weekStart);

      if (endOffset < 0 || startOffset > lastDayIndex) return null;

      const clippedStart = Math.max(0, startOffset);
      const clippedEnd = Math.min(lastDayIndex, endOffset);

      return {
        task,
        clippedStart,
        clippedEnd,
        columnStart: clippedStart + 1,
        columnEnd: clippedEnd + 2,
        continuesBefore: startOffset < 0,
        continuesAfter: endOffset > lastDayIndex,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    // Longest bar first within a start column, then by id so the layout does
    // not shuffle between renders of the same data.
    .sort((left, right) => {
      if (left.columnStart !== right.columnStart) {
        return left.columnStart - right.columnStart;
      }
      const leftSpan = left.columnEnd - left.columnStart;
      const rightSpan = right.columnEnd - right.columnStart;
      if (leftSpan !== rightSpan) return rightSpan - leftSpan;
      return left.task.id.localeCompare(right.task.id);
    });

  const segments: Array<WeekSegment<TTask>> = [];
  const laneNextFreeColumn: number[] = [];

  for (const candidate of candidates) {
    for (
      let dayIndex = candidate.clippedStart;
      dayIndex <= candidate.clippedEnd;
      dayIndex += 1
    ) {
      tasksByDay[dayIndex].push(candidate.task);
    }

    let lane = laneNextFreeColumn.findIndex(
      (nextFree) => nextFree <= candidate.columnStart,
    );

    if (lane === -1) {
      lane = laneNextFreeColumn.length;
      laneNextFreeColumn.push(candidate.columnEnd);
    } else {
      laneNextFreeColumn[lane] = candidate.columnEnd;
    }

    if (lane < maxLanes) {
      segments.push({
        task: candidate.task,
        lane,
        columnStart: candidate.columnStart,
        columnEnd: candidate.columnEnd,
        continuesBefore: candidate.continuesBefore,
        continuesAfter: candidate.continuesAfter,
      });
      continue;
    }

    for (
      let dayIndex = candidate.clippedStart;
      dayIndex <= candidate.clippedEnd;
      dayIndex += 1
    ) {
      hiddenCountByDay[dayIndex] += 1;
    }
  }

  return { segments, hiddenCountByDay, tasksByDay };
}
