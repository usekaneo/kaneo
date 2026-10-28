import type { SettingsNav } from "@/components/settings/nav/types";

export type SettingsBreadcrumb = {
  section: string;
  page: string;
};

export function normalizeSettingsPath(pathname: string) {
  return pathname.replace(/\/+$/, "");
}

export function getSettingsBreadcrumb(
  nav: SettingsNav,
  pathname: string,
): SettingsBreadcrumb | null {
  const path = normalizeSettingsPath(pathname);

  for (const group of [nav.account, nav.workspace, nav.admin]) {
    const link = group?.links.find((candidate) => candidate.to === path);
    if (group && link) {
      return { section: group.label, page: link.label };
    }
  }

  for (const project of nav.projects) {
    const link = project.links.find((candidate) => candidate.to === path);
    if (link) {
      return { section: project.name, page: link.label };
    }
  }

  return null;
}
