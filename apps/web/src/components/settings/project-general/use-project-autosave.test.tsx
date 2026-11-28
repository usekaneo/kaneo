import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type { UpdateProjectRequest } from "@/fetchers/project/update-project";
import type { ProjectWithTasks } from "@/types/project";
import { useProjectAutosave } from "./use-project-autosave";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  error: vi.fn(),
  t: (key: string) => key,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@/hooks/mutations/project/use-update-project", () => ({
  default: () => ({ mutateAsync: mocks.update }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));

const initial = {
  id: "p",
  name: "Project",
  slug: "PROJ",
  description: "",
  icon: "Layout",
  isPublic: false,
  includeSubtasks: true,
};
let server = { ...initial };

function setup() {
  const queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ project }) =>
      useProjectAutosave({ project, workspaceId: "workspace", canEdit: true }),
    {
      initialProps: { project: { ...initial } as unknown as ProjectWithTasks },
      wrapper,
    },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  server = { ...initial };
  mocks.update.mockReset();
  mocks.error.mockReset();
  mocks.update.mockImplementation(async (data: UpdateProjectRequest) => {
    server = { ...server, ...data };
    return server;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("omits an untouched subtask default even when another user changes it without a refresh", async () => {
  const { result } = setup();
  server.includeSubtasks = false;
  act(() =>
    result.current.form.setValue("name", "Renamed", { shouldDirty: true }),
  );
  await act(async () => {
    expect(await result.current.flushPendingSave()).toBe(true);
  });
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("includeSubtasks");
  expect(server.includeSubtasks).toBe(false);
  expect(result.current.form.getValues("includeSubtasks")).toBe(false);
});

it("refreshes untouched fields while preserving local edits, without making the switch an edit", async () => {
  const { result, rerender } = setup();
  act(() =>
    result.current.form.setValue("name", "Local name", { shouldDirty: true }),
  );
  server = {
    ...server,
    includeSubtasks: false,
    slug: "REMOTE",
    description: "Remote description",
  };
  rerender({ project: { ...server } as unknown as ProjectWithTasks });
  expect(result.current.form.getValues()).toMatchObject({
    name: "Local name",
    slug: "REMOTE",
    description: "Remote description",
    includeSubtasks: false,
  });
  expect(result.current.form.getFieldState("includeSubtasks").isDirty).toBe(
    false,
  );
  await act(async () => {
    await result.current.flushPendingSave();
  });
  expect(mocks.update.mock.calls[0][0]).toMatchObject({
    name: "Local name",
    slug: "REMOTE",
  });
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("includeSubtasks");
});

it("preserves and sends an explicitly edited switch across refreshes, then omits it from later saves", async () => {
  const { result, rerender } = setup();
  act(() =>
    result.current.form.setValue("includeSubtasks", false, {
      shouldDirty: true,
    }),
  );
  rerender({
    project: {
      ...server,
      description: "Refreshed",
    } as unknown as ProjectWithTasks,
  });
  expect(result.current.form.getValues("includeSubtasks")).toBe(false);
  await act(async () => {
    await result.current.flushPendingSave();
  });
  expect(mocks.update.mock.calls[0][0]).toHaveProperty(
    "includeSubtasks",
    false,
  );
  act(() =>
    result.current.form.setValue("name", "Next name", { shouldDirty: true }),
  );
  await act(async () => {
    await result.current.flushPendingSave();
  });
  expect(mocks.update.mock.calls[1][0]).not.toHaveProperty("includeSubtasks");
});

it("omits a switch reverted before saving", async () => {
  const { result } = setup();
  act(() =>
    result.current.form.setValue("includeSubtasks", false, {
      shouldDirty: true,
    }),
  );
  act(() =>
    result.current.form.setValue("includeSubtasks", true, {
      shouldDirty: true,
    }),
  );
  act(() =>
    result.current.form.setValue("name", "Renamed", { shouldDirty: true }),
  );
  await act(async () => {
    await result.current.flushPendingSave();
  });
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("includeSubtasks");
});

it("does not lose a switch reverted while its earlier value is being saved", async () => {
  const { result } = setup();
  let finish!: (value: typeof initial) => void;
  mocks.update.mockImplementationOnce(
    () =>
      new Promise<typeof initial>((resolve) => {
        finish = resolve;
      }),
  );
  act(() =>
    result.current.form.setValue("includeSubtasks", false, {
      shouldDirty: true,
    }),
  );
  act(() =>
    result.current.form.setValue("name", "Saved name", { shouldDirty: true }),
  );
  let saving!: Promise<boolean>;
  await act(async () => {
    saving = result.current.flushPendingSave();
  });
  expect(mocks.update).toHaveBeenCalledTimes(1);
  act(() =>
    result.current.form.setValue("includeSubtasks", true, {
      shouldDirty: true,
    }),
  );
  let queued!: Promise<boolean>;
  await act(async () => {
    queued = result.current.flushPendingSave();
  });
  await act(async () => {
    server = { ...server, name: "Saved name", includeSubtasks: false };
    finish({ ...server });
    await saving;
    await queued;
  });
  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(mocks.update.mock.calls[1][0]).toHaveProperty("includeSubtasks", true);
  expect(result.current.form.getValues("includeSubtasks")).toBe(true);
  expect(server.name).toBe("Saved name");
});

it("uses refreshed values when the pending debounce fires", async () => {
  const { result, rerender } = setup();
  act(() =>
    result.current.form.setValue("name", "Renamed", { shouldDirty: true }),
  );
  server = { ...server, slug: "REMOTE", includeSubtasks: false };
  rerender({ project: { ...server } as unknown as ProjectWithTasks });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(mocks.update.mock.calls[0][0]).toMatchObject({
    name: "Renamed",
    slug: "REMOTE",
  });
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("includeSubtasks");
});
