import { format } from "date-fns";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
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
import { useAddSalary } from "@/hooks/mutations/company-os";
import { parseMoneyInput } from "@/lib/money";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  name: string;
  currency: string;
};

// Adds a new salary record from a date; earlier records stay as history.
export function AddSalaryDialog({
  open,
  onClose,
  workspaceId,
  userId,
  name,
  currency,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const addSalary = useAddSalary();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"monthly" | "hourly">("monthly");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setType("monthly");
    setEffectiveFrom(format(new Date(), "yyyy-MM-01"));
    setNote("");
  }, [open]);

  const save = async () => {
    const minor = parseMoneyInput(amount);
    if (minor === null || minor === 0) {
      toast.error(t("pay:salary.invalidAmount"));
      return;
    }
    try {
      await addSalary.mutateAsync({
        workspaceId,
        userId,
        amount: minor,
        type,
        effectiveFrom,
        note: note.trim() || undefined,
      });
      toast.success(t("pay:salary.saved"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pay:error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pay:salary.dialogTitle", { name })}</DialogTitle>
          <DialogDescription>{t("pay:salary.dialogHint")}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-amount`}>
                {t("pay:salary.amount", { currency })}
              </Label>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50,000"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>{t("pay:salary.type")}</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  if (value === "monthly" || value === "hourly") setType(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {type === "hourly"
                      ? t("pay:salary.hourly")
                      : t("pay:salary.monthly")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">
                    {t("pay:salary.monthly")}
                  </SelectItem>
                  <SelectItem value="hourly">
                    {t("pay:salary.hourly")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-from`}>
              {t("pay:salary.effectiveFrom")}
            </Label>
            <Input
              id={`${id}-from`}
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-note`}>{t("pay:salary.note")}</Label>
            <Input
              id={`${id}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pay:salary.notePlaceholder")}
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" type="button" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button size="sm" onClick={save} disabled={addSalary.isPending}>
            {t("pay:salary.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
