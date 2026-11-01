import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import setAutomationEnabled from "@/fetchers/agent-automation/set-automation-enabled";
import useAutomation from "@/hooks/queries/agent-automation/use-automation";
import { automationQueryKeys } from "@/hooks/queries/agent-automation/automation-query-keys";
import { HttpError } from "@/lib/http-error";
import type { Automation } from "@/types/agent-automation";
import { AutomationEnabledSwitch } from "./automation-enabled-switch";

const m = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: m.error } }));
vi.mock("@/fetchers/agent-automation/set-automation-enabled", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/agent-automation/get-automation", () => ({
  default: () => new Promise(() => {}),
}));

function Harness() {
  const { data } = useAutomation("w", "a");
  return data ? (
    <AutomationEnabledSwitch workspaceId="w" automation={data} />
  ) : null;
}

function setup(enabled: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(automationQueryKeys.detail("w", "a"), {
    id: "a",
    name: "Monday digest",
    enabled,
    pausedReason: null,
    consecutiveFailures: 0,
    lastSkipReason: null,
  } as Automation);
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  return screen.getByRole("switch", {
    name: "agent:automations.enabledLabel",
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("AutomationEnabledSwitch", () => {
  it("turns an automation off right away and stays off", async () => {
    let resolve!: (value: Automation) => void;
    vi.mocked(setAutomationEnabled).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const toggle = setup(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(toggle).toHaveAttribute("aria-checked", "false"),
    );
    expect(setAutomationEnabled).toHaveBeenCalledWith("w", "a", false);
    // Disabled while the request is in flight, so clicks cannot interleave.
    expect(toggle).toHaveAttribute("data-disabled");
    resolve({ id: "a", enabled: false } as Automation);
    await waitFor(() => expect(toggle).not.toHaveAttribute("data-disabled"));
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(m.error).not.toHaveBeenCalled();
  });

  it("rolls back and explains when enabling fails", async () => {
    vi.mocked(setAutomationEnabled).mockRejectedValue(
      new HttpError(403, JSON.stringify({ message: "Forbidden" })),
    );
    const toggle = setup(false);

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith("agent:errors.forbidden"),
    );
    expect(setAutomationEnabled).toHaveBeenCalledWith("w", "a", true);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).not.toHaveAttribute("data-disabled");
  });
});
