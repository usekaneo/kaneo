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
  useTranslation: () => ({ t: () => "Select option" }),
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
