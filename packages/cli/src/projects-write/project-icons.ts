import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const DEFAULT_PROJECT_ICON = "Layout";

export const PROJECT_ICONS = [
  "Layout",
  "Briefcase",
  "FolderKanban",
  "Target",
  "Rocket",
  "Code",
  "Box",
  "Boxes",
  "BookOpen",
  "Bookmark",
  "Building2",
  "Calendar",
  "CircuitBoard",
  "Cog",
  "Database",
  "FileText",
  "Flag",
  "FlaskConical",
  "Folder",
  "GitBranch",
  "Globe",
  "Heart",
  "Home",
  "Image",
  "Layers",
  "Lightbulb",
  "Link2",
  "List",
  "MessageSquare",
  "Music",
  "Package",
  "Palette",
  "PenTool",
  "Phone",
  "PieChart",
  "Puzzle",
  "Radio",
  "ScrollText",
  "Search",
  "Settings",
  "Share2",
  "Shield",
  "ShoppingBag",
  "Smile",
  "Star",
  "Table",
  "Tags",
  "Terminal",
  "ThumbsUp",
  "Timer",
  "Tool",
  "Trash2",
  "Trophy",
  "Tv2",
  "User",
  "Users",
  "Video",
  "Wallet",
  "Wand2",
  "Watch",
  "Zap",
] as const;

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchProjectIcon(
  input: string,
): Result.Result<string, InvalidArgument> {
  const wanted = compact(input);
  const match = PROJECT_ICONS.find((icon) => compact(icon) === wanted);
  return match
    ? Result.succeed(match)
    : Result.fail(
        new InvalidArgument({
          message: `"${input}" is not a project icon.`,
          hint: `Use one of the Lucide names the web app offers, for example ${PROJECT_ICONS.slice(0, 6).join(", ")}.`,
        }),
      );
}
