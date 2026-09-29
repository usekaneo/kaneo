export type DescriptionSaveState = "saved" | "saving" | "pending" | "failed";

type Entry = {
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
      entry.running = false;
      if (entry.version !== version) {
        void flush(id);
      } else {
        entries.delete(id);
        notify();
      }
    } catch {
      entry.running = false;
      entry.state = "failed";
      notify();
    }
  };
  return {
    schedule(id: string, value: string, save: Entry["save"]) {
      const previous = entries.get(id);
      if (previous?.timer) clearTimeout(previous.timer);
      const entry = previous ?? {
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
    retry(id: string) {
      void flush(id);
    },
    get(id: string) {
      return entries.get(id);
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
