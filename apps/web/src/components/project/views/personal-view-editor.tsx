import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deletePersonalView,
  savePersonalView,
  type PersonalView,
  type ProjectViewConfig,
} from "@/fetchers/saved-view";

type Props = {
  projectId: string;
  view?: PersonalView;
  config: ProjectViewConfig;
  onClose: () => void;
};
export function PersonalViewEditor({
  projectId,
  view,
  config,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(view?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: "rename" | "replace" | "delete") => {
      if (action === "delete" && view)
        return deletePersonalView(projectId, view.id);
      return savePersonalView(
        projectId,
        name.trim(),
        action === "rename" && view ? view.config : config,
        view?.id,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["personal-views", projectId],
      });
      onClose();
    },
  });
  const disabled = mutation.isPending || !name.trim();
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t(
              view ? "tasks:personalViews.manage" : "tasks:personalViews.save",
            )}
          </DialogTitle>
          <DialogDescription>
            {t("tasks:personalViews.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <label htmlFor="personal-view-name" className="mb-2 block text-sm">
            {t("tasks:personalViews.name")}
          </label>
          <Input
            id="personal-view-name"
            value={name}
            maxLength={80}
            disabled={mutation.isPending}
            onChange={(event) => setName(event.target.value)}
          />
          {mutation.isError && (
            <p role="alert" className="mt-2 text-destructive text-sm">
              {t("tasks:personalViews.error")}
            </p>
          )}
          {confirmDelete && (
            <p className="mt-3 text-sm">
              {t("tasks:personalViews.deleteConfirm")}
            </p>
          )}
        </DialogPanel>
        <DialogFooter className="flex-wrap">
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {t("common:actions.cancel")}
          </Button>
          {view && (
            <>
              <Button
                variant="destructive"
                disabled={mutation.isPending}
                onClick={() =>
                  confirmDelete
                    ? mutation.mutate("delete")
                    : setConfirmDelete(true)
                }
              >
                {t(
                  confirmDelete
                    ? "tasks:personalViews.confirmDelete"
                    : "common:actions.delete",
                )}
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => mutation.mutate("rename")}
              >
                {t("tasks:personalViews.rename")}
              </Button>
            </>
          )}
          <Button
            disabled={disabled}
            onClick={() => mutation.mutate("replace")}
          >
            {t(
              view ? "tasks:personalViews.replace" : "tasks:personalViews.save",
            )}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
