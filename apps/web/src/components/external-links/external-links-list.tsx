import {
  Edit2,
  ExternalLink as ExternalLinkLucide,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useDeleteExternalLink } from "../../hooks/mutations/external-links";
import { useGetExternalLinks } from "../../hooks/queries/external-links";
import type {
  ExternalLink,
  ExternalLinkType,
} from "../../types/external-links";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  ExternalLinkIcon,
  getExternalLinkTypeColor,
  getExternalLinkTypeLabel,
} from "./external-link-icon";
import { LazyExternalLinkDialog } from "./lazy-external-link-dialog";

interface ExternalLinksListProps {
  taskId: string;
}

export function ExternalLinksList({ taskId }: ExternalLinksListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ExternalLink | null>(null);

  const { data: response, isLoading, error } = useGetExternalLinks(taskId);
  const deleteMutation = useDeleteExternalLink();

  const externalLinks = response?.data || [];

  const handleEdit = (link: ExternalLink) => {
    setEditingLink(link);
    setIsDialogOpen(true);
  };

  const handleDelete = async (linkId: string) => {
    if (confirm("Are you sure you want to delete this link?")) {
      await deleteMutation.mutateAsync(linkId);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingLink(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">External Links</h3>
          <Button size="sm" variant="outline" disabled className="h-7 px-2">
            <Plus className="h-3 w-3 mr-1" />
            Add Link
          </Button>
        </div>
        <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">External Links</h3>
          <Button size="sm" variant="outline" disabled className="h-7 px-2">
            <Plus className="h-3 w-3 mr-1" />
            Add Link
          </Button>
        </div>
        <div className="text-xs text-destructive text-center py-3 border border-destructive/20 rounded-lg bg-destructive/5">
          Failed to load external links
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">External Links</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsDialogOpen(true)}
            className="h-7 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Link
          </Button>
        </div>

        {externalLinks.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
            No external links added yet
          </div>
        ) : (
          <div className="space-y-1.5">
            {externalLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <ExternalLinkIcon
                    type={link.type as ExternalLinkType}
                    className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-medium truncate">
                        {link.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0.5 h-4 ${getExternalLinkTypeColor(link.type as ExternalLinkType)}`}
                      >
                        {getExternalLinkTypeLabel(
                          link.type as ExternalLinkType,
                        )}
                      </Badge>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline truncate block mt-0.5"
                    >
                      {link.url}
                    </a>
                  </div>
                </div>
                <div className="flex items-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(link.url, "_blank")}
                    title="Open in new tab"
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLinkLucide className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(link as ExternalLink)}
                    title="Edit link"
                    className="h-6 w-6 p-0"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(link.id)}
                    title={
                      link.type.includes("_integration")
                        ? "Unlink integration"
                        : "Delete link"
                    }
                    className={`h-6 w-6 p-0 ${
                      link.type.includes("_integration")
                        ? "text-orange-600 hover:text-orange-700"
                        : "text-destructive hover:text-destructive"
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LazyExternalLinkDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        taskId={taskId}
        editingLink={editingLink}
      />
    </>
  );
}
