import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StorageSettings } from "@/components/files/storage-settings";
import PageTitle from "@/components/page-title";
import {
  ScheduleFields,
  type ScheduleValue,
} from "@/components/people/schedule-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CompanySettings } from "@/fetchers/company/get-company-settings";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useUpdateCompanySettings,
} from "@/hooks/mutations/company/use-company-mutations";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import useDepartments from "@/hooks/queries/company/use-departments";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/company",
)({
  component: RouteComponent,
});

function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="sm:w-64">{children}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-md font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
        {children}
      </div>
    </div>
  );
}

type Draft = Omit<CompanySettings, "workspaceId">;

function Departments({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { data: departments = [] } = useDepartments(workspaceId);
  const { mutateAsync: create, isPending } = useCreateDepartment(workspaceId);
  const { mutateAsync: remove } = useDeleteDepartment(workspaceId);
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    try {
      await create(name.trim());
      setName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("company:departments.error"),
      );
    }
  };

  return (
    <div className="space-y-3">
      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("company:departments.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {departments.map((department) => (
            <li
              key={department.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>
                {department.name}
                <span className="ms-2 text-xs text-muted-foreground">
                  {t("company:departments.people", {
                    count: department.memberCount,
                  })}
                </span>
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("company:departments.delete", {
                    name: department.name,
                  })}
                  onClick={() => remove(department.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("company:departments.placeholder")}
            aria-label={t("company:departments.placeholder")}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending}
          >
            {t("company:departments.add")}
          </Button>
        </form>
      )}
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const id = useId();
  const { workspace, canManageWorkspace, canManagePeople } =
    useWorkspacePermission();
  const workspaceId = workspace?.id;
  const { data: settings } = useCompanySettings(workspaceId);
  const { mutateAsync: save, isPending } = useUpdateCompanySettings();
  const canEdit = Boolean(canManageWorkspace());
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (settings) {
      const { workspaceId: _ignored, ...rest } = settings;
      setDraft(rest);
    }
  }, [settings]);

  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);

  if (!workspaceId || !draft) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const schedule: ScheduleValue = {
    workDays: draft.workDays,
    workStart: draft.workStart,
    workEnd: draft.workEnd,
    breakMinutes: draft.breakMinutes,
  };

  const submit = async () => {
    if (draft.workDays.length === 0) {
      toast.error(t("people:edit.needWorkDay"));
      return;
    }
    try {
      await save({ workspaceId, ...draft });
      toast.success(t("company:saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("company:error"));
    }
  };

  return (
    <>
      <PageTitle title={t("company:title")} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("company:title")}</h1>
          <p className="text-muted-foreground">{t("company:subtitle")}</p>
        </div>

        <fieldset disabled={!canEdit} className="space-y-8">
          <Section
            title={t("company:basics.title")}
            subtitle={t("company:basics.subtitle")}
          >
            <Row
              label={t("company:basics.timezone")}
              hint={t("company:basics.timezoneHint")}
              htmlFor={`${id}-tz`}
            >
              <Input
                id={`${id}-tz`}
                list={`${id}-tz-list`}
                value={draft.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
              <datalist id={`${id}-tz-list`}>
                {timeZones.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            </Row>
            <Row
              label={t("company:basics.currency")}
              hint={t("company:basics.currencyHint")}
              htmlFor={`${id}-currency`}
            >
              <Input
                id={`${id}-currency`}
                maxLength={3}
                value={draft.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
              />
            </Row>
          </Section>

          <Section
            title={t("company:schedule.title")}
            subtitle={t("company:schedule.subtitle")}
          >
            <ScheduleFields
              value={schedule}
              onChange={(value) =>
                setDraft((d) => (d ? { ...d, ...value } : d))
              }
            />
            <Row
              label={t("company:schedule.lateGrace")}
              hint={t("company:schedule.lateGraceHint")}
              htmlFor={`${id}-grace`}
            >
              <Input
                id={`${id}-grace`}
                type="number"
                min={0}
                max={240}
                value={draft.lateGraceMinutes}
                onChange={(e) =>
                  set(
                    "lateGraceMinutes",
                    Math.min(240, Math.max(0, Number(e.target.value) || 0)),
                  )
                }
              />
            </Row>
          </Section>

          <Section
            title={t("company:autoClock.title")}
            subtitle={t("company:autoClock.subtitle")}
          >
            <Row
              label={t("company:autoClock.enabled")}
              hint={t("company:autoClock.enabledHint")}
            >
              <Switch
                aria-label={t("company:autoClock.enabled")}
                checked={draft.autoClock}
                onCheckedChange={(checked) => set("autoClock", checked)}
              />
            </Row>
            {draft.autoClock && (
              <>
                <Row
                  label={t("company:autoClock.idleMinutes")}
                  hint={t("company:autoClock.idleMinutesHint")}
                  htmlFor={`${id}-auto-idle`}
                >
                  <Input
                    id={`${id}-auto-idle`}
                    type="number"
                    min={5}
                    max={240}
                    value={draft.autoClockIdleMinutes}
                    onChange={(e) =>
                      set(
                        "autoClockIdleMinutes",
                        Math.min(240, Math.max(5, Number(e.target.value) || 5)),
                      )
                    }
                  />
                </Row>
                <Row
                  label={t("company:autoClock.offlineMinutes")}
                  hint={t("company:autoClock.offlineMinutesHint")}
                  htmlFor={`${id}-auto-offline`}
                >
                  <Input
                    id={`${id}-auto-offline`}
                    type="number"
                    min={3}
                    max={240}
                    value={draft.autoClockOfflineMinutes}
                    onChange={(e) =>
                      set(
                        "autoClockOfflineMinutes",
                        Math.min(240, Math.max(3, Number(e.target.value) || 3)),
                      )
                    }
                  />
                </Row>
              </>
            )}
          </Section>

          <Section
            title={t("company:leave.title")}
            subtitle={t("company:leave.subtitle")}
          >
            <Row label={t("company:leave.annualDays")} htmlFor={`${id}-leave`}>
              <Input
                id={`${id}-leave`}
                type="number"
                min={0}
                max={365}
                value={draft.annualLeaveDays}
                onChange={(e) =>
                  set("annualLeaveDays", Number(e.target.value) || 0)
                }
              />
            </Row>
            <Row
              label={t("company:leave.overtimeRate")}
              hint={t("company:leave.overtimeRateHint")}
              htmlFor={`${id}-ot`}
            >
              <Input
                id={`${id}-ot`}
                type="number"
                min={0}
                max={500}
                value={draft.overtimeRatePercent}
                onChange={(e) =>
                  set("overtimeRatePercent", Number(e.target.value) || 0)
                }
              />
            </Row>
          </Section>

          <Section
            title={t("company:activity.title")}
            subtitle={t("company:activity.subtitle")}
          >
            <Row
              label={t("company:activity.trackDomains")}
              hint={t("company:activity.trackDomainsHint")}
            >
              <Switch
                checked={draft.trackDomains}
                onCheckedChange={(checked) => set("trackDomains", checked)}
              />
            </Row>
            <Row
              label={t("company:activity.detailDays")}
              hint={t("company:activity.detailDaysHint")}
              htmlFor={`${id}-detail`}
            >
              <Input
                id={`${id}-detail`}
                type="number"
                min={7}
                max={365}
                value={draft.activityDetailDays}
                onChange={(e) =>
                  set("activityDetailDays", Number(e.target.value) || 0)
                }
              />
            </Row>
            <Row
              label={t("company:activity.summaryDays")}
              hint={t("company:activity.summaryDaysHint")}
              htmlFor={`${id}-summary`}
            >
              <Input
                id={`${id}-summary`}
                type="number"
                min={30}
                max={1095}
                value={draft.activitySummaryDays}
                onChange={(e) =>
                  set("activitySummaryDays", Number(e.target.value) || 0)
                }
              />
            </Row>
          </Section>
        </fieldset>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={submit} disabled={isPending}>
              {t("company:save")}
            </Button>
          </div>
        )}

        <Section
          title={t("company:departments.title")}
          subtitle={t("company:departments.subtitle")}
        >
          <Departments
            workspaceId={workspaceId}
            canEdit={Boolean(canManagePeople())}
          />
        </Section>

        {canEdit && (
          <Section
            title={t("files:storage.title")}
            subtitle={t("files:storage.subtitle")}
          >
            <StorageSettings workspaceId={workspaceId} canEdit={canEdit} />
          </Section>
        )}
      </div>
    </>
  );
}
