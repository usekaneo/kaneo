import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { GetBillingResponse } from "@/fetchers/billing/get-billing";
import { CurrentPlanCard } from "./current-plan-card";

const m = vi.hoisted(() => ({ portal: vi.fn() }));

vi.mock("@/lib/i18n", () => ({
  i18n: { t: (key: string) => key, language: "en-US" },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/billing/use-billing-actions", () => ({
  useOpenBillingPortal: () => ({ mutate: m.portal, isPending: false }),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function billing(overrides: Partial<GetBillingResponse>) {
  return {
    billingEnabled: true,
    foundingFree: false,
    plan: null,
    status: null,
    billingInterval: null,
    seats: 1,
    currentPeriodEnd: null,
    canceledAt: null,
    hasCustomer: false,
    trialEndsAt: null,
    ...overrides,
  } as GetBillingResponse;
}

describe("CurrentPlanCard", () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it("shows the plan, its status, and the portal for a subscription", () => {
    render(
      <CurrentPlanCard
        billing={billing({
          plan: "team",
          status: "past_due",
          billingInterval: "annual",
          seats: 5,
          hasCustomer: true,
        })}
        workspaceId="w1"
        canManage
        onChoosePlan={() => {}}
      />,
    );

    expect(screen.getByText("settings:billing.plans.team.name")).toBeTruthy();
    expect(screen.getByText("settings:billing.status.past_due")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:billing.manage" }),
    );
    expect(m.portal).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: "settings:billing.trialCard.choosePlan",
      }),
    ).toBeNull();
  });

  it("disables the portal for members who cannot manage billing", () => {
    render(
      <CurrentPlanCard
        billing={billing({ plan: "team", status: "active", hasCustomer: true })}
        workspaceId="w1"
        canManage={false}
        onChoosePlan={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "settings:billing.manage" }),
    ).toBeDisabled();
  });

  it("shows days left on an active trial and jumps to the plans", () => {
    const onChoosePlan = vi.fn();
    render(
      <CurrentPlanCard
        billing={billing({
          trialEndsAt: new Date(Date.now() + 9 * DAY_MS).toISOString(),
        })}
        workspaceId="w1"
        canManage
        onChoosePlan={onChoosePlan}
      />,
    );

    expect(screen.getByText("settings:billing.trial.activeTitle")).toBeTruthy();
    expect(
      screen.getByText("settings:billing.trial.badgeDaysLeft"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:billing.trialCard.choosePlan",
      }),
    );
    expect(onChoosePlan).toHaveBeenCalled();
  });

  it("flags an expired trial", () => {
    render(
      <CurrentPlanCard
        billing={billing({
          trialEndsAt: new Date(Date.now() - DAY_MS).toISOString(),
        })}
        workspaceId="w1"
        canManage
        onChoosePlan={() => {}}
      />,
    );

    expect(
      screen.getByText("settings:billing.trial.expiredTitle"),
    ).toBeTruthy();
    expect(screen.getByText("settings:billing.trialCard.ended")).toBeTruthy();
  });

  it("shows the founding free plan without a plan action", () => {
    render(
      <CurrentPlanCard
        billing={billing({ foundingFree: true })}
        workspaceId="w1"
        canManage
        onChoosePlan={() => {}}
      />,
    );

    expect(
      screen.getByText("settings:billing.foundingFree.title"),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
