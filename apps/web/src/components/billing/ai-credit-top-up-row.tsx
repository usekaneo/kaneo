import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { useBuyAiCredit } from "@/hooks/mutations/billing/use-buy-ai-credit";
import { formatAiCredit } from "./format-ai-credit";
import { parseUsdCents } from "./parse-usd-cents";

export function AiCreditTopUpRow({
  workspaceId,
  topup,
}: {
  workspaceId: string;
  topup: { minimumCents: number; maximumCents: number } | null;
}) {
  const { t, i18n } = useTranslation();
  const purchase = useBuyAiCredit(workspaceId);
  const [value, setValue] = useState(
    topup ? String(topup.minimumCents / 100) : "",
  );
  const [touched, setTouched] = useState(false);
  const errorId = useId();

  if (!topup)
    return (
      <SettingsRow
        title={t("settings:billing.ai.addTitle")}
        description={t("settings:billing.ai.unavailable")}
      />
    );

  const format = (cents: number) =>
    formatAiCredit(String(cents * 10000), i18n.language, {
      minDigits: 0,
      maxDigits: 2,
    });
  const cents = parseUsdCents(value);
  const problem =
    cents === null
      ? t("settings:billing.ai.amountInvalid")
      : cents < topup.minimumCents
        ? t("settings:billing.ai.amountMinimum", {
            amount: format(topup.minimumCents),
          })
        : cents > topup.maximumCents
          ? t("settings:billing.ai.amountMaximum", {
              amount: format(topup.maximumCents),
            })
          : null;
  const showProblem = touched && problem !== null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (problem === null && cents !== null) purchase.mutate(cents);
  };

  return (
    <form noValidate onSubmit={submit}>
      <SettingsRow
        stack
        title={t("settings:billing.ai.addTitle")}
        description={t("settings:billing.ai.addDescription", {
          minimum: format(topup.minimumCents),
        })}
      >
        <InputGroup className="w-36">
          <InputGroupInput
            size="sm"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            aria-label={t("settings:billing.ai.amountLabel")}
            aria-invalid={showProblem || undefined}
            aria-describedby={showProblem ? errorId : undefined}
            value={value}
            disabled={purchase.isPending}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          <InputGroupAddon>
            <InputGroupText aria-hidden="true">$</InputGroupText>
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupText aria-hidden="true">USD</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <Button
          type="submit"
          size="sm"
          loading={purchase.isPending}
          disabled={purchase.isPending}
        >
          {t("settings:billing.ai.checkout")}
        </Button>
      </SettingsRow>
      {showProblem ? (
        <p
          id={errorId}
          role="alert"
          className="-mt-1 px-4 pb-3.5 text-xs text-destructive"
        >
          {problem}
        </p>
      ) : purchase.isError ? (
        <p role="alert" className="-mt-1 px-4 pb-3.5 text-xs text-destructive">
          {t("settings:billing.ai.purchaseError")}
        </p>
      ) : null}
    </form>
  );
}
