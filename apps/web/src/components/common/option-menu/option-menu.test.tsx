import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OptionMenu } from "./option-menu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const options = [
  { value: "to-do", label: "To Do" },
  { value: "done", label: "Done", selected: true },
];

function renderMenu() {
  const onSelect = vi.fn();
  render(
    <OptionMenu
      label="Status"
      placeholder="Change status"
      options={options}
      onSelect={onSelect}
    />,
  );
  return { onSelect, input: screen.getByPlaceholderText("Change status") };
}

describe("OptionMenu", () => {
  it("picks an option by its number", () => {
    const { onSelect, input } = renderMenu();

    fireEvent.keyDown(input, { key: "2" });

    expect(onSelect).toHaveBeenCalledWith("done");
  });

  it("catches a number pressed before the menu has focus", () => {
    const { onSelect } = renderMenu();

    fireEvent.keyDown(document.body, { key: "1" });

    expect(onSelect).toHaveBeenCalledWith("to-do");
  });

  it("types digits into the search once a query exists", () => {
    const { onSelect, input } = renderMenu();

    fireEvent.change(input, { target: { value: "do" } });
    fireEvent.keyDown(input, { key: "1" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the current value", () => {
    renderMenu();

    expect(screen.getByRole("option", { name: "Done" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("option", { name: /To Do/ })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
