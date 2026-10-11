export type ImportUnit = "team" | "board" | "project";

export type ImportUnitCopy = {
  step: string;
  section: string;
  pick: string;
  found: string;
  empty: string;
  limit: string;
  importButton: string;
  progress: string;
  runTitle: string;
  allImported: string;
  someImported: string;
};

export const IMPORT_UNIT_COPY: Record<ImportUnit, ImportUnitCopy> = {
  team: {
    step: "settings:workspaceImport.units.team.step",
    section: "settings:workspaceImport.units.team.section",
    pick: "settings:workspaceImport.units.team.pick",
    found: "settings:workspaceImport.units.team.found",
    empty: "settings:workspaceImport.units.team.empty",
    limit: "settings:workspaceImport.units.team.limit",
    importButton: "settings:workspaceImport.units.team.importButton",
    progress: "settings:workspaceImport.units.team.progress",
    runTitle: "settings:workspaceImport.units.team.runTitle",
    allImported: "settings:workspaceImport.units.team.allImported",
    someImported: "settings:workspaceImport.units.team.someImported",
  },
  board: {
    step: "settings:workspaceImport.units.board.step",
    section: "settings:workspaceImport.units.board.section",
    pick: "settings:workspaceImport.units.board.pick",
    found: "settings:workspaceImport.units.board.found",
    empty: "settings:workspaceImport.units.board.empty",
    limit: "settings:workspaceImport.units.board.limit",
    importButton: "settings:workspaceImport.units.board.importButton",
    progress: "settings:workspaceImport.units.board.progress",
    runTitle: "settings:workspaceImport.units.board.runTitle",
    allImported: "settings:workspaceImport.units.board.allImported",
    someImported: "settings:workspaceImport.units.board.someImported",
  },
  project: {
    step: "settings:workspaceImport.units.project.step",
    section: "settings:workspaceImport.units.project.section",
    pick: "settings:workspaceImport.units.project.pick",
    found: "settings:workspaceImport.units.project.found",
    empty: "settings:workspaceImport.units.project.empty",
    limit: "settings:workspaceImport.units.project.limit",
    importButton: "settings:workspaceImport.units.project.importButton",
    progress: "settings:workspaceImport.units.project.progress",
    runTitle: "settings:workspaceImport.units.project.runTitle",
    allImported: "settings:workspaceImport.units.project.allImported",
    someImported: "settings:workspaceImport.units.project.someImported",
  },
};
