import {
  Book,
  GitBranch,
  Github,
  Link,
  Palette,
  Search,
  TicketX,
} from "lucide-react";
import type { ExternalLinkType } from "../../types/external-links";

interface ExternalLinkIconProps {
  type: ExternalLinkType;
  className?: string;
}

export function ExternalLinkIcon({ type, className }: ExternalLinkIconProps) {
  const iconMap = {
    gitea_integration: GitBranch,
    github_integration: Github,
    documentation: Book,
    reference: Search,
    design: Palette,
    ticket: TicketX,
    custom: Link,
  };

  const IconComponent = iconMap[type] || Link;

  return <IconComponent className={className} />;
}

export function getExternalLinkTypeLabel(type: ExternalLinkType): string {
  const labelMap = {
    gitea_integration: "Gitea Integration",
    github_integration: "GitHub Integration",
    documentation: "Documentation",
    reference: "Reference",
    design: "Design",
    ticket: "Ticket",
    custom: "Custom Link",
  };

  return labelMap[type] || "Unknown";
}

export function getExternalLinkTypeColor(type: ExternalLinkType): string {
  const colorMap = {
    gitea_integration: "text-orange-600 bg-orange-50",
    github_integration: "text-gray-800 bg-gray-100",
    documentation: "text-blue-600 bg-blue-50",
    reference: "text-green-600 bg-green-50",
    design: "text-purple-600 bg-purple-50",
    ticket: "text-red-600 bg-red-50",
    custom: "text-indigo-600 bg-indigo-50",
  };

  return colorMap[type] || "text-gray-600 bg-gray-50";
}
