export type CommunityProject = {
  name: string;
  kind: "email" | "installer";
  category: string;
  repo: string;
  href: string;
  description: string;
  license: string;
};

// Fork listings need verified destinations; upstream installers deploy a different product.
export const communityProjects: CommunityProject[] = [];
