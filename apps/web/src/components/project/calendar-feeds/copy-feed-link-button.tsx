import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

const COPIED_RESET_MS = 2000;

export function CopyFeedLinkButton({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    if (await copyToClipboard(url)) {
      setCopied(true);
    } else {
      toast.error(t("settings:calendarFeeds.copyError"));
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-24"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckIcon aria-hidden="true" className="text-success-foreground" />
          {t("settings:calendarFeeds.copiedLabel")}
        </>
      ) : (
        <>
          <CopyIcon aria-hidden="true" />
          {t("settings:calendarFeeds.copy")}
        </>
      )}
    </Button>
  );
}
