import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { FilterSubject } from "./filter-subject";

export function FilterOperatorMenu({ subject }: { subject: FilterSubject }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="h-full shrink-0 px-2 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent data-popup-open:bg-accent"
          />
        }
      >
        {subject.negated
          ? subject.operators.negative
          : subject.operators.positive}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        <DropdownMenuRadioGroup
          value={subject.negated ? "negative" : "positive"}
          onValueChange={(value) => subject.onNegate(value === "negative")}
        >
          <DropdownMenuRadioItem value="positive" closeOnClick>
            {subject.operators.positive}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="negative" closeOnClick>
            {subject.operators.negative}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
