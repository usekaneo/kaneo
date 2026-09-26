import { useEffect, useRef, useState } from "react";

type Value = string | string[];
type Values = Record<string, Value>;

export function useCustomFieldDrafts(
  taskId: string | undefined,
  serverValues: Values,
) {
  const [values, setValues] = useState<Values>(serverValues);
  const dirty = useRef(new Map<string, Value>());
  const currentTask = useRef(taskId);
  useEffect(() => {
    if (currentTask.current !== taskId) {
      currentTask.current = taskId;
      dirty.current.clear();
    }
    setValues((previous) =>
      Object.fromEntries(
        Object.entries(serverValues).map(([id, value]) => [
          id,
          dirty.current.has(id) ? previous[id] : value,
        ]),
      ),
    );
  }, [taskId, serverValues]);

  const change = (id: string, value: Value) => {
    dirty.current.set(id, value);
    setValues((previous) => ({ ...previous, [id]: value }));
  };
  const finish = (id: string, submitted: Value, rollback?: Value) => {
    // A response for an older save must not erase a newer edit or another task's draft.
    if (currentTask.current !== taskId || dirty.current.get(id) !== submitted)
      return;
    dirty.current.delete(id);
    if (rollback !== undefined)
      setValues((previous) => ({ ...previous, [id]: rollback }));
  };
  return { values, change, finish };
}
