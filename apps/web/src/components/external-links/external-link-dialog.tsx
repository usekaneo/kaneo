import { useEffect, useState } from "react";
import {
  useCreateExternalLink,
  useUpdateExternalLink,
} from "../../hooks/mutations/external-links";
import type {
  ExternalLink,
  ExternalLinkType,
} from "../../types/external-links";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  ExternalLinkIcon,
  getExternalLinkTypeLabel,
} from "./external-link-icon";

interface ExternalLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  editingLink?: ExternalLink | null;
}

export function ExternalLinkDialog({
  isOpen,
  onClose,
  taskId,
  editingLink,
}: ExternalLinkDialogProps) {
  const [formData, setFormData] = useState({
    type: "custom" as ExternalLinkType,
    title: "",
    url: "",
    externalId: "",
  });

  const createMutation = useCreateExternalLink();
  const updateMutation = useUpdateExternalLink();

  useEffect(() => {
    if (editingLink) {
      setFormData({
        type: editingLink.type as ExternalLinkType,
        title: editingLink.title,
        url: editingLink.url,
        externalId: editingLink.externalId || "",
      });
    } else {
      setFormData({
        type: "custom",
        title: "",
        url: "",
        externalId: "",
      });
    }
  }, [editingLink]);

  // Auto-extract issue ID from URL for integration types
  useEffect(() => {
    if (
      formData.type === "gitea_integration" ||
      formData.type === "github_integration"
    ) {
      const issueMatch = formData.url.match(/\/issues\/(\d+)/);
      if (issueMatch && issueMatch[1] !== formData.externalId) {
        setFormData((prev) => ({ ...prev, externalId: issueMatch[1] }));
      }
    }
  }, [formData.url, formData.type, formData.externalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.url.trim()) {
      return;
    }

    try {
      let externalId = formData.externalId || undefined;

      // Auto-extract issue number for integration types
      if (
        formData.type === "gitea_integration" ||
        formData.type === "github_integration"
      ) {
        const issueMatch = formData.url.match(/\/issues\/(\d+)/);
        if (issueMatch) {
          externalId = issueMatch[1];
        }
      }

      if (editingLink) {
        await updateMutation.mutateAsync({
          linkId: editingLink.id,
          data: {
            title: formData.title,
            url: formData.url,
            externalId,
          },
        });
      } else {
        await createMutation.mutateAsync({
          taskId,
          type: formData.type,
          title: formData.title,
          url: formData.url,
          externalId,
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving external link:", error);
    }
  };

  const linkTypes: ExternalLinkType[] = [
    "gitea_integration",
    "github_integration",
    "documentation",
    "reference",
    "design",
    "ticket",
    "custom",
  ];

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingLink ? "Edit External Link" : "Add External Link"}
          </DialogTitle>
          <DialogDescription>
            {editingLink
              ? "Update the details of this external link."
              : "Add a new external link to this task."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {!editingLink && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <div className="col-span-3">
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        type: value as ExternalLinkType,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {linkTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center space-x-2">
                            <ExternalLinkIcon type={type} className="h-4 w-4" />
                            <span>{getExternalLinkTypeLabel(type)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {editingLink && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <ExternalLinkIcon
                    type={editingLink.type as ExternalLinkType}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {getExternalLinkTypeLabel(
                      editingLink.type as ExternalLinkType,
                    )}
                  </span>
                  {editingLink.type.includes("_integration") && (
                    <span className="text-xs text-muted-foreground">
                      (Integration Link)
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="col-span-3"
                placeholder="Link title"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">
                URL
              </Label>
              <div className="col-span-3">
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com"
                  required
                />
                {(formData.type === "gitea_integration" ||
                  formData.type === "github_integration") && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Issue number will be automatically extracted from the URL
                  </p>
                )}
              </div>
            </div>
            {(formData.type === "ticket" || editingLink?.type === "ticket") && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="externalId" className="text-right">
                  Ticket ID
                </Label>
                <Input
                  id="externalId"
                  value={formData.externalId}
                  onChange={(e) =>
                    setFormData({ ...formData, externalId: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="Optional ticket ID"
                />
              </div>
            )}
            {(formData.type === "gitea_integration" ||
              formData.type === "github_integration") && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="issueId" className="text-right">
                  Issue ID
                </Label>
                <div className="col-span-3">
                  <Input
                    id="issueId"
                    value={formData.externalId}
                    readOnly
                    className="bg-muted"
                    placeholder={
                      formData.url
                        ? "Enter URL with /issues/123 pattern"
                        : "Auto-extracted from URL"
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.externalId
                      ? `Issue ID: ${formData.externalId} (extracted from URL)`
                      : "This field is automatically filled from the URL pattern /issues/123"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : editingLink ? "Update" : "Add Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
