import { format } from "date-fns";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRequestActions } from "@/hooks/mutations/company-os";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { parseMoneyInput } from "@/lib/money";
import { toast } from "@/lib/toast";

const NO_PROJECT = "__none__";
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export function AddExpenseDialog({
  open,
  onClose,
  workspaceId,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currency: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { submitExpense, uploadReceipt } = useRequestActions(workspaceId);
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCategory("");
    setDescription("");
    setSpentOn(format(new Date(), "yyyy-MM-dd"));
    setProjectId(NO_PROJECT);
    setFile(null);
  }, [open]);

  const save = async () => {
    const minor = parseMoneyInput(amount);
    if (!minor) {
      toast.error(t("requests:expense.invalidAmount"));
      return;
    }
    if (!category.trim()) {
      toast.error(t("requests:expense.needCategory"));
      return;
    }
    if (file && file.size > MAX_RECEIPT_BYTES) {
      toast.error(t("requests:expense.receiptTooLarge"));
      return;
    }
    try {
      const receipt = file ? await uploadReceipt.mutateAsync(file) : null;
      await submitExpense.mutateAsync({
        workspaceId,
        amount: minor,
        category: category.trim(),
        description: description.trim() || undefined,
        spentOn,
        projectId: projectId === NO_PROJECT ? undefined : projectId,
        receiptFileId: receipt?.id,
      });
      toast.success(t("requests:expense.sent"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requests:error"));
    }
  };

  const projectName =
    projectId === NO_PROJECT
      ? t("requests:expense.noProject")
      : (projects.find((p) => p.id === projectId)?.name ?? "");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("requests:expense.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-amount`}>
                {t("requests:expense.amount", { currency })}
              </Label>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-date`}>{t("requests:expense.date")}</Label>
              <Input
                id={`${id}-date`}
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-category`}>
              {t("requests:expense.category")}
            </Label>
            <Input
              id={`${id}-category`}
              list={`${id}-categories`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("requests:expense.categoryPlaceholder")}
            />
            <datalist id={`${id}-categories`}>
              <option value={t("requests:expense.categories.travel")} />
              <option value={t("requests:expense.categories.meals")} />
              <option value={t("requests:expense.categories.equipment")} />
              <option value={t("requests:expense.categories.software")} />
              <option value={t("requests:expense.categories.other")} />
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-description`}>
              {t("requests:expense.description")}
            </Label>
            <Input
              id={`${id}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("requests:expense.project")}</Label>
            <Select
              value={projectId}
              onValueChange={(value) => {
                if (typeof value === "string") setProjectId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue>{projectName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>
                  {t("requests:expense.noProject")}
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-receipt`}>
              {t("requests:expense.receipt")}
            </Label>
            <Input
              id={`${id}-receipt`}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" type="button" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            size="sm"
            onClick={save}
            disabled={submitExpense.isPending || uploadReceipt.isPending}
          >
            {t("requests:expense.send")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
