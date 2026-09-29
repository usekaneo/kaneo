export type DescriptionSaveState = "saved" | "saving" | "pending" | "failed";

type Entry = {
  ownerId: string;
  value: string;
  save: (value: string) => Promise<unknown>;
  state: DescriptionSaveState;
  timer?: ReturnType<typeof setTimeout>;
  running: boolean;
  version: number;
};

/** One request per task, with pending edits coalesced to the latest value. */
export function createDescriptionSaveQueue(delay = 700) {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const flush = async (id: string) => {
    const entry = entries.get(id);
    if (!entry || entry.running) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.running = true;
    entry.state = "saving";
    const version = entry.version;
    notify();
    try {
      await entry.save(entry.value);
      if (entries.get(id) !== entry) return;
      entry.running = false;
      if (entry.version !== version) {
        void flush(id);
      } else {
        entries.delete(id);
        notify();
      }
    } catch (error) {
      if (entries.get(id) !== entry) return;
      entry.running = false;
      console.error("Description save failed", {
        taskId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        status:
          error && typeof error === "object" && "status" in error
            ? error.status
            : undefined,
      });
      if (entry.version !== version) void flush(id);
      else {
        entry.state = "failed";
        notify();
      }
    }
  };
  return {
    schedule(id: string, value: string, save: Entry["save"], ownerId = "") {
      const current = entries.get(id);
      if (current?.timer && current.ownerId !== ownerId)
        clearTimeout(current.timer);
      const previous = current?.ownerId === ownerId ? current : undefined;
      if (previous?.timer) clearTimeout(previous.timer);
      const entry = previous ?? {
        ownerId,
        value,
        save,
        state: "pending",
        running: false,
        version: 0,
      };
      entry.value = value;
      entry.save = save;
      entry.version += 1;
      if (!entry.running) entry.state = "pending";
      entry.timer = setTimeout(() => void flush(id), delay);
      entries.set(id, entry);
      notify();
    },
    retry(id: string, ownerId = "") {
      if (entries.get(id)?.ownerId === ownerId) void flush(id);
    },
    get(id: string, ownerId = "") {
      const entry = entries.get(id);
      return entry?.ownerId === ownerId ? entry : undefined;
    },
    clear() {
      for (const entry of entries.values())
        if (entry.timer) clearTimeout(entry.timer);
      entries.clear();
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const descriptionSaveQueue = createDescriptionSaveQueue();
