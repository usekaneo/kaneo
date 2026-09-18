import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AttendanceDay } from "@/fetchers/attendance";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format-duration";
import { zonedClock } from "@/lib/zoned-time";
import { DayStatusBadge } from "./day-status";

function Minutes({ value }: { value: number }) {
  return value > 0 ? (
    <span className="tabular-nums">{formatHours(value * 60)}</span>
  ) : (
    <span className="text-muted-foreground/50">–</span>
  );
}

function Seconds({ value }: { value: number }) {
  return <Minutes value={Math.round(value / 60)} />;
}

type Row = AttendanceDay & { label: React.ReactNode; key: string };

type Props = {
  rows: Row[];
  timeZone: string;
  firstColumn: string;
  totals?: {
    workedMinutes: number;
    overtimeMinutes: number;
    activeSeconds: number;
    idleSeconds: number;
  };
  onRowClick?: (row: Row) => void;
};

// Worked (clocked) time and desktop active/idle time are separate columns on
// purpose: being at the computer is not the same as working.
export function AttendanceTable({
  rows,
  timeZone,
  firstColumn,
  totals,
  onRowClick,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-4 font-medium text-foreground">
              {firstColumn}
            </TableHead>
            <TableHead className="w-36">
              {t("attendance:table.status")}
            </TableHead>
            <TableHead className="w-20 text-right">
              {t("attendance:table.in")}
            </TableHead>
            <TableHead className="w-20 text-right">
              {t("attendance:table.out")}
            </TableHead>
            <TableHead className="w-24 text-right">
              {t("attendance:table.worked")}
            </TableHead>
            <TableHead className="w-24 text-right">
              {t("attendance:table.active")}
            </TableHead>
            <TableHead className="w-24 text-right">
              {t("attendance:table.idle")}
            </TableHead>
            <TableHead className="w-24 pe-4 text-right">
              {t("attendance:table.overtime")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const off =
              row.status === "off" ||
              row.status === "upcoming" ||
              row.status === "notJoined";
            return (
              <TableRow
                key={row.key}
                className={cn(
                  off && "text-muted-foreground",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <TableCell className="ps-4">{row.label}</TableCell>
                <TableCell>{!off && <DayStatusBadge day={row} />}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.firstIn ? zonedClock(row.firstIn, timeZone) : "–"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.open ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t("attendance:table.now")}
                    </span>
                  ) : row.lastOut ? (
                    zonedClock(row.lastOut, timeZone)
                  ) : (
                    "–"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Minutes value={row.workedMinutes} />
                </TableCell>
                <TableCell className="text-right">
                  <Seconds value={row.activeSeconds} />
                </TableCell>
                <TableCell className="text-right">
                  <Seconds value={row.idleSeconds} />
                </TableCell>
                <TableCell className="pe-4 text-right">
                  <Minutes value={row.overtimeMinutes} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        {totals && (
          <TableFooter>
            <TableRow>
              <TableCell className="ps-4 font-medium">
                {t("time:sheet.total")}
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className="text-right font-medium">
                <Minutes value={totals.workedMinutes} />
              </TableCell>
              <TableCell className="text-right font-medium">
                <Seconds value={totals.activeSeconds} />
              </TableCell>
              <TableCell className="text-right font-medium">
                <Seconds value={totals.idleSeconds} />
              </TableCell>
              <TableCell className="pe-4 text-right font-medium">
                <Minutes value={totals.overtimeMinutes} />
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
