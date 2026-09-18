import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { ExpensesOverview } from "@/components/expenses/expenses-overview";
import PageTitle from "@/components/page-title";
import { PayrollRuns } from "@/components/pay/payroll-runs";
import { SalariesTable } from "@/components/pay/salaries-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

const TABS = ["expenses", "payroll", "salaries"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/expenses/",
)({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(search.tab as Tab) ? { tab: search.tab as Tab } : {},
  component: RouteComponent,
});

// Money in one place: everyone's expenses, and for payroll people the monthly
// payrolls and salaries too.
function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { canSeePay } = useWorkspacePermission();
  const seePay = Boolean(canSeePay());
  const { data: company } = useCompanySettings(workspaceId);
  const currency = company?.currency ?? "USD";
  const active: Tab = seePay && tab ? tab : "expenses";

  const content = (
    <ExpensesOverview workspaceId={workspaceId} currency={currency} />
  );

  return (
    <>
      <PageTitle title={t("expenses:title")} />
      <WorkspaceLayout title={t("expenses:title")}>
        {seePay ? (
          <Tabs
            value={active}
            onValueChange={(value) =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/expenses",
                params: { workspaceId },
                search: value === "expenses" ? {} : { tab: value as Tab },
                replace: true,
              })
            }
            className="pt-4"
          >
            <TabsList className="mx-4">
              <TabsTrigger value="expenses">
                {t("expenses:tabs.expenses")}
              </TabsTrigger>
              <TabsTrigger value="payroll">{t("pay:tabs.runs")}</TabsTrigger>
              <TabsTrigger value="salaries">
                {t("pay:tabs.salaries")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="expenses" className="p-4">
              {content}
            </TabsContent>
            <TabsContent value="payroll" className="p-4">
              <PayrollRuns workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="salaries" className="p-4">
              <SalariesTable workspaceId={workspaceId} currency={currency} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-4">{content}</div>
        )}
      </WorkspaceLayout>
    </>
  );
}
