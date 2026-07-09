import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

function DeleteAccount() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  // Whether the account signs in with a password. Credential accounts must
  // provide it on deletion; social/OIDC-only accounts rely on a fresh session.
  const [hasPasswordAccount, setHasPasswordAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authClient
      .listAccounts()
      .then((res) => {
        if (cancelled) return;
        const accounts = res.data ?? [];
        setHasPasswordAccount(
          accounts.some((account) => account.providerId === "credential"),
        );
      })
      .catch(() => {
        // Best-effort: if we can't tell, fall back to not requiring a password.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const email = user?.email ?? "";
  const confirmMatches =
    confirmText.trim().toLowerCase() === email.trim().toLowerCase();
  const canDelete =
    confirmMatches &&
    (!hasPasswordAccount || password.length > 0) &&
    !isDeleting;

  const resetDialog = () => {
    setPassword("");
    setConfirmText("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetDialog();
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const result = await authClient.deleteUser(
        hasPasswordAccount ? { password } : {},
      );
      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success(t("settings:deleteAccount.success"));
      setOpen(false);
      resetDialog();
      // The account and its sessions are gone server-side; clear cached
      // session state and return to sign-in.
      await authClient.signOut().catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:deleteAccount.error"),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-md font-medium text-destructive">
          {t("settings:deleteAccount.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("settings:deleteAccount.subtitle")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border border-destructive/30 rounded-md p-4 bg-destructive/5">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("settings:deleteAccount.label")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings:deleteAccount.description")}
          </p>
        </div>
        <Button
          variant="destructive"
          className="flex-shrink-0"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t("settings:deleteAccount.button")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPopup className="w-full max-w-md">
          <div className="bg-card rounded-lg shadow-xl">
            <div className="p-4 border-b border-border">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {t("settings:deleteAccount.dialogTitle")}
              </DialogTitle>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("settings:deleteAccount.warning")}
              </p>

              {hasPasswordAccount ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="delete-account-password"
                    className="text-sm font-medium"
                  >
                    {t("settings:deleteAccount.passwordLabel")}
                  </label>
                  <Input
                    id="delete-account-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label
                  htmlFor="delete-account-confirm"
                  className="text-sm font-medium"
                >
                  {t("settings:deleteAccount.confirmLabel", { email })}
                </label>
                <Input
                  id="delete-account-confirm"
                  autoComplete="off"
                  placeholder={email}
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <DialogClose
                  render={<Button variant="secondary" type="button" />}
                >
                  {t("common:actions.cancel")}
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!canDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("settings:deleteAccount.confirmButton")}
                </Button>
              </div>
            </div>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

export default DeleteAccount;
