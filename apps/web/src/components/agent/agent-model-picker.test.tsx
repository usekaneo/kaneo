import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useAgentModelStore } from "@/store/agent-model";
import { AgentModelPicker } from "./agent-model-picker";

const m = vi.hoisted(() => ({
  config: undefined as
    | { model: string; models: Array<{ id: string; label: string }> }
    | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { model?: string }) =>
      `${key}|${options?.model}`,
  }),
}));
vi.mock("@/hooks/queries/agent/use-agent-config", () => ({
  default: () => ({ data: m.config }),
}));

const luna = { id: "openai/gpt-6-luna", label: "OpenAI: GPT-6 Luna" };
const opus = {
  id: "anthropic/claude-opus-5",
  label: "Anthropic: Claude Opus 5",
};

describe("AgentModelPicker", () => {
  beforeEach(() => {
    localStorage.clear();
    useAgentModelStore.setState({ modelByWorkspace: {} });
    m.config = { model: luna.id, models: [luna, opus] };
  });
  afterEach(cleanup);

  it("is hidden when only the default model is allowed", () => {
    m.config = { model: luna.id, models: [luna] };
    const { container } = render(<AgentModelPicker workspaceId="ws" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("remembers the chosen model per workspace", async () => {
    render(<AgentModelPicker workspaceId="ws" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `agent:composer.model|${luna.label}`,
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: opus.label }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: `agent:composer.model|${opus.label}`,
        }),
      ).toBeInTheDocument(),
    );
    expect(useAgentModelStore.getState().modelByWorkspace).toEqual({
      ws: opus.id,
    });
    expect(localStorage.getItem("agent-model")).toContain(opus.id);
  });

  it("falls back to the default when the stored model is no longer allowed", () => {
    useAgentModelStore.setState({
      modelByWorkspace: { ws: "google/gemini-3-pro" },
    });
    render(<AgentModelPicker workspaceId="ws" />);
    expect(
      screen.getByRole("button", {
        name: `agent:composer.model|${luna.label}`,
      }),
    ).toBeInTheDocument();
  });
});
