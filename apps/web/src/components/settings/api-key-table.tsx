import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useDeleteApiKey from "@/hooks/mutations/api-key/use-delete-api-key";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { ApiKey } from "@/types/api-key";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Frame, FramePanel } from "../ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type ApiKeyTableProps = {
  apiKeys: ApiKey[];
  isLoading: boolean;
};

function formatDate(value: Date | string | null) {
  if (!value) return "-";

  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getExpirationState(expiresAt: Date | string | null) {
  if (!expiresAt) {
    return { label: "Never", isExpired: false };
  }

  const expirationDate = new Date(expiresAt);
  const isExpired = expirationDate.getTime() <= Date.now();

  return {
    label: formatDate(expirationDate),
    isExpired,
  };
}

export function ApiKeyTable({ apiKeys, isLoading }: ApiKeyTableProps) {
  const { mutateAsync: deleteApiKey } = useDeleteApiKey();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const pendingDeleteKey = useMemo(
    () => apiKeys.find((key) => key.id === pendingDeleteId) ?? null,
    [apiKeys, pendingDeleteId],
  );

  const handleDelete = async () => {
    if (!pendingDeleteKey) return;

    setDeletingId(pendingDeleteKey.id);
    try {
      await deleteApiKey(pendingDeleteKey.id);
      toast.success("API key deleted successfully");
      setPendingDeleteId(null);
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
      <Frame>
        <FramePanel className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Loading API keys...
          </p>
        </FramePanel>
      </Frame>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <Frame>
        <FramePanel className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            No API keys yet. Create one to get started.
          </p>
        </FramePanel>
      </Frame>
    );
  }

  return (
    <>
      <Frame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[90px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((apiKey) => {
              const expiration = getExpirationState(apiKey.expiresAt);

              return (
                <TableRow
                  key={apiKey.id}
                  className={cn(
                    expiration.isExpired &&
                      "bg-destructive/5 hover:bg-destructive/10",
                  )}
                >
                  <TableCell
                    className={cn(
                      "font-medium",
                      expiration.isExpired && "text-destructive-foreground",
                    )}
                  >
                    {apiKey.name || "Unnamed Key"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-background px-2 py-1 rounded border border-border">
                      {apiKey.start}...
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(apiKey.createdAt)}
                  </TableCell>
                  <TableCell>
                    {expiration.isExpired ? (
                      <Badge variant="error">Expired {expiration.label}</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {expiration.label}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setPendingDeleteId(apiKey.id)}
                      disabled={deletingId === apiKey.id}
                      aria-label={`Delete ${apiKey.name || "API key"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Frame>

      <AlertDialog
        open={Boolean(pendingDeleteKey)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletingId) {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              <span className="font-medium text-foreground">
                {" "}
                {pendingDeleteKey?.name || "this API key"}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={Boolean(deletingId)}
            >
              {deletingId ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
