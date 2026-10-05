import { Building2, Layout, type LucideIcon, Video } from "lucide-react";

// The few entries of apps/web's project-icons the mock projects use.
const icons: Record<string, LucideIcon> = { Building2, Video };

export function getProjectIcon(icon: string | null): LucideIcon {
  return (icon && icons[icon]) || Layout;
}
