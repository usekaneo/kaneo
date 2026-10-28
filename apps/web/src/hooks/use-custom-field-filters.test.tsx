import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useTaskCardFields } from "@/components/custom-fields/use-task-card-fields";
import getCustomFieldValuesByProject from "@/fetchers/custom-field/get-custom-field-values-by-project";
import setCustomFieldValue from "@/fetchers/custom-field/set-custom-field-value";
import type Task from "@/types/task";
import useSetCustomFieldValue from "./mutations/custom-field/use-set-custom-field-value";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

vi.mock("@/fetchers/custom-field/get-custom-field-values-by-project");
vi.mock("@/fetchers/custom-field/set-custom-field-value");
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

type ProjectValue = Awaited<
  ReturnType<typeof getCustomFieldValuesByProject>
>[number];

const value: ProjectValue = {
  id: "value-1",
  taskId: "unopened-task",
  fieldId: "size",
  value: "L",
  fieldName: "Size",
  fieldPosition: 0,
  fieldType: "dropdown",
  fieldOptions: ["S", "L"],
};
const task: Task = {
  id: value.taskId,
  title: "Unopened task",
  projectId: "project-1",
  number: 1,
  description: null,
  status: "to-do",
  priority: "high",
  position: 0,
  createdAt: "2026-10-01T00:00:00Z",
  startDate: null,
  dueDate: null,
  userId: null,
  assigneeId: null,
  assigneeName: null,
  labels: [],
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetAllMocks();
});
afterEach(() => window.localStorage.clear());

function saveFilter(negated = false) {
  window.localStorage.setItem(
    "kaneo:board-filters:project-1",
    JSON.stringify({
      customFields: { size: ["L"] },
      priority: ["high"],
      negated: negated ? ["customField:size"] : null,
    }),
  );
}

describe("custom-field filters with project queries", () => {
  it("does not fetch project values when no custom-field filter is active", () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(null, "project-1"),
      { wrapper },
    );
    expect(result.current.filterTasks([task])).toEqual([task]);
    expect(result.current.customFieldValues.isLoading).toBe(false);
    expect(getCustomFieldValuesByProject).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "waits for values of unopened tasks with negation=%s and shares the card request",
    async (negated) => {
      saveFilter(negated);
      const { client, wrapper } = setup();
      let resolve!: (values: ProjectValue[]) => void;
      const pending = new Promise<ProjectValue[]>((done) => {
        resolve = done;
      });
      vi.mocked(getCustomFieldValuesByProject).mockReturnValue(pending);
      const { result, rerender } = renderHook(
        () => {
          const filters = useTaskFiltersWithLabelsSupport(null, "project-1");
          useTaskCardFields("project-1", task.id);
          return filters;
        },
        { wrapper },
      );

      expect(result.current.customFieldValues.isLoading).toBe(true);
      expect(result.current.filterTasks([task])).toEqual([task]);
      expect(
        result.current.filterTasks([{ ...task, priority: "low" }]),
      ).toEqual([]);
      expect(result.current.filters.customFields).toEqual({ size: ["L"] });
      rerender();
      expect(getCustomFieldValuesByProject).toHaveBeenCalledTimes(1);
      expect(
        client.getQueryData(["custom-field-values", task.id]),
      ).toBeUndefined();

      await act(async () => resolve([value]));
      await waitFor(() => {
        expect(result.current.customFieldValues.isLoading).toBe(false);
        expect(result.current.filterTasks([task])).toHaveLength(
          negated ? 0 : 1,
        );
      });
    },
  );

  it("reports a failed initial request and reapplies saved filters after retry", async () => {
    saveFilter();
    const { wrapper } = setup();
    vi.mocked(getCustomFieldValuesByProject).mockRejectedValueOnce(
      new Error("offline"),
    );
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(null, "project-1"),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.customFieldValues.isError).toBe(true),
    );
    expect(result.current.filterTasks([task])).toEqual([task]);
    expect(result.current.filters.customFields).toEqual({ size: ["L"] });

    vi.mocked(getCustomFieldValuesByProject).mockResolvedValue([]);
    await act(async () => {
      await result.current.customFieldValues.retry();
    });
    await waitFor(() => {
      expect(result.current.customFieldValues.isError).toBe(false);
      expect(result.current.filterTasks([task])).toEqual([]);
    });
  });

  it("keeps cached matches on a failed refresh", async () => {
    saveFilter();
    const { client, wrapper } = setup();
    client.setQueryData(["custom-field-values", "project-1"], [value]);
    vi.mocked(getCustomFieldValuesByProject).mockRejectedValue(
      new Error("offline"),
    );
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(null, "project-1"),
      { wrapper },
    );
    await act(async () => {
      await result.current.customFieldValues.retry();
    });
    await waitFor(() =>
      expect(result.current.customFieldValues.isError).toBe(true),
    );
    expect(result.current.customFieldValues.hasData).toBe(true);
    expect(result.current.filterTasks([task])).toEqual([task]);
  });

  it("refetches the shared project values after a value mutation and updates matches", async () => {
    saveFilter();
    const { client, wrapper } = setup();
    client.setQueryData(["custom-field-values", "project-1"], [value]);
    vi.mocked(getCustomFieldValuesByProject).mockResolvedValue([
      { ...value, value: "S" },
    ]);
    vi.mocked(setCustomFieldValue).mockResolvedValue({
      id: value.id,
      taskId: task.id,
      fieldId: "size",
      value: "S",
    });
    const { result } = renderHook(
      () => ({
        filters: useTaskFiltersWithLabelsSupport(null, "project-1"),
        mutation: useSetCustomFieldValue(),
      }),
      { wrapper },
    );
    expect(result.current.filters.filterTasks([task])).toEqual([task]);

    await act(async () => {
      await result.current.mutation.mutateAsync({
        taskId: task.id,
        fieldId: "size",
        value: "S",
        projectId: "project-1",
      });
    });
    await waitFor(() =>
      expect(result.current.filters.filterTasks([task])).toEqual([]),
    );
    expect(getCustomFieldValuesByProject).toHaveBeenCalledTimes(1);
  });
});
