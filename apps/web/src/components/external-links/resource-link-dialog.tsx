import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceLinkInput } from "./resource-link-input";

export default function ResourceLinkDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (link: ResourceLinkInput) => void;
  isPending?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <form
          className="contents"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.requestSubmit();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isPending && event.currentTarget.reportValidity()) {
              onSubmit({
                url: url.trim(),
                ...(title.trim() ? { title: title.trim() } : {}),
              });
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("settings:externalLinks.addResource")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-url`}>
                {t("settings:externalLinks.url")}
              </Label>
              <Input
                id={`${id}-url`}
                type="url"
                pattern="[hH][tT][tT][pP][sS]?://.+"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-title`}>
                {t("settings:externalLinks.titleOptional")}
              </Label>
              <Input
                id={`${id}-title`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("settings:externalLinks.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !url.trim()}>
              {isPending
                ? t("settings:externalLinks.adding")
                : t("settings:externalLinks.addResource")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
