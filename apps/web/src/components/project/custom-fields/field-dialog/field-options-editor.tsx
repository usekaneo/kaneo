import { AddOptionInput } from "@/components/project/custom-fields/field-dialog/add-option-input";
import { FieldOptionRow } from "@/components/project/custom-fields/field-dialog/field-option-row";
import { SortableList } from "@/components/project/sortable/sortable-list";

type FieldOptionsEditorProps = {
  options: string[];
  hiddenOptions: string[];
  labelledBy: string;
  onAdd: (option: string) => void;
  onRename: (from: string, to: string) => boolean;
  onRemove: (option: string) => void;
  onMove: (from: number, to: number) => void;
  onToggleHidden?: (option: string) => void;
};

export function FieldOptionsEditor({
  options,
  hiddenOptions,
  labelledBy,
  onAdd,
  onRename,
  onRemove,
  onMove,
  onToggleHidden,
}: FieldOptionsEditorProps) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="divide-y divide-border overflow-hidden rounded-lg border border-input bg-background dark:bg-input/32"
    >
      <SortableList ids={options} onMove={onMove}>
        {options.map((option) => (
          <FieldOptionRow
            key={option}
            option={option}
            hidden={hiddenOptions.includes(option)}
            onRename={(to) => onRename(option, to)}
            onRemove={() => onRemove(option)}
            onToggleHidden={
              onToggleHidden ? () => onToggleHidden(option) : undefined
            }
          />
        ))}
      </SortableList>
      <AddOptionInput onAdd={onAdd} />
    </div>
  );
}
