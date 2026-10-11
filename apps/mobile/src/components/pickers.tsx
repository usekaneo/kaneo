import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View, type KeyboardTypeOptions } from "react-native";

import {
  addDays,
  monthName,
  parseDay,
  sameDay,
  today,
  type Day,
} from "@/lib/format";
import { font, useColors } from "@/theme";

import { Sheet } from "./sheet";
import { Txt } from "./text";
import { Button, TextField, Touch } from "./ui";

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type Cell = { key: string; day: Day | null; weekend: boolean };

function monthGrid(y: number, m: number): Cell[][] {
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (Day | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => ({ y, m, d: i + 1 })),
  ];
  while (cells.length % 7) cells.push(null);
  const keyed = cells.map((day, i) => ({
    key: `cell-${i}`,
    day,
    weekend: i % 7 >= 5,
  }));
  const rows: Cell[][] = [];
  for (let i = 0; i < keyed.length; i += 7) rows.push(keyed.slice(i, i + 7));
  return rows;
}

export function DatePickerSheet({
  visible,
  onClose,
  title,
  value,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value?: string | null;
  onPick: (day: Day | null) => void;
}) {
  const pick = (day: Day | null) => {
    onPick(day);
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      aside={
        value ? (
          <Touch onPress={() => pick(null)} hitSlop={8}>
            <Txt variant="bodySm" weight="medium" tone="danger">
              Clear
            </Txt>
          </Touch>
        ) : null
      }
    >
      <Calendar value={value} onPick={pick} />
    </Sheet>
  );
}

export function Calendar({
  value,
  onPick,
}: {
  value?: string | null;
  onPick: (day: Day) => void;
}) {
  const c = useColors();
  const selected = parseDay(value);
  const now = today();
  const [month, setMonth] = useState({
    y: (selected ?? now).y,
    m: (selected ?? now).m,
  });
  const pick = onPick;
  const shift = (n: number) => {
    const d = new Date(month.y, month.m + n, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const nextMonday = addDays(now, 7 - ((new Date().getDay() + 6) % 7));

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          paddingHorizontal: 20,
          paddingBottom: 14,
        }}
      >
        {[
          { label: "Today", day: now },
          { label: "Tomorrow", day: addDays(now, 1) },
          { label: "Next week", day: nextMonday },
        ].map((q) => (
          <Button
            key={q.label}
            label={q.label}
            kind="secondary"
            size="sm"
            grow
            onPress={() => pick(q.day)}
          />
        ))}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 4,
            paddingBottom: 6,
          }}
        >
          <Txt variant="body" weight="semibold">
            {monthName(month.m, true)} {month.y}
          </Txt>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {[-1, 1].map((n) => (
              <Touch
                key={n}
                onPress={() => shift(n)}
                accessibilityLabel={n < 0 ? "Previous month" : "Next month"}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.hairline,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {n < 0 ? (
                  <ChevronLeft size={14} color={c.body} />
                ) : (
                  <ChevronRight size={14} color={c.body} />
                )}
              </Touch>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: "row" }}>
          {WEEK.map((w) => (
            <Txt
              key={w}
              variant="micro"
              tone="faint"
              center
              style={{ flex: 1 }}
            >
              {w}
            </Txt>
          ))}
        </View>
        {monthGrid(month.y, month.m).map((row) => (
          <View key={row[0].key} style={{ flexDirection: "row" }}>
            {row.map(({ key, day, weekend }) => {
              if (!day)
                return <View key={key} style={{ flex: 1, height: 40 }} />;
              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, now);
              return (
                <Touch
                  key={key}
                  onPress={() => pick(day)}
                  style={{
                    flex: 1,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? c.primary : "transparent",
                      borderWidth: isToday && !isSelected ? 1.5 : 0,
                      borderColor: c.ink,
                    }}
                  >
                    <Txt
                      style={{
                        fontFamily:
                          isSelected || isToday ? font.monoMedium : font.mono,
                        fontSize: 14,
                      }}
                      color={
                        isSelected ? c.onPrimary : weekend ? c.ink2 : c.ink
                      }
                    >
                      {day.d}
                    </Txt>
                  </View>
                </Touch>
              );
            })}
          </View>
        ))}
      </View>
    </>
  );
}

/** One text field and a confirm button in a sheet: rename, edit comment, custom field value. */
export function TextInputSheet({
  visible,
  onClose,
  title,
  label,
  initial = "",
  placeholder,
  confirmLabel = "Save",
  multiline,
  keyboardType,
  validate,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  validate?: (value: string) => boolean;
  onSubmit: (value: string) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <TextInputForm
        label={label}
        initial={initial}
        placeholder={placeholder}
        confirmLabel={confirmLabel}
        multiline={multiline}
        keyboardType={keyboardType}
        validate={validate}
        onSubmit={(v) => {
          onSubmit(v);
          onClose();
        }}
      />
    </Sheet>
  );
}

function TextInputForm({
  label,
  initial,
  placeholder,
  confirmLabel,
  multiline,
  keyboardType,
  validate,
  onSubmit,
}: {
  label?: string;
  initial: string;
  placeholder?: string;
  confirmLabel: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  validate?: (value: string) => boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const valid = validate ? validate(value) : value.trim().length > 0;
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
      <TextField
        label={label}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus
      />
      <Button
        label={confirmLabel}
        disabled={!valid}
        onPress={() => onSubmit(value.trim())}
      />
    </View>
  );
}
