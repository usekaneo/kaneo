import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { DateFilterEditor } from "./date-filter-editor";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);

it("requires a calendar selection before applying", () => {
  const onApply = vi.fn();
  render(<DateFilterEditor selected={[]} onApply={onApply} />);
  const apply = screen.getByRole("button", { name: "tasks:dateFilter.apply" });
  expect(apply).toBeDisabled();
  expect(screen.getByRole("grid")).toBeVisible();
});

it("edits an exact date with the shared calendar", () => {
  const onApply = vi.fn();
  render(
    <DateFilterEditor selected={["exact:2026-10-01"]} onApply={onApply} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /October 15th, 2026/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:dateFilter.apply" }),
  );
  expect(onApply).toHaveBeenCalledWith("exact:2026-10-15");
});

it("clears an invalid end date and selects a new range endpoint", () => {
  const onApply = vi.fn();
  render(
    <DateFilterEditor
      selected={["range:2026-10-01:2026-10-15"]}
      onApply={onApply}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /October 20th, 2026/ }));
  const apply = screen.getByRole("button", { name: "tasks:dateFilter.apply" });
  expect(apply).toBeDisabled();
  expect(
    screen.getByRole("button", { name: /October 19th, 2026/ }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /October 25th, 2026/ }));
  fireEvent.click(apply);
  expect(onApply).toHaveBeenCalledWith("range:2026-10-20:2026-10-25");
});

it("switches conditions without losing the selected date", async () => {
  const onApply = vi.fn();
  render(
    <DateFilterEditor selected={["exact:2026-10-01"]} onApply={onApply} />,
  );

  fireEvent.click(
    screen.getByRole("combobox", { name: "tasks:dateFilter.condition" }),
  );
  fireEvent.pointerDown(
    await screen.findByRole("option", { name: "tasks:dateFilter.before" }),
  );
  fireEvent.click(
    screen.getByRole("option", { name: "tasks:dateFilter.before" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:dateFilter.apply" }),
  );

  expect(onApply).toHaveBeenCalledWith("before:2026-10-01");
  expect(
    screen.queryByRole("button", { pressed: true }),
  ).not.toBeInTheDocument();
});

it("shows endpoint controls only for a range and retains both dates", async () => {
  const onApply = vi.fn();
  render(
    <DateFilterEditor
      selected={["range:2026-10-01:2026-10-15"]}
      onApply={onApply}
    />,
  );
  const condition = screen.getByRole("combobox", {
    name: "tasks:dateFilter.condition",
  });
  expect(screen.getByRole("button", { name: "Oct 15, 2026" })).toBeVisible();
  fireEvent.click(condition);
  fireEvent.pointerDown(
    await screen.findByRole("option", { name: "tasks:dateFilter.after" }),
  );
  fireEvent.click(
    screen.getByRole("option", { name: "tasks:dateFilter.after" }),
  );
  expect(
    screen.queryByRole("button", { name: "Oct 15, 2026" }),
  ).not.toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  fireEvent.click(condition);
  fireEvent.pointerDown(
    await screen.findByRole("option", { name: "tasks:dateFilter.range" }),
  );
  fireEvent.click(
    screen.getByRole("option", { name: "tasks:dateFilter.range" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:dateFilter.apply" }),
  );

  expect(onApply).toHaveBeenCalledWith("range:2026-10-01:2026-10-15");
});
