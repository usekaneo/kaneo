import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import AssigneeQuickFilter from "./assignee-quick-filter";
import { QUICK_FILTER_LIMIT } from "./quick-filter-members";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

afterEach(cleanup);

const members = Array.from({ length: QUICK_FILTER_LIMIT + 2 }, (_, i) => ({
  userId: `u${i}`,
  user: { name: `User ${i}` },
}));

it("toggles a person on and off and marks the selection", () => {
  const onToggle = vi.fn();
  const { rerender } = render(
    <AssigneeQuickFilter members={members} selected={[]} onToggle={onToggle} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "User 1" }));
  expect(onToggle).toHaveBeenCalledWith("u1");

  rerender(
    <AssigneeQuickFilter
      members={members}
      selected={["u1"]}
      onToggle={onToggle}
    />,
  );
  expect(screen.getByRole("button", { name: "User 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "User 1" }));
  expect(onToggle).toHaveBeenLastCalledWith("u1");
});

it("keeps the rest reachable behind a +N popover", async () => {
  const onToggle = vi.fn();
  render(
    <AssigneeQuickFilter members={members} selected={[]} onToggle={onToggle} />,
  );
  expect(
    screen.getByRole("button", { name: "tasks:boardFilters.unassigned" }),
  ).toBeInTheDocument();
  const last = `User ${QUICK_FILTER_LIMIT + 1}`;
  expect(screen.queryByRole("button", { name: last })).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "tasks:boardFilters.moreMembers:2" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: last }));
  expect(onToggle).toHaveBeenCalledWith(`u${QUICK_FILTER_LIMIT + 1}`);
});

it("shows a selected person in the row even past the limit", () => {
  const last = `u${QUICK_FILTER_LIMIT + 1}`;
  render(
    <AssigneeQuickFilter
      members={members}
      selected={[last]}
      onToggle={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: `User ${QUICK_FILTER_LIMIT + 1}` }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "tasks:boardFilters.moreMembers:1" }),
  ).toBeInTheDocument();
});

it("renders nothing without members", () => {
  const { container } = render(
    <AssigneeQuickFilter members={[]} selected={[]} onToggle={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});
