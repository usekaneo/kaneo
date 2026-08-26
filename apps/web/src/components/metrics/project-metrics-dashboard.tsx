import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectMetrics } from "@/fetchers/project/get-project-metrics";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ProjectMetricsDashboardProps = {
  metrics: ProjectMetrics;
};

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function ProjectMetricsSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function ProjectMetricsDashboard({
  metrics,
}: ProjectMetricsDashboardProps) {
  const { t } = useTranslation();

  const columnData = metrics.columns.map((column, index) => ({
    name: column.name,
    count: column.count,
    fill: column.color || CHART_COLORS[index % CHART_COLORS.length],
  }));

  const assigneeChartData = metrics.assignees
    .filter((assignee) => assignee.userId)
    .slice(0, 8)
    .map((assignee) => ({
      name: assignee.name.split(" ")[0] || assignee.name,
      assigned: assignee.assigned,
      done: assignee.done,
      inProgress: assignee.inProgress,
    }));

  const contractData =
    metrics.contracts.byStatus.length > 0
      ? metrics.contracts.byStatus.map((row, index) => ({
          name: t(`workspace:metrics.contractStatus.${row.status}`, {
            defaultValue: row.status,
          }),
          value: row.count,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        }))
      : [
          {
            name: t("workspace:metrics.noContracts"),
            value: 0,
            fill: CHART_COLORS[0],
          },
        ];

  const priorityData = metrics.priority.map((row) => ({
    name: t(`tasks:priority.${row.priority}`, {
      defaultValue: row.priority,
    }),
    count: row.count,
  }));

  const activityData = metrics.activity.map((point) => ({
    ...point,
    label: formatShortDate(point.date),
  }));

  const summaryItems = [
    {
      label: t("workspace:metrics.summary.total"),
      value: metrics.summary.totalTasks,
    },
    {
      label: t("workspace:metrics.summary.completed"),
      value: metrics.summary.completedTasks,
    },
    {
      label: t("workspace:metrics.summary.inProgress"),
      value: metrics.summary.inProgressTasks,
    },
    {
      label: t("workspace:metrics.summary.overdue"),
      value: metrics.summary.overdueTasks,
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-10 p-4 pb-10">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex w-full min-w-0 flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl tracking-tight text-foreground">
            {metrics.projectName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("workspace:metrics.completionLabel", {
              percent: metrics.summary.completionPercentage,
            })}
          </p>
        </div>
        <Progress
          value={metrics.summary.completionPercentage}
          className="h-2 max-w-md"
        />
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          data-tour="metrics-summary"
        >
          {summaryItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * index }}
            >
              <Card className="border-border/70 bg-card/80">
                <CardHeader className="gap-1 pb-2">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="font-heading text-3xl tabular-nums tracking-tight">
                    {item.value}
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="flex w-full min-w-0 flex-col gap-3"
      >
        <div>
          <h3 className="font-heading text-lg text-foreground">
            {t("workspace:metrics.columnsTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("workspace:metrics.columnsDescription")}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={columnData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/60"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {columnData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <div className="grid w-full min-w-0 gap-8 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="flex min-w-0 flex-col gap-3"
        >
          <div>
            <h3 className="font-heading text-lg text-foreground">
              {t("workspace:metrics.contractsTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("workspace:metrics.contractsDescription", {
                count: metrics.contracts.total,
              })}
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="h-64 w-full">
                {metrics.contracts.total === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("workspace:metrics.noContracts")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contractData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {contractData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => (
                          <span className="text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="flex min-w-0 flex-col gap-3"
        >
          <div>
            <h3 className="font-heading text-lg text-foreground">
              {t("workspace:metrics.priorityTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("workspace:metrics.priorityDescription")}
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="h-64 w-full">
                {priorityData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("workspace:metrics.noTasks")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={priorityData}
                      layout="vertical"
                      margin={{ left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/60"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={88}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--chart-2)"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex w-full min-w-0 flex-col gap-3"
      >
        <div>
          <h3 className="font-heading text-lg text-foreground">
            {t("workspace:metrics.assigneesTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("workspace:metrics.assigneesDescription")}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            {assigneeChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {t("workspace:metrics.noAssignees")}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assigneeChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/60"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        width={32}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="assigned"
                        name={t("workspace:metrics.assignee.assigned")}
                        fill="var(--chart-1)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="inProgress"
                        name={t("workspace:metrics.assignee.inProgress")}
                        fill="var(--chart-3)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="done"
                        name={t("workspace:metrics.assignee.done")}
                        fill="var(--chart-2)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("workspace:metrics.table.user")}</TableHead>
                      <TableHead className="text-right">
                        {t("workspace:metrics.assignee.assigned")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("workspace:metrics.assignee.inProgress")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("workspace:metrics.assignee.done")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.assignees.map((assignee) => (
                      <TableRow key={assignee.userId ?? "unassigned"}>
                        <TableCell className="font-medium">
                          {assignee.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {assignee.assigned}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {assignee.inProgress}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {assignee.done}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        className="flex w-full min-w-0 flex-col gap-3"
      >
        <div>
          <h3 className="font-heading text-lg text-foreground">
            {t("workspace:metrics.activityTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("workspace:metrics.activityDescription")}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/60"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name={t("workspace:metrics.activity.created")}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name={t("workspace:metrics.activity.completed")}
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
