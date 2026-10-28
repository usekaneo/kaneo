import { type Binding, type KeyCombo, matchesCombo } from "./key-combo";
import { isMacPlatform } from "./platform";

export type ShortcutScope = "global" | "view" | "task" | "overlay";

const RANK: Record<ShortcutScope, number> = {
  global: 0,
  view: 1,
  task: 2,
  overlay: 3,
};

const MODIFIER_KEYS = new Set(["Shift", "Meta", "Control", "Alt", "CapsLock"]);
const EDITABLE =
  "textarea, select, [contenteditable=''], [contenteditable='true'], .ProseMirror, input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit'])";
const CONTROL =
  "button, a[href], select, summary, [role='button'], [role='link'], [role='menuitem'], [role='option'], [role='checkbox'], [role='switch'], [role='tab']";
const CONTROL_KEYS = new Set(["enter", "space"]);
const POPUP =
  "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

export type ShortcutRegistration = {
  id?: string;
  bindings: Binding[];
  scope: ShortcutScope;
  allowInInput?: boolean;
  allowInPopup?: boolean;
  handler: (event: KeyboardEvent) => void;
};

type Entry = ShortcutRegistration & { token: number };
type PendingKey = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.contentEditable === "true")
  )
    return true;
  return Boolean(target.closest(EDITABLE));
}

function isInsideBlockingPopup(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const popup = target.closest(POPUP);
  return Boolean(
    popup &&
    !popup.hasAttribute("data-closed") &&
    !popup.closest("[data-shortcuts='allow']"),
  );
}

export function createShortcutRegistry(isMac: boolean, sequenceTimeout = 2000) {
  const entries = new Map<number, Entry>();
  const listeners = new Set<() => void>();
  let nextToken = 0;
  let pending: PendingKey | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;

  const setPending = (value: PendingKey | null) => {
    pending = value;
    clearTimeout(pendingTimer);
    if (value)
      pendingTimer = setTimeout(() => setPending(null), sequenceTimeout);
    for (const listener of listeners) listener();
  };

  const best = (candidates: Entry[]) =>
    candidates.reduce((winner, entry) =>
      RANK[entry.scope] > RANK[winner.scope] ||
      (RANK[entry.scope] === RANK[winner.scope] && entry.token > winner.token)
        ? entry
        : winner,
    );

  const run = (entry: Entry, event: KeyboardEvent) => {
    event.preventDefault();
    entry.handler(event);
  };

  const isChord = (binding: Binding) =>
    binding[0].mod || binding[0].ctrl || binding[0].alt;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return false;
    if (MODIFIER_KEYS.has(event.key)) return false;

    const editable = isEditableTarget(event.target);
    const control =
      event.target instanceof Element ? event.target.closest(CONTROL) : null;
    const onControl = Boolean(
      control && !control.hasAttribute("data-shortcut-surface"),
    );
    const popup = isInsideBlockingPopup(event.target);
    const eligible = [...entries.values()].filter(
      (entry) =>
        (!editable || entry.allowInInput) &&
        (!popup || entry.allowInPopup || entry.scope === "overlay"),
    );
    const matches = (combo: KeyCombo, key: PendingKey) =>
      matchesCombo(combo, key, isMac);
    const matching = (
      candidates: Entry[],
      test: (binding: Binding) => boolean,
    ) =>
      candidates.filter((entry) =>
        entry.bindings.some(
          (binding) =>
            (!editable || isChord(binding)) &&
            !(
              onControl &&
              !isChord(binding) &&
              CONTROL_KEYS.has(binding[0].key)
            ) &&
            test(binding),
        ),
      );

    if (pending) {
      const first = pending;
      setPending(null);
      const sequences = matching(
        eligible,
        (binding) =>
          binding.length === 2 &&
          matches(binding[0], first) &&
          matches(binding[1], event),
      );
      if (sequences.length > 0) {
        run(best(sequences), event);
        return true;
      }
    }

    const singles = matching(
      eligible,
      (binding) => binding.length === 1 && matches(binding[0], event),
    );
    if (singles.length > 0) {
      run(best(singles), event);
      return true;
    }

    const startsSequence = matching(
      eligible,
      (binding) => binding.length === 2 && matches(binding[0], event),
    );
    if (startsSequence.length > 0) {
      event.preventDefault();
      setPending({
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
      return true;
    }
    return false;
  };

  return {
    register(registration: ShortcutRegistration) {
      const token = nextToken++;
      entries.set(token, { ...registration, token });
      return () => {
        entries.delete(token);
      };
    },
    handleKeyDown,
    getPendingKey: () => pending?.key ?? null,
    getContinuations() {
      const first = pending;
      if (!first) return [];
      const found = new Map<string, KeyCombo>();
      for (const entry of entries.values()) {
        if (!entry.id || found.has(entry.id)) continue;
        const binding = entry.bindings.find(
          (candidate) =>
            candidate.length === 2 && matchesCombo(candidate[0], first, isMac),
        );
        if (binding) found.set(entry.id, binding[1]);
      }
      return [...found].map(([id, next]) => ({ id, next }));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      entries.clear();
      setPending(null);
    },
  };
}

export type ShortcutRegistry = ReturnType<typeof createShortcutRegistry>;

export const shortcutRegistry = createShortcutRegistry(isMacPlatform());
