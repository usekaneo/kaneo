import { Link, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ResourceLinkDialog from "@/components/external-links/resource-link-dialog";
import type { DraftResourceLink } from "@/components/external-links/resource-link-input";
import { Button } from "@/components/ui/button";

export default function CreateTaskResources({
  resources,
  onChange,
  disabled,
}: {
  resources: DraftResourceLink[];
  onChange: (resources: DraftResourceLink[]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-label={t("settings:externalLinks.resources")}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t("settings:externalLinks.resources")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || resources.length >= 100}
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
          {t("settings:externalLinks.addResource")}
        </Button>
      </div>
      {resources.map((resource) => (
        <div
          key={resource.id}
          className="flex items-center gap-2 rounded-md border px-3 py-2"
        >
          <Link className="size-4 shrink-0 text-muted-foreground" />
          <span
            className="min-w-0 flex-1 truncate text-sm"
            title={resource.url}
          >
            {resource.title || resource.url}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t("settings:externalLinks.remove", {
              title: resource.title || resource.url,
            })}
            onClick={() =>
              onChange(resources.filter((item) => item.id !== resource.id))
            }
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      {open && (
        <ResourceLinkDialog
          open
          isPending={disabled}
          onOpenChange={setOpen}
          onSubmit={(resource) => {
            onChange([...resources, { ...resource, id: crypto.randomUUID() }]);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}
