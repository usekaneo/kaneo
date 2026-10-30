import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type WebhookSecretFieldProps = {
  secret: string;
  labelledBy: string;
};

export function WebhookSecretField({
  secret,
  labelledBy,
}: WebhookSecretFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background ps-2.5 pe-1 dark:bg-input/32">
      <span
        aria-labelledby={labelledBy}
        className="min-w-0 flex-1 truncate font-mono text-xs"
      >
        {visible ? secret : "•".repeat(24)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={
          visible
            ? t("settings:codeHosting.hideSecret")
            : t("settings:codeHosting.showSecret")
        }
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <EyeOffIcon aria-hidden="true" />
        ) : (
          <EyeIcon aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
