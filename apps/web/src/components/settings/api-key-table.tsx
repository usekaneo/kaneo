import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useDeleteApiKey from "@/hooks/mutations/api-key/use-delete-api-key";
import type { ApiKey } from "@/types/api-key";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface ApiKeyTableProps {
  apiKeys: ApiKey[];
  isLoading: boolean;
}

export function ApiKeyTable({ apiKeys, isLoading }: ApiKeyTableProps) {
  const { mutateAsync: deleteApiKey } = useDeleteApiKey();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleDelete = async (id: string, name: string | null) => {
    const keyName = name || "this API key";
    if (!confirm(`Are you sure you want to delete "${keyName}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteApiKey(id);
      toast.success("API key deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete API key",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-md p-8 bg-sidebar">
        <p className="text-sm text-muted-foreground text-center">
          Loading API keys...
        </p>
      </div>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 bg-sidebar">
        <p className="text-sm text-muted-foreground text-center">
          No API keys yet. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md bg-sidebar overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((apiKey) => (
            <TableRow key={apiKey.id}>
              <TableCell className="font-medium">
                {apiKey.name || "Unnamed Key"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded border border-border">
                    {apiKey.prefix}_{apiKey.start}...
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      handleCopy(`${apiKey.prefix}_${apiKey.start}...`)
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(apiKey.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(apiKey.id, apiKey.name)}
                  disabled={deletingId === apiKey.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

