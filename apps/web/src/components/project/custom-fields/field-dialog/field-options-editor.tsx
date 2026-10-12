import { AddOptionInput } from "@/components/project/custom-fields/field-dialog/add-option-input";
import { FieldOptionRow } from "@/components/project/custom-fields/field-dialog/field-option-row";
import { SortableList } from "@/components/project/sortable/sortable-list";

type FieldOptionsEditorProps = {
  options: string[];
  labelledBy: string;
  onAdd: (option: string) => void;
  onRename: (from: string, to: string) => boolean;
  onRemove: (option: string) => void;
  onMove: (from: number, to: number) => void;
};

export function FieldOptionsEditor({
  options,
  labelledBy,
  onAdd,
  onRename,
  onRemove,
  onMove,
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
            onRename={(to) => onRename(option, to)}
            onRemove={() => onRemove(option)}
          />
        ))}
      </SortableList>
      <AddOptionInput onAdd={onAdd} />
    </div>
  );
}
