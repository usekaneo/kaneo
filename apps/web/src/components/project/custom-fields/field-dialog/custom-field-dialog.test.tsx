import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { CustomFieldDialog } from "@/components/project/custom-fields/field-dialog/custom-field-dialog";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { toast } from "@/lib/toast";

const m = vi.hoisted(() => ({
  createField: vi.fn(),
  updateField: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => 1,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/mutations/custom-field/use-create-custom-field", () => ({
  default: () => ({ mutateAsync: m.createField, isPending: false }),
}));
vi.mock("@/hooks/mutations/custom-field/use-update-custom-field", () => ({
  default: () => ({ mutateAsync: m.updateField, isPending: false }),
}));

const platforms: CustomFieldDefinition = {
  id: "f1",
  projectId: "p1",
  name: "Platforms",
  type: "multiselect",
  required: false,
  defaultValue: '["Web"]',
  options: ["iOS", "Web"],
  position: 0,
  createdAt: "",
  updatedAt: "",
};

function renderDialog(field: CustomFieldDefinition | null = null) {
  const onOpenChange = vi.fn();
  render(
    <CustomFieldDialog
      projectId="p1"
      projectName="Website"
      field={field}
      open
      onOpenChange={onOpenChange}
    />,
  );
  return { dialog: screen.getByRole("dialog"), onOpenChange };
}

describe("CustomFieldDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.createField.mockResolvedValue({});
    m.updateField.mockResolvedValue({});
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("creates a dropdown with options added from the keyboard", async () => {
    const { dialog, onOpenChange } = renderDialog();
    const create = within(dialog).getByRole("button", {
      name: "settings:customFields.createField",
    });
    expect(create).toBeDisabled();

    fireEvent.click(
      within(dialog).getByRole("radio", {
        name: "settings:customFields.types.dropdown",
      }),
    );
    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: "settings:customFields.nameLabel",
      }),
      { target: { value: " Size " } },
    );
    expect(
      within(dialog).getByText("settings:customFields.issues.optionsRequired"),
    ).toBeInTheDocument();

    const addOption = within(dialog).getByRole("textbox", {
      name: "settings:customFields.addOption",
    });
    for (const option of ["Small", "Large", "Small"]) {
      fireEvent.change(addOption, { target: { value: option } });
      fireEvent.keyDown(addOption, { key: "Enter" });
    }
    expect(
      within(dialog).getAllByRole("textbox", {
        name: "settings:customFields.renameOptionAria",
      }),
    ).toHaveLength(2);

    fireEvent.click(create);
    await waitFor(() =>
      expect(m.createField).toHaveBeenCalledWith({
        projectId: "p1",
        name: "Size",
        type: "dropdown",
        required: false,
        defaultValue: undefined,
        options: ["Small", "Large"],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "settings:customFields.createSuccess",
      { icon: expect.anything() },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("needs a default before a field can be required", () => {
    const { dialog } = renderDialog();
    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: "settings:customFields.nameLabel",
      }),
      { target: { value: "Customer" } },
    );
    fireEvent.click(
      within(dialog).getByRole("switch", {
        name: "settings:customFields.required",
      }),
    );
    expect(
      within(dialog).getByText("settings:customFields.issues.defaultRequired"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "settings:customFields.createField",
      }),
    ).toBeDisabled();
  });

  it("locks the type when editing and saves with the update endpoint", async () => {
    const { dialog } = renderDialog(platforms);
    expect(
      within(dialog).getByText("settings:customFields.typeLocked"),
    ).toBeInTheDocument();
    const dropdown = within(dialog).getByRole("radio", {
      name: "settings:customFields.types.dropdown",
    });
    expect(dropdown).toHaveAttribute("aria-checked", "true");
    expect(dropdown).toHaveAttribute("data-disabled");

    fireEvent.click(
      within(dialog).getAllByRole("button", {
        name: "settings:customFields.removeOptionAria",
      })[1],
    );
    const addOption = within(dialog).getByRole("textbox", {
      name: "settings:customFields.addOption",
    });
    fireEvent.change(addOption, { target: { value: "Android" } });
    fireEvent.keyDown(addOption, { key: "Enter" });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:customFields.save",
      }),
    );
    await waitFor(() =>
      expect(m.updateField).toHaveBeenCalledWith({
        id: "f1",
        data: {
          name: "Platforms",
          type: "multiselect",
          required: false,
          defaultValue: null,
          options: ["iOS", "Android"],
        },
      }),
    );
    expect(m.createField).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the API error", async () => {
    m.updateField.mockRejectedValue(
      new Error('Can\'t remove "Web" because tasks still use it.'),
    );
    const { dialog, onOpenChange } = renderDialog(platforms);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:customFields.save",
      }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Can\'t remove "Web" because tasks still use it.',
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
