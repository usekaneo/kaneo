import {
  Bookmark,
  Bug,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  FileText,
  Flag,
  Lightbulb,
  ListTodo,
  type LucideIcon,
  Rocket,
  Shapes,
  TriangleAlert,
  Wrench,
  Zap,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  bookmark: Bookmark,
  bug: Bug,
  "circle-check": CircleCheck,
  "circle-help": CircleHelp,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  flag: Flag,
  lightbulb: Lightbulb,
  "list-todo": ListTodo,
  rocket: Rocket,
  "triangle-alert": TriangleAlert,
  wrench: Wrench,
  zap: Zap,
};

type ItemTypeIconProps = {
  icon?: string | null;
  className?: string;
};

export default function ItemTypeIcon({ icon, className }: ItemTypeIconProps) {
  const Icon = (icon && icons[icon]) || Shapes;
  return <Icon className={className} aria-hidden="true" />;
}
