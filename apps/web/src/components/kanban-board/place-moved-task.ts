type Positioned = { position?: number | null };

const SPACING = 1024;
const MAX_SHIFT = 4;

function costAfter(tasks: Positioned[], index: number) {
  let floor = (tasks[index - 1]?.position ?? -1) + 1;
  let cost = 0;
  for (let i = index + 1; i < tasks.length; i++) {
    if ((tasks[i].position ?? -1) > floor) break;
    floor += 1;
    cost += 1;
  }
  return cost;
}

function costBefore(tasks: Positioned[], index: number) {
  let ceiling = (tasks[index + 1].position as number) - 1;
  if (ceiling < 0) return Number.POSITIVE_INFINITY;
  let cost = 0;
  for (let i = index - 1; i >= 0; i--) {
    const position = tasks[i].position;
    if (position != null && position < ceiling) break;
    ceiling -= 1;
    if (ceiling < 0) return Number.POSITIVE_INFINITY;
    cost += 1;
  }
  return cost;
}

function shiftBefore(tasks: Positioned[], index: number) {
  let ceiling = (tasks[index + 1].position as number) - 1;
  tasks[index].position = ceiling;
  for (let i = index - 1; i >= 0; i--) {
    const position = tasks[i].position;
    if (position != null && position < ceiling) break;
    ceiling -= 1;
    tasks[i].position = ceiling;
  }
}

function shiftAfter(tasks: Positioned[], index: number) {
  let floor = (tasks[index - 1]?.position ?? -1) + 1;
  tasks[index].position = floor;
  for (let i = index + 1; i < tasks.length; i++) {
    if ((tasks[i].position ?? -1) > floor) break;
    floor += 1;
    tasks[i].position = floor;
  }
}

export function placeMovedTask(tasks: Positioned[], index: number) {
  const low = tasks[index - 1]?.position ?? -1;
  const next = tasks[index + 1]?.position;
  if (next == null) {
    tasks[index].position = low + 1;
    return;
  }
  if (next - low > 1) {
    tasks[index].position = Math.floor((low + next) / 2);
    return;
  }
  const before = costBefore(tasks, index);
  const after = costAfter(tasks, index);
  if (Math.min(before, after) <= MAX_SHIFT) {
    if (before < after) shiftBefore(tasks, index);
    else shiftAfter(tasks, index);
    return;
  }
  tasks.forEach((task, position) => {
    task.position = (position + 1) * SPACING;
  });
}
