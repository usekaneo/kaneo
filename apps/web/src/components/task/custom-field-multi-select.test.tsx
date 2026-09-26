import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomFieldMultiSelect from "./custom-field-multi-select";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);
const options = [
  "Alexandra Example — Vorstand und Projektkoordination",
  "Benjamin Example — Stellvertretender Vorsitzender",
];

describe("custom field multi-select", () => {
  it("exposes an accessible trigger and keeps full option labels while selecting multiple values", async () => {
    const commit = vi.fn();
    function Fixture() {
      const [value, setValue] = useState([options[0]]);
      return (
        <CustomFieldMultiSelect
          name="Attendees"
          options={options}
          value={value}
          onChange={setValue}
          onCommit={commit}
        />
      );
    }
    render(<Fixture />);
    const trigger = screen.getByRole("combobox", { name: "Attendees" });
    fireEvent.click(trigger);
    const second = await screen.findByRole("option", { name: options[1] });
    fireEvent.keyDown(second, { key: "Enter" });
    fireEvent.keyUp(second, { key: "Enter" });
    await waitFor(() =>
      expect(second).toHaveAttribute("aria-selected", "true"),
    );
    fireEvent.keyDown(second, { key: "Escape" });
    await waitFor(() => expect(commit).toHaveBeenCalledWith(options));
    expect(trigger).toHaveTextContent(options.join(", "));
  });
  it("disables editing for read-only users", () => {
    render(
      <CustomFieldMultiSelect
        name="Attendees"
        options={options}
        value={[]}
        disabled
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Attendees" })).toBeDisabled();
  });
});

it("keeps hidden selections readable and removable outside the menu", async () => {
  const commit = vi.fn();
  function Fixture() {
    const [value, setValue] = useState([options[0]]);
    return (
      <CustomFieldMultiSelect
        name="Attendees"
        options={options}
        hiddenOptions={[options[0]]}
        value={value}
        onChange={setValue}
        onCommit={commit}
      />
    );
  }
  render(<Fixture />);
  expect(screen.getByRole("listitem")).toHaveTextContent(options[0]);
  fireEvent.click(screen.getByRole("combobox", { name: "Attendees" }));
  expect(await screen.findByRole("option", { name: options[1] })).toBeVisible();
  expect(
    screen.queryByRole("option", { name: options[0] }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("option", { name: options[1] }), {
    key: "Escape",
  });
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:customFields.removeHiddenSelection",
    }),
  );
  expect(commit).toHaveBeenLastCalledWith([]);
});
