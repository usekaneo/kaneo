import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFileStorage, useStorageActions } from "@/hooks/files";
import { toast } from "@/lib/toast";

// Cloudflare R2 (or any S3-compatible bucket) for workspace files. The secret
// never comes back from the server; leaving it empty keeps the saved one.
export function StorageSettings({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { data: storage } = useFileStorage(workspaceId, canEdit);
  const { connect, disconnect } = useStorageActions(workspaceId);
  const [form, setForm] = useState({
    endpoint: "",
    bucket: "",
    accessKeyId: "",
    secretAccessKey: "",
    keyPrefix: "",
  });

  useEffect(() => {
    if (!storage) return;
    setForm({
      endpoint: storage.endpoint ?? "",
      bucket: storage.bucket ?? "",
      accessKeyId: storage.accessKeyId ?? "",
      secretAccessKey: "",
      keyPrefix: storage.keyPrefix ?? "",
    });
  }, [storage]);

  if (!canEdit || !storage) return null;

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    try {
      await connect.mutateAsync({
        workspaceId,
        endpoint: form.endpoint.trim(),
        bucket: form.bucket.trim(),
        accessKeyId: form.accessKeyId.trim(),
        secretAccessKey: form.secretAccessKey.trim() || undefined,
        keyPrefix: form.keyPrefix.trim() || undefined,
      });
      toast.success(t("files:storage.connected"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files:error"));
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    type = "text",
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`${id}-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`${id}-${key}`}
        type={type}
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {storage.connected ? (
          <Badge variant="success">{t("files:storage.statusConnected")}</Badge>
        ) : (
          <Badge variant="outline">{t("files:storage.statusDatabase")}</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {storage.connected
            ? t("files:storage.connectedHint", { bucket: storage.bucket })
            : t("files:storage.databaseHint")}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "endpoint",
          t("files:storage.endpoint"),
          "https://<account-id>.r2.cloudflarestorage.com",
        )}
        {field("bucket", t("files:storage.bucket"), "kaneo-files")}
        {field("accessKeyId", t("files:storage.accessKey"), "")}
        {field(
          "secretAccessKey",
          t("files:storage.secretKey"),
          storage.connected ? t("files:storage.secretKept") : "",
          "password",
        )}
        {field("keyPrefix", t("files:storage.prefix"), "kaneo/")}
      </div>
      <p className="text-xs text-muted-foreground">{t("files:storage.help")}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={connect.isPending}>
          {connect.isPending
            ? t("files:storage.testing")
            : storage.connected
              ? t("files:storage.update")
              : t("files:storage.connect")}
        </Button>
        {storage.connected && (
          <Button
            size="sm"
            variant="outline"
            disabled={disconnect.isPending}
            onClick={() =>
              disconnect
                .mutateAsync()
                .then(() => toast.success(t("files:storage.disconnected")))
                .catch((e) =>
                  toast.error(
                    e instanceof Error ? e.message : t("files:error"),
                  ),
                )
            }
          >
            {t("files:storage.disconnect")}
          </Button>
        )}
      </div>
    </div>
  );
}
