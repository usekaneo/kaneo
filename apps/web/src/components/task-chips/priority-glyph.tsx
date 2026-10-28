import { useUserPreferencesStore } from "@/store/user-preferences";
import { ClassicPriorityIcon } from "./classic-priority-icon";
import { PriorityMarks } from "./priority-marks";

type PriorityGlyphProps = {
  priority: string | null | undefined;
  className?: string;
};

export function PriorityGlyph({ priority, className }: PriorityGlyphProps) {
  const iconStyle = useUserPreferencesStore((state) => state.priorityIconStyle);

  if (iconStyle === "classic") {
    return <ClassicPriorityIcon priority={priority} className={className} />;
  }
  return <PriorityMarks priority={priority} className={className} />;
}
