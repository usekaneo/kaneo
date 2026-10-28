import {
  Archive,
  BookOpen,
  Bookmark,
  Box,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircuitBoard,
  Code,
  Cog,
  Database,
  FileText,
  Flag,
  FlaskConical,
  Folder,
  FolderKanban,
  GitBranch,
  Globe,
  Heart,
  Home,
  Image,
  Layers,
  Layout,
  Lightbulb,
  Link2,
  List,
  type LucideIcon,
  MessageSquare,
  Minus,
  Music,
  Package,
  Palette,
  PenTool,
  Phone,
  PieChart,
  Puzzle,
  Radio,
  Rocket,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Smile,
  Star,
  Table,
  Tags,
  Target,
  Terminal,
  ThumbsUp,
  Timer,
  Trash2,
  Trophy,
  Tv2,
  User,
  Users,
  Video,
  Wallet,
  Wand2,
  Watch,
  Zap,
} from "lucide-react-native";

import { useColors } from "@/theme";

/**
 * The icon names Kaneo stores on projects and workflow columns (`project.icon`, `column.icon`),
 * mapped to the same lucide icons the web app renders.
 */
const NAMED_ICONS: Record<string, LucideIcon> = {
  Layout,
  Briefcase,
  FolderKanban,
  Target,
  Rocket,
  Code,
  Box,
  Boxes,
  BookOpen,
  Bookmark,
  Building2,
  Calendar,
  CircuitBoard,
  Cog,
  Database,
  FileText,
  Flag,
  FlaskConical,
  Folder,
  GitBranch,
  Globe,
  Heart,
  Home,
  Image,
  Layers,
  Lightbulb,
  Link2,
  List,
  MessageSquare,
  Music,
  Package,
  Palette,
  PenTool,
  Phone,
  PieChart,
  Puzzle,
  Radio,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Smile,
  Star,
  Table,
  Tags,
  Terminal,
  ThumbsUp,
  Timer,
  Tool: PenTool,
  Trash2,
  Trophy,
  Tv2,
  User,
  Users,
  Video,
  Wallet,
  Wand2,
  Watch,
  Zap,
  Circle,
  CircleDot,
  CircleDashed,
  CheckCircle2: CircleCheck,
  Archive,
};

/** Kaneo's default icon for each built-in column slug. */
const STATUS_ICONS: Record<string, string> = {
  "to-do": "Circle",
  "in-progress": "CircleDot",
  "in-review": "Search",
  done: "CheckCircle2",
  archived: "Archive",
  planned: "CircleDashed",
};

/**
 * A workflow column's icon, resolved like the web app: the column's own icon, then the default for
 * its slug, then a check for final columns and a plain circle for the rest. Always muted; Kaneo keeps
 * status monochrome and saves color for priority, due dates and labels.
 */
export function StatusIcon({
  status,
  icon,
  isFinal,
  size = 16,
  color,
}: {
  status: string;
  icon?: string | null;
  isFinal?: boolean;
  size?: number;
  color?: string;
}) {
  const c = useColors();
  const name = icon || STATUS_ICONS[status];
  const Icon = (name && NAMED_ICONS[name]) || (isFinal ? CircleCheck : Circle);
  return <Icon size={size} color={color ?? c.muted} strokeWidth={2} />;
}

/** A project's icon (`project.icon`), defaulting to Kaneo's `Layout`. */
export function ProjectIcon({
  name,
  size = 16,
  color,
}: {
  name?: string | null;
  size?: number;
  color?: string;
}) {
  const c = useColors();
  const Icon = (name && NAMED_ICONS[name]) || Layout;
  return <Icon size={size} color={color ?? c.muted} strokeWidth={2} />;
}

/** Priority glyphs and colors from the web app: chevrons in warning/info tones, an alert for urgent. */
export function PriorityIcon({
  priority,
  size = 14,
}: {
  priority?: string | null;
  size?: number;
}) {
  const c = useColors();
  switch (priority) {
    case "urgent":
      return <CircleAlert size={size} color={c.danger} strokeWidth={2} />;
    case "high":
      return <ChevronsUp size={size} color={c.warningFg} strokeWidth={2} />;
    case "medium":
      return (
        <ChevronUp
          size={size}
          color={c.warningFg}
          strokeWidth={2}
          opacity={0.8}
        />
      );
    case "low":
      return (
        <ChevronDown
          size={size}
          color={c.infoFg}
          strokeWidth={2}
          opacity={0.85}
        />
      );
    default:
      return <Minus size={size} color={c.muted} strokeWidth={2} />;
  }
}
