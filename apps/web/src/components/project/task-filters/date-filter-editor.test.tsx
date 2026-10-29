import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
