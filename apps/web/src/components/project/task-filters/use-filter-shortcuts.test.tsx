import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import type { FilterSubject } from "./filter-subject";
import { useFilterShortcuts } from "./use-filter-shortcuts";

const subject = (id: string, selected: string[]) =>
  ({ id, selected, onClear: vi.fn() }) as unknown as FilterSubject;

function Harness({
  subjects,
  clearFilters,
}: {
  subjects: FilterSubject[];
  clearFilters: () => void;
}) {
  useFilterShortcuts(subjects, clearFilters);
  return null;
}

function renderFilters(subjects: FilterSubject[], clearFilters = vi.fn()) {
  const view = (next: FilterSubject[]) => (
    <ShortcutTestWrapper>
      <Harness subjects={next} clearFilters={clearFilters} />
    </ShortcutTestWrapper>
  );
  const { rerender } = render(view(subjects));
  return {
    clearFilters,
    update: (next: FilterSubject[]) => rerender(view(next)),
  };
}

const press = (init: KeyboardEventInit) =>
  fireEvent.keyDown(document.body, init);

afterEach(() => {
  cleanup();
  shortcutRegistry.reset();
});

describe("useFilterShortcuts", () => {
  it("clears the most recently added filter with Shift+F", () => {
    const status = subject("status", ["todo"]);
    const priority = subject("priority", []);
    const { update } = renderFilters([status, priority]);
    const withPriority = subject("priority", ["high"]);
    update([status, withPriority]);

    press({ key: "F", code: "KeyF", shiftKey: true });

    expect(withPriority.onClear).toHaveBeenCalledTimes(1);
    expect(status.onClear).not.toHaveBeenCalled();
  });

  it("clears every filter with Alt+Shift+F", () => {
    const { clearFilters } = renderFilters([subject("status", ["todo"])]);

    press({ key: "Ï", code: "KeyF", altKey: true, shiftKey: true });

    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it("stays off without active filters", () => {
    const { clearFilters } = renderFilters([subject("status", [])]);

    press({ key: "Ï", code: "KeyF", altKey: true, shiftKey: true });

    expect(clearFilters).not.toHaveBeenCalled();
  });
});
