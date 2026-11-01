import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { AiCreditCard } from "./ai-credit-card";

const state = vi.hoisted(() => ({
  canBuy: vi.fn(),
  credit: {
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: {
      enabled: true,
      balanceMicroUsd: "1000000",
      reservedMicroUsd: "1000000",
      availableMicroUsd: "0",
      multiplierBps: 15000,
      trialGranted: true,
      entries: [] as {
        id: string;
        kind: string;
        amount: string;
        model: string | null;
        createdAt: string;
      }[],
      topup: { minimumCents: 500, maximumCents: 99999999 } as {
        minimumCents: number;
        maximumCents: number;
      } | null,
    },
  },
  purchase: {
    isPending: false,
    isError: false,
    variables: undefined as number | undefined,
    mutate: vi.fn(),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (
      key: string,
      options?: { amount?: string; balance?: string; minimum?: string },
    ) =>
      [key, options?.amount, options?.balance, options?.minimum]
        .filter(Boolean)
        .join(" "),
  }),
}));
vi.mock("@/hooks/queries/billing/use-ai-credit", () => ({
  useAiCredit: () => state.credit,
}));
vi.mock("@/hooks/mutations/billing/use-buy-ai-credit", () => ({
  useBuyAiCredit: () => state.purchase,
}));

const checkout = "settings:billing.ai.checkout";
const amountInput = () =>
  screen.getByRole<HTMLInputElement>("textbox", {
    name: "settings:billing.ai.amountLabel",
  });

afterEach(cleanup);
beforeEach(() => {
  state.purchase.isPending = false;
  state.purchase.isError = false;
  state.credit.isError = false;
  state.credit.data.entries = [];
  state.credit.data.topup = { minimumCents: 500, maximumCents: 99999999 };
  vi.clearAllMocks();
});

describe("AI credit billing", () => {
  it("shows depletion and pending funds to members without purchase controls", () => {
    render(<AiCreditCard workspaceId="workspace" canManage={false} />);
    expect(screen.getByRole("status").textContent).toContain(
      "billing.ai.depletedMember",
    );
    expect(screen.getByText("settings:billing.ai.pausedBadge")).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
    expect(screen.getByText(/billing.ai.reserved \$1.00 \$1.00/)).toBeTruthy();
    expect(screen.getByText("settings:billing.ai.adminOnly")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: checkout })).toBeNull();
  });
  it("starts checkout for the $5 minimum without granting credit on redirect", () => {
    render(
      <AiCreditCard workspaceId="workspace" canManage checkout="ai-success" />,
    );
    expect(amountInput().value).toBe("5");
    expect(
      screen.getByText("settings:billing.ai.addDescription $5"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: checkout }));
    expect(state.purchase.mutate).toHaveBeenCalledWith(500);
    expect(screen.getByText("settings:billing.ai.paymentPending")).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
  });
  it("sends a custom amount as exact cents", () => {
    render(<AiCreditCard workspaceId="workspace" canManage />);
    fireEvent.change(amountInput(), { target: { value: "19.99" } });
    fireEvent.click(screen.getByRole("button", { name: checkout }));
    expect(state.purchase.mutate).toHaveBeenCalledWith(1999);
  });
  it.each([
    ["4.99", "settings:billing.ai.amountMinimum $5"],
    ["12.345", "settings:billing.ai.amountInvalid"],
    ["1e3", "settings:billing.ai.amountInvalid"],
    ["1000000", "settings:billing.ai.amountMaximum $999,999.99"],
  ])("blocks checkout for %s and explains why", (value, message) => {
    render(<AiCreditCard workspaceId="workspace" canManage />);
    const input = amountInput();
    fireEvent.change(input, { target: { value } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: checkout }));
    expect(state.purchase.mutate).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(message);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });
  it("explains when buying credit isn't set up", () => {
    state.credit.data.topup = null;
    render(<AiCreditCard workspaceId="workspace" canManage />);
    expect(screen.getByText("settings:billing.ai.unavailable")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: checkout })).toBeNull();
  });
  it("disables purchasing while checkout is starting and reports failures", () => {
    state.purchase.isPending = true;
    state.purchase.isError = true;
    render(<AiCreditCard workspaceId="workspace" canManage />);
    for (const button of screen.getAllByRole("button"))
      expect(button).toHaveProperty("disabled", true);
    expect(amountInput().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(
      "billing.ai.purchaseError",
    );
  });
  it("offers retry when the balance cannot be loaded", () => {
    state.credit.isError = true;
    render(<AiCreditCard workspaceId="workspace" canManage />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:billing.ai.retry" }),
    );
    expect(state.credit.refetch).toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("lists ledger activity with signed sub-cent amounts", () => {
    state.credit.data.entries = [
      {
        id: "usage",
        kind: "usage",
        amount: "-312",
        model: "claude-sonnet",
        createdAt: "2026-11-01T10:00:00.000Z",
      },
      {
        id: "topup",
        kind: "topup",
        amount: "5000000",
        model: null,
        createdAt: "2026-11-01T09:00:00.000Z",
      },
    ];
    render(<AiCreditCard workspaceId="workspace" canManage={false} />);
    expect(screen.getByText("-$0.000312")).toBeTruthy();
    expect(screen.getByText("+$5.00")).toBeTruthy();
    expect(screen.getByText("claude-sonnet")).toBeTruthy();
  });
});
