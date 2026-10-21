import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OptionMenu } from "./option-menu";
import type { OptionMenuItem } from "./option-menu-item";
import { assigneeMenuOptions } from "@/components/task/menus/assignee-menu-options";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const options = [
  { value: "to-do", label: "To Do" },
  { value: "done", label: "Done", selected: true },
];

function renderMenu(items: OptionMenuItem[] = options) {
  const onSelect = vi.fn();
  render(
    <OptionMenu
      label="Status"
      placeholder="Change status"
      options={items}
      onSelect={onSelect}
    />,
  );
  return { onSelect, input: screen.getByPlaceholderText("Change status") };
}

describe("OptionMenu", () => {
  it("finds named assignees by email without displaying their email", () => {
    const { onSelect, input } = renderMenu(
      assigneeMenuOptions(
        [
          { id: "alice", name: "Alice Adams", email: "alice@example.com" },
          { id: "bob", name: "Bob Brown", email: "bob@example.com" },
        ],
        null,
        "Unassigned",
      ),
    );

    fireEvent.change(input, { target: { value: "  ALICE@EXAMPLE.COM  " } });
    expect(
      screen.getByRole("option", { name: "Alice Adams" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Bob Brown" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("alice");
  });

  it("finds members beyond the visible options and still supports unassigning", () => {
    const members = Array.from({ length: 50 }, (_, index) => ({
      id: `member-${index}`,
      name: `Person ${index}`,
      email: `user${index}@example.com`,
    }));
    const { onSelect, input } = renderMenu(
      assigneeMenuOptions(members, "member-49", "Unassigned"),
    );
    fireEvent.change(input, { target: { value: "user49@" } });
    fireEvent.click(screen.getByRole("option", { name: "Person 49" }));
    expect(onSelect).toHaveBeenCalledWith("member-49");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("option", { name: "Unassigned" }));
    expect(onSelect).toHaveBeenLastCalledWith("");
  });
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
