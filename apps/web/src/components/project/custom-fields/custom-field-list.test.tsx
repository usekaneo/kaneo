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
import { CustomFieldList } from "@/components/project/custom-fields/custom-field-list";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";

const m = vi.hoisted(() => ({
  fields: [] as CustomFieldDefinition[] | undefined,
  isLoading: false,
  deleteField: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({
    default: () => ({ data: m.fields, isLoading: m.isLoading }),
  }),
);
vi.mock("@/hooks/mutations/custom-field/use-delete-custom-field", () => ({
  default: () => ({ mutateAsync: m.deleteField, isPending: false }),
}));
vi.mock("@/hooks/mutations/custom-field/use-reorder-custom-field", () => ({
  useReorderCustomFields: () => ({ mutateAsync: vi.fn() }),
}));

const size: CustomFieldDefinition = {
  id: "f1",
  projectId: "p1",
  name: "Size",
  type: "dropdown",
  required: true,
  defaultValue: "Medium",
  options: ["Small", "Medium", "Large"],
  position: 0,
  createdAt: "",
  updatedAt: "",
};

function renderList(canEdit = true) {
  const onCreate = vi.fn();
  const onEdit = vi.fn();
  render(
    <CustomFieldList
      projectId="p1"
      canEdit={canEdit}
      onCreate={onCreate}
      onEdit={onEdit}
    />,
  );
  return { onCreate, onEdit };
}

describe("CustomFieldList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.fields = [size];
    m.isLoading = false;
    m.deleteField.mockResolvedValue(size);
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });
  afterEach(cleanup);

  it("describes each field and marks required ones", () => {
    renderList();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(
      screen.getByText("settings:customFields.required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "settings:customFields.types.dropdown · Small, Medium, Large",
      ),
    ).toBeInTheDocument();
  });

  it("edits from the row menu and deletes only after confirming", async () => {
    const { onEdit } = renderList();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:customFields.actionsAria" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:customFields.edit",
      }),
    );
    expect(onEdit).toHaveBeenCalledWith(size);

    fireEvent.click(
      screen.getByRole("button", { name: "settings:customFields.actionsAria" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "common:actions.delete" }),
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(
      within(confirm).getByText("settings:customFields.deleteDescription"),
    ).toBeInTheDocument();
    expect(m.deleteField).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:customFields.deleteConfirm",
      }),
    );
    await waitFor(() =>
      expect(m.deleteField).toHaveBeenCalledWith({ id: "f1" }),
    );
  });

  it("offers a new field from the empty state", () => {
    m.fields = [];
    const { onCreate } = renderList();
    expect(
      screen.getByText("settings:customFields.emptyTitle"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectCustomFields.newField",
      }),
    );
    expect(onCreate).toHaveBeenCalled();
  });

  it("hides editing controls without permission", () => {
    renderList(false);
    expect(
      screen.queryByRole("button", {
        name: "settings:customFields.actionsAria",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "settings:customFields.dragAria" }),
    ).toBeNull();
  });

  it("shows skeleton rows while loading", () => {
    m.fields = undefined;
    m.isLoading = true;
    const { container } = render(
      <CustomFieldList
        projectId="p1"
        canEdit
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("settings:customFields.emptyTitle")).toBeNull();
  });
});
