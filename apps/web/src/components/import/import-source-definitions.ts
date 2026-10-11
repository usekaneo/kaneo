import type { ComponentType } from "react";
import type { ImportUnit } from "@/components/import/import-unit-copy";
import { KaneoLogo } from "@/components/import/source-logos/kaneo-logo";
import { LinearLogo } from "@/components/import/source-logos/linear-logo";
import { PlaneLogo } from "@/components/import/source-logos/plane-logo";
import { PlankaLogo } from "@/components/import/source-logos/planka-logo";
import type { SourceLogoProps } from "@/components/import/source-logos/source-logo-size";
import { TrelloLogo } from "@/components/import/source-logos/trello-logo";
import type { ImportConnection } from "@/fetchers/import/list-import-source-projects";

export type ImportSourceId = ImportConnection["source"];

export type ImportSourceDefinition = {
  id: ImportSourceId;
  name: string;
  pickerNameKey?: string;
  Logo: ComponentType<SourceLogoProps>;
  descriptionKey: string;
  introKey: string;
  unit: ImportUnit;
};

export const IMPORT_SOURCES: ImportSourceDefinition[] = [
  {
    id: "linear",
    name: "Linear",
    Logo: LinearLogo,
    descriptionKey: "settings:workspaceImport.sources.linear.description",
    introKey: "settings:workspaceImport.sources.linear.intro",
    unit: "team",
  },
  {
    id: "trello",
    name: "Trello",
    Logo: TrelloLogo,
    descriptionKey: "settings:workspaceImport.sources.trello.description",
    introKey: "settings:workspaceImport.sources.trello.intro",
    unit: "board",
  },
  {
    id: "plane",
    name: "Plane",
    Logo: PlaneLogo,
    descriptionKey: "settings:workspaceImport.sources.plane.description",
    introKey: "settings:workspaceImport.sources.plane.intro",
    unit: "project",
  },
  {
    id: "planka",
    name: "PLANKA",
    Logo: PlankaLogo,
    descriptionKey: "settings:workspaceImport.sources.planka.description",
    introKey: "settings:workspaceImport.sources.planka.intro",
    unit: "board",
  },
  {
    id: "kaneo",
    name: "Kaneo",
    pickerNameKey: "settings:workspaceImport.sources.kaneo.pickerName",
    Logo: KaneoLogo,
    descriptionKey: "settings:workspaceImport.sources.kaneo.description",
    introKey: "settings:workspaceImport.sources.kaneo.intro",
    unit: "project",
  },
];

export function isImportSourceId(value: unknown): value is ImportSourceId {
  return IMPORT_SOURCES.some((source) => source.id === value);
}

export function getImportSource(id: ImportSourceId): ImportSourceDefinition {
  const source = IMPORT_SOURCES.find((candidate) => candidate.id === id);
  if (!source) {
    throw new Error(`Unknown import source: ${id}`);
  }
  return source;
}
