import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

type PublicLinkUrlRowProps = {
  url: string;
};

export function PublicLinkUrlRow({ url }: PublicLinkUrlRowProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    if (await copyToClipboard(url)) {
      setCopied(true);
      return;
    }
    toast.error(t("settings:projectVisibility.copyError"));
  };

  return (
    <div className="flex flex-col gap-2 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
      <Input
        size="sm"
        readOnly
        value={url}
        aria-label={t("settings:projectVisibility.publicUrl")}
        className="min-w-0 flex-1 font-mono text-xs sm:text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-24 flex-1 sm:flex-none"
          onClick={handleCopy}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied
            ? t("settings:projectVisibility.copied")
            : t("settings:projectVisibility.copy")}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("settings:projectVisibility.openPublicPage")}
          render={<a href={url} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
