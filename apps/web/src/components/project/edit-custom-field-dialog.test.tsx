vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditCustomFieldDialog from "./edit-custom-field-dialog";

const { mutateAsync, success } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, args?: { number: number }) =>
      args ? `${key} ${args.number}` : key,
  }),
}));
vi.mock("@/hooks/mutations/custom-field/use-update-custom-field", () => ({
  default: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success } }));
const field = {
  id: "field",
  projectId: "project",
  name: "People",
  type: "multiselect" as const,
  required: false,
  defaultValue: null,
  options: ["Alice", "Bob"],
  hiddenOptions: [],
  position: 0,
  createdAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("edit custom field dialog", () => {
  it("retains option identity when renaming and saves the loaded version", async () => {
    const onClose = vi.fn();
    mutateAsync.mockResolvedValue({});
    render(<EditCustomFieldDialog field={field} onClose={onClose} />);
    fireEvent.change(
      screen.getByLabelText("settings:customFields.namePlaceholder"),
      { target: { value: "Attendees" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:customFields.optionLabel 1"),
      { target: { value: "Alex" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:customFields.saveButton" }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith({
      param: { id: "field" },
      json: {
        name: "Attendees",
        updatedAt: field.updatedAt,
        options: [
          { originalValue: "Alice", value: "Alex", hidden: false },
          { originalValue: "Bob", value: "Bob", hidden: false },
        ],
      },
    });
  });
  it("cancels without saving", () => {
    const onClose = vi.fn();
    render(<EditCustomFieldDialog field={field} onClose={onClose} />);
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.cancel" }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
  it("prevents duplicate or missing option names", () => {
    render(<EditCustomFieldDialog field={field} onClose={vi.fn()} />);
    const save = screen.getByRole("button", {
      name: "settings:customFields.saveButton",
    });
    fireEvent.change(
      screen.getByLabelText("settings:customFields.optionLabel 1"),
      { target: { value: " Bob " } },
    );
    expect(save).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText("settings:customFields.optionLabel 1"),
      { target: { value: " " } },
    );
    expect(save).toBeDisabled();
  });
  it("keeps the editor and changes open when the server rejects deletion", async () => {
    const onClose = vi.fn();
    mutateAsync.mockRejectedValue(new Error("Option is in use"));
    render(
      <EditCustomFieldDialog
        field={{ ...field, options: ["Alice", "Bob", "Chris"] }}
        onClose={onClose}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:customFields.removeOption 3",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:customFields.saveButton" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "settings:customFields.updateError",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });
});

it("toggles option visibility independently of deletion", async () => {
  mutateAsync.mockResolvedValue({});
  render(<EditCustomFieldDialog field={field} onClose={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: "settings:customFields.hideOption 1" }),
  );
  expect(
    screen.getByRole("button", { name: "settings:customFields.showOption 1" }),
  ).toBeVisible();
  expect(
    screen.getByLabelText("settings:customFields.optionLabel 1"),
  ).toHaveValue("Alice");
  fireEvent.click(
    screen.getByRole("button", { name: "settings:customFields.saveButton" }),
  );
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({
          options: [
            { originalValue: "Alice", value: "Alice", hidden: true },
            { originalValue: "Bob", value: "Bob", hidden: false },
          ],
        }),
      }),
    ),
  );
});
