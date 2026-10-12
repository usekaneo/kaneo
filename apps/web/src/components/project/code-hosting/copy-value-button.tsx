import { CopyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type CopyValueButtonProps = {
  value: string;
  label: string;
};

export function CopyValueButton({ value, label }: CopyValueButtonProps) {
  const { t } = useTranslation();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("settings:codeHosting.copied"), { icon: CopyIcon });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:codeHosting.copyFailed"),
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={copy}
    >
      <CopyIcon aria-hidden="true" className="size-3.5" />
    </Button>
  );
}
