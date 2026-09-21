import { CalendarClock, FileText, Pause, Play } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  formatDateShort,
  formatDuration,
  formatDurationExact,
  parseDurationString,
} from "@/lib/format";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date) {
  return Math.round(
    (startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000,
  );
}

function DatePicker({
  value,
  onChange,
  label,
}: {
  value: Date;
  onChange: (next: Date) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 flex-1 px-1.5 text-[11px]"
            aria-label={label}
          />
        }
      >
        {formatDateShort(value)}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (!date) return;
            const next = new Date(value);
            next.setFullYear(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
            );
            onChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function TimePicker({
  value,
  onChange,
  label,
}: {
  value: Date;
  onChange: (next: Date) => void;
  label: string;
}) {
  const toInputValue = (date: Date) => {
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Typed text commits only once it is a complete HH:MM, so partial input
  // never corrupts the form. An externally changed value resyncs the display.
  const [text, setText] = useState<string | null>(null);
  const formatted = toInputValue(value);
  const lastFormatted = useRef(formatted);
  if (lastFormatted.current !== formatted) {
    lastFormatted.current = formatted;
    setText(null);
  }

  return (
    <Input
      type="time"
      aria-label={label}
      className="h-7 min-w-0 flex-1 px-0.5 text-[11px] tabular-nums"
      value={text ?? formatted}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        const match = /^(\d{2}):(\d{2})/.exec(raw);
        if (!match) return;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (hours > 23 || minutes > 59) return;
        const updated = new Date(value);
        updated.setHours(hours, minutes, 0, 0);
        onChange(updated);
      }}
    />
  );
}

export type TimeEntryFormValue = {
  start: Date;
  end: Date;
  notes: string;
  billable: boolean;
};

type TimeEntryFormProps = {
  initialStart: Date;
  initialEnd: Date;
  initialNotes: string;
  initialBillable: boolean;
  isPending: boolean;
  onSave: (value: TimeEntryFormValue) => void;
  /** Live elapsed of the running entry, if the form's task is tracking. */
  liveElapsed?: number | null;
  /** Hides save while a timer runs on the form's task. */
  hideSave?: boolean;
  /**
   * Save requires drifting from the preloaded values. Off for manual logging,
   * where the untouched defaults already describe a real entry.
   */
  requireDirty?: boolean;
  /**
   * Timer toggle beside the duration input. Receives the current notes and
   * billable flag so a start carries exactly what the form shows.
   */
  timer?: {
    running: boolean;
    pending: boolean;
    onToggle: (notes: string, billable: boolean) => void;
  } | null;
};

/**
 * Shared start/end editor for manual logging and entry editing. Only the
 * start day is selectable; the end keeps its day offset from the start, so
 * shifting the start day moves the whole range. Times are confirmed
 * independently with 15-minute pickers.
 */
export default function TimeEntryForm({
  initialStart,
  initialEnd,
  initialNotes,
  initialBillable,
  isPending,
  onSave,
  liveElapsed = null,
  hideSave = false,
  requireDirty = true,
  timer = null,
}: TimeEntryFormProps) {
  const { t } = useTranslation();
  const formId = useId();
  // Initialized once per mount. Parents key the form by entry (`key`), so a
  // new entry always mounts a fresh form and typing never resets state.
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [dayOffset, setDayOffset] = useState(() =>
    Math.max(0, daysBetween(initialStart, initialEnd)),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [billable, setBillable] = useState(initialBillable);
  // Baseline captured once per mount (parents key by entry). Save requires
  // drifting from it, so an untouched form can never submit a no-op.
  const [baseline] = useState(() => ({
    start: initialStart.getTime(),
    end: initialEnd.getTime(),
    notes: initialNotes,
    billable: initialBillable,
  }));
  const secondsBetween = (from: Date, to: Date) =>
    Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  const [durationText, setDurationText] = useState(() =>
    formatDuration(secondsBetween(initialStart, initialEnd)),
  );

  const valid = end.getTime() > start.getTime();
  const dirty =
    start.getTime() !== baseline.start ||
    end.getTime() !== baseline.end ||
    notes !== baseline.notes ||
    billable !== baseline.billable;

  const syncDurationText = (from: Date, to: Date) => {
    if (to.getTime() > from.getTime()) {
      setDurationText(formatDuration(secondsBetween(from, to)));
    }
  };

  const commitDurationText = () => {
    const seconds = parseDurationString(durationText);
    if (seconds === null || seconds <= 0) {
      // Rejected input reverts to the pickers' duration.
      setDurationText(formatDuration(secondsBetween(start, end)));
      return;
    }
    if (seconds === secondsBetween(start, end)) {
      return;
    }
    const nextEnd = new Date(start.getTime() + seconds * 1000);
    setEnd(nextEnd);
    setDayOffset(Math.max(0, daysBetween(start, nextEnd)));
  };

  const handleStartDate = (next: Date) => {
    const nextEnd = new Date(
      startOfDay(next).getTime() +
        dayOffset * 86_400_000 +
        (end.getTime() - startOfDay(end).getTime()),
    );
    setStart(next);
    setEnd(nextEnd);
    syncDurationText(next, nextEnd);
  };

  const handleStartTime = (next: Date) => {
    setStart(next);
    if (end.getTime() <= next.getTime()) {
      const nextEnd = new Date(next.getTime() + 3600_000);
      setEnd(nextEnd);
      setDayOffset(Math.max(0, daysBetween(next, nextEnd)));
      syncDurationText(next, nextEnd);
    } else {
      syncDurationText(next, end);
    }
  };

  const handleEndTime = (next: Date) => {
    // End time is confirmed on the end day derived from the start day.
    const endDay = new Date(
      startOfDay(start).getTime() + dayOffset * 86_400_000,
    );
    const nextEnd = new Date(
      endDay.getFullYear(),
      endDay.getMonth(),
      endDay.getDate(),
      next.getHours(),
      next.getMinutes(),
    );
    setEnd(nextEnd);
    syncDurationText(start, nextEnd);
  };

  // While the form's task tracks, the duration line locks onto the live
  // entry: disabled, ticking hh:mm:ss, no typing.
  const locked = liveElapsed !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          id={`${formId}-duration`}
          placeholder={t("tasks:timeTracking.durationInputPlaceholder")}
          aria-label={t("tasks:timeTracking.duration")}
          disabled={locked}
          className="h-8 min-w-0 flex-1 text-xs tabular-nums"
          value={locked ? formatDurationExact(liveElapsed) : durationText}
          onChange={(event) => setDurationText(event.target.value)}
          onBlur={() => commitDurationText()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
            if (event.key === "Escape") {
              setDurationText(formatDuration(secondsBetween(start, end)));
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
        {timer && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            disabled={timer.pending}
            onClick={() => timer.onToggle(notes, billable)}
            aria-label={
              timer.running
                ? t("tasks:timeTracking.stop")
                : t("tasks:timeTracking.start")
            }
          >
            {timer.running ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <CalendarClock
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <DatePicker
          value={start}
          label={t("tasks:timeTracking.startTime")}
          onChange={handleStartDate}
        />
        {dayOffset > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground/80">
            → {formatDateShort(end)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 pl-6">
        <TimePicker
          value={start}
          label={t("tasks:timeTracking.startTime")}
          onChange={handleStartTime}
        />
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          -
        </span>
        <TimePicker
          value={end}
          label={t("tasks:timeTracking.endTime")}
          onChange={handleEndTime}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <FileText
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={`${formId}-notes`}
          placeholder={t("tasks:timeTracking.descriptionPlaceholder")}
          aria-label={t("tasks:timeTracking.description")}
          disabled={locked}
          className="h-8 min-w-0 flex-1 text-xs"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`${formId}-billable`}
          className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground"
        >
          <Switch
            id={`${formId}-billable`}
            checked={billable}
            disabled={locked}
            onCheckedChange={setBillable}
          />
          {t("tasks:timeTracking.billable")}
        </label>
        {!hideSave && (
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!valid || (requireDirty && !dirty) || isPending}
            onClick={() => onSave({ start, end, notes, billable })}
          >
            {t("tasks:timeTracking.save")}
          </Button>
        )}
      </div>
    </div>
  );
}
