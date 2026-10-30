const MAX_TASK_NUMBER = 2_147_483_647;

export type ImportTaskNumbers = {
  numbers: number[];
  lastNumber: number;
};

export function assignImportTaskNumbers(
  tasks: readonly { number?: number }[],
): ImportTaskNumbers {
  const limit = MAX_TASK_NUMBER - tasks.length;
  const kept = new Set<number>();
  const keeps = tasks.map(({ number }) => {
    if (
      number === undefined ||
      !Number.isSafeInteger(number) ||
      number < 1 ||
      number > limit ||
      kept.has(number)
    ) {
      return false;
    }
    kept.add(number);
    return true;
  });

  let last = 0;
  for (const number of kept) last = Math.max(last, number);

  const numbers = tasks.map(({ number }, index) =>
    keeps[index] && number !== undefined ? number : ++last,
  );
  return { numbers, lastNumber: last };
}
