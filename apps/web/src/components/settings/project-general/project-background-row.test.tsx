import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { ProjectBackgroundRow } from "./project-background-row";

const m = vi.hoisted(() => ({
  config: undefined as { hasImageUploads: boolean } | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: m.config }),
}));
vi.mock("@/hooks/mutations/project/use-upload-project-background", () => ({
  default: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/project/use-remove-project-background", () => ({
  default: () => ({ mutate: vi.fn(), isPending: false }),
}));

const project = { id: "p1", backgroundVersion: null } as ProjectWithTasks;

function uploadButton() {
  return screen.getByRole("button", {
    name: "settings:projectGeneral.backgroundUpload",
  }) as HTMLButtonElement;
}

describe("ProjectBackgroundRow", () => {
  afterEach(cleanup);
  beforeEach(() => {
    m.config = undefined;
  });

  it("offers an upload when the instance stores images", () => {
    m.config = { hasImageUploads: true };
    render(<ProjectBackgroundRow project={project} canEdit />);

    expect(uploadButton().disabled).toBe(false);
    expect(
      screen.getByText("settings:projectGeneral.backgroundHint"),
    ).toBeTruthy();
  });

  it("explains why uploads are off when no storage is configured", () => {
    m.config = { hasImageUploads: false };
    render(<ProjectBackgroundRow project={project} canEdit />);

    expect(uploadButton().disabled).toBe(true);
    expect(
      screen.getByText("settings:projectGeneral.backgroundUnavailable"),
    ).toBeTruthy();
  });
});
