import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle";
import { Button } from "@/components/ui/button";
import {
  BILLING_PLANS,
  type BillingIntervalKey,
  type BillingPlanKey,
} from "@/constants/billing";
import type { CheckoutIntent } from "@/lib/checkout-intent";
import { OptionCard } from "./option-card";
import { PlanOptionPrice } from "./plan-option-price";

type PlanStepProps = {
  canTrial: boolean;
  recommended: BillingPlanKey;
  intent: CheckoutIntent | null;
  isStartingCheckout: boolean;
  onStartTrial: () => void;
  onSubscribe: (choice: {
    plan: BillingPlanKey;
    interval: BillingIntervalKey;
  }) => void;
};

const planOrder: BillingPlanKey[] = ["team", "personal"];

export function PlanStep({
  canTrial,
  recommended,
  intent,
  isStartingCheckout,
  onStartTrial,
  onSubscribe,
}: PlanStepProps) {
  const { t } = useTranslation();
  const name = useId();
  const [plan, setPlan] = useState<BillingPlanKey>(intent?.plan ?? recommended);
  const [interval, setInterval] = useState<BillingIntervalKey>(
    intent?.interval ?? "annual",
  );
  const planName = t(`settings:billing.plans.${plan}.name`);
  const subscribe = () => onSubscribe({ plan, interval });
  const checkoutFirst = Boolean(intent) || !canTrial;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BillingIntervalToggle value={interval} onChange={setInterval} />
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">
            {t("auth:onboarding.plan.choose")}
          </legend>
          {planOrder.map((key) => {
            const definition = BILLING_PLANS.find((item) => item.plan === key);
            if (!definition) return null;
            return (
              <OptionCard
                key={key}
                name={name}
                checked={plan === key}
                onSelect={() => setPlan(key)}
                title={t(`settings:billing.plans.${key}.name`)}
                badge={
                  key === recommended
                    ? t("auth:onboarding.cloud.plan.recommended")
                    : undefined
                }
                description={t(`auth:onboarding.plan.description.${key}`)}
                trailing={
                  <PlanOptionPrice
                    price={
                      interval === "annual"
                        ? definition.annualPerMonth
                        : definition.monthly
                    }
                    unit={
                      key === "team"
                        ? t("auth:onboarding.plan.perUserMonth")
                        : t("auth:onboarding.plan.perMonth")
                    }
                  />
                }
              />
            );
          })}
        </fieldset>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {checkoutFirst ? (
            <Button size="lg" loading={isStartingCheckout} onClick={subscribe}>
              {intent
                ? t("auth:onboarding.plan.checkout")
                : t("auth:onboarding.plan.subscribe", { plan: planName })}
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={isStartingCheckout}
              onClick={onStartTrial}
            >
              {t("auth:onboarding.cloud.plan.continueTrial")}
            </Button>
          )}
          {canTrial ? (
            checkoutFirst ? (
              <Button
                variant="outline"
                size="lg"
                disabled={isStartingCheckout}
                onClick={onStartTrial}
              >
                {t("auth:onboarding.cloud.plan.continueTrial")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                loading={isStartingCheckout}
                onClick={subscribe}
              >
                {t("auth:onboarding.plan.subscribe", { plan: planName })}
              </Button>
            )
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {canTrial
            ? t("auth:onboarding.plan.trialNote")
            : t("auth:onboarding.plan.paymentNote")}
        </p>
      </div>
    </div>
  );
}
