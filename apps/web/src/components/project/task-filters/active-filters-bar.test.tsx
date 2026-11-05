import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ActiveFiltersBar } from "./active-filters-bar";
import type { FilterSubject } from "./filter-subject";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));

afterEach(cleanup);

const subject = (overrides: Partial<FilterSubject>): FilterSubject => ({
  id: "priority",
  label: "Priority",
  icon: null,
  kind: "core",
  operators: { positive: "is any of", negative: "is none of" },
  options: [
    { value: "high", label: "High" },
    { value: "low", label: "Low" },
  ],
  selected: [],
  negated: false,
  onToggle: vi.fn(),
  onNegate: vi.fn(),
  onClear: vi.fn(),
  emptyLabel: "None",
  ...overrides,
});

it("renders nothing without active filters", () => {
  const { container } = render(
    <ActiveFiltersBar subjects={[subject({})]} onClear={vi.fn()} />,
  );
  expect(container.firstChild).toBeNull();
});

it("shows subject, operator and values, and clears them", () => {
  const onClearSubject = vi.fn();
  const onClearAll = vi.fn();
  render(
    <ActiveFiltersBar
      subjects={[
        subject({ selected: ["high", "low"], onClear: onClearSubject }),
      ]}
      onClear={onClearAll}
    />,
  );

  expect(screen.getByText("Priority")).toBeVisible();
  expect(screen.getByRole("button", { name: "is any of" })).toBeVisible();
  expect(screen.getByRole("button", { name: "High, Low" })).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", {
      name: "tasks:filterBar.removeFilter:Priority",
    }),
  );
  expect(onClearSubject).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", { name: "common:actions.clearAll" }),
  );
  expect(onClearAll).toHaveBeenCalledOnce();
});

it("shows the negative operator for an excluded subject", () => {
  render(
    <ActiveFiltersBar
      subjects={[subject({ selected: ["high"], negated: true })]}
      onClear={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "is none of" })).toBeVisible();
});

it("closes the date filter popup after applying from an active chip", async () => {
  const onDateApply = vi.fn();
  render(
    <ActiveFiltersBar
      subjects={[
        subject({
          id: "startDate",
          label: "Start date",
          selected: ["exact:2026-10-15"],
          options: [{ value: "exact:2026-10-15", label: "On Oct 15, 2026" }],
          onDateApply,
        }),
      ]}
      onClear={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "On Oct 15, 2026" }));
  expect(await screen.findByRole("grid")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:dateFilter.apply" }),
  );
  expect(onDateApply).toHaveBeenCalledWith("exact:2026-10-15");
  await waitFor(() =>
    expect(screen.queryByRole("grid")).not.toBeInTheDocument(),
  );
});

it("announces pending custom-field values without losing the selected filter", () => {
  render(
    <ActiveFiltersBar
      subjects={[subject({ id: "customField:size", selected: ["high"] })]}
      onClear={vi.fn()}
      customFieldValues={{
        hasData: false,
        isLoading: true,
        isError: false,
        retry: vi.fn(),
      }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "tasks:filterBar.customFieldsLoading",
  );
  expect(screen.getByRole("button", { name: "High" })).toBeVisible();
});

it.each([false, true])(
  "explains failed custom-field requests and retries with cached data=%s",
  (hasData) => {
    const retry = vi.fn();
    render(
      <ActiveFiltersBar
        subjects={[subject({ selected: ["high"] })]}
        onClear={vi.fn()}
        customFieldValues={{ hasData, isLoading: false, isError: true, retry }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      hasData
        ? "tasks:filterBar.customFieldsRefreshError"
        : "tasks:filterBar.customFieldsUnavailable",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(retry).toHaveBeenCalledOnce();
  },
);
