import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { PersonDetail } from "@/fetchers/people/get-person";
import useUpdatePerson from "@/hooks/mutations/people/use-update-person";
import useDepartments from "@/hooks/queries/company/use-departments";
import { toast } from "@/lib/toast";
import { personStatusLabel } from "./labels";
import { ScheduleFields, type ScheduleValue } from "./schedule-fields";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  person: PersonDetail;
};

const NO_DEPARTMENT = "__none__";
const STATUSES = ["active", "on_leave", "inactive"] as const;

export function EditPersonDialog({
  open,
  onClose,
  workspaceId,
  person,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const { data: departments = [] } = useDepartments(workspaceId);
  const { mutateAsync: updatePerson, isPending } = useUpdatePerson(
    person.userId,
  );

  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState(NO_DEPARTMENT);
  const [joinDate, setJoinDate] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("active");
  const [customSchedule, setCustomSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleValue>(person.schedule);

  useEffect(() => {
    if (!open) return;
    setTitle(person.title ?? "");
    setDepartmentId(person.departmentId ?? NO_DEPARTMENT);
    setJoinDate(person.joinDate ?? "");
    setStatus(
      (STATUSES as readonly string[]).includes(person.status)
        ? (person.status as (typeof STATUSES)[number])
        : "active",
    );
    const o = person.overrides;
    setCustomSchedule(
      Boolean(
        o.workDays || o.workStart || o.workEnd || o.breakMinutes !== null,
      ),
    );
    setSchedule(person.schedule);
  }, [open, person]);

  const save = async () => {
    if (customSchedule && schedule.workDays.length === 0) {
      toast.error(t("people:edit.needWorkDay"));
      return;
    }
    try {
      await updatePerson({
        workspaceId,
        title: title.trim() || null,
        departmentId: departmentId === NO_DEPARTMENT ? null : departmentId,
        joinDate: joinDate || null,
        status,
        workDays: customSchedule ? schedule.workDays : null,
        workStart: customSchedule ? schedule.workStart : null,
        workEnd: customSchedule ? schedule.workEnd : null,
        breakMinutes: customSchedule ? schedule.breakMinutes : null,
      });
      toast.success(t("people:edit.saved"));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("people:edit.error"),
      );
    }
  };

  const departmentName =
    departmentId === NO_DEPARTMENT
      ? t("people:edit.noDepartment")
      : (departments.find((d) => d.id === departmentId)?.name ?? "");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("people:edit.title", { name: person.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-title`}>{t("people:fields.title")}</Label>
              <Input
                id={`${id}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("people:edit.titlePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("people:fields.department")}</Label>
              <Select
                value={departmentId}
                onValueChange={(value) => {
                  if (typeof value === "string") setDepartmentId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue>{departmentName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>
                    {t("people:edit.noDepartment")}
                  </SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-join`}>
                {t("people:fields.joinDate")}
              </Label>
              <Input
                id={`${id}-join`}
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("people:fields.status")}</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setStatus(value as (typeof STATUSES)[number]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue>{personStatusLabel(t, status)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {personStatusLabel(t, s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox
                checked={customSchedule}
                onCheckedChange={(checked) =>
                  setCustomSchedule(checked === true)
                }
              />
              {t("people:edit.customSchedule")}
            </Label>
            <ScheduleFields
              value={schedule}
              onChange={setSchedule}
              disabled={!customSchedule}
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" type="button" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button size="sm" onClick={save} disabled={isPending}>
            {t("people:edit.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
