import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminUser } from "@/fetchers/admin/types";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import { UserApiKeysSection } from "./user-api-keys-section";
import { UserSessionsSection } from "./user-sessions-section";

type Props = {
  user: AdminUser | null;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** An admin's view of one user's sessions and API keys. */
export function UserSecurityDialog({
  user,
  isSelf,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const { can } = useAdminAccess();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("settings:adminUsers.security.title", { name: user?.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel>
          {user && open ? (
            <div className="flex flex-col gap-8">
              {can("users:sessions") ? (
                <UserSessionsSection user={user} isSelf={isSelf} />
              ) : null}
              {can("users:api_keys") ? (
                <UserApiKeysSection user={user} />
              ) : null}
            </div>
          ) : null}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
