export type CommunityProject = {
  name: string;
  kind: "email" | "installer";
  category: string;
  repo: string;
  href: string;
  description: string;
  license: string;
};

export const communityProjects: CommunityProject[] = [
  {
    name: "kaneo-mailer",
    kind: "email",
    category: "Email to tasks",
    repo: "GEWIS/kaneo-mailer",
    href: "https://github.com/GEWIS/kaneo-mailer",
    description:
      "Turns email into Kaneo tasks. It polls an IMAP folder, creates a task for each message, and reads the project and column from custom headers, so forms and scripts can file work straight onto a board.",
    license: "GPL-3.0",
  },
  {
    name: "Proxmox VE Helper-Scripts",
    kind: "installer",
    category: "Installer",
    repo: "community-scripts/ProxmoxVE",
    href: "https://github.com/community-scripts/ProxmoxVE/blob/main/ct/kaneo.sh",
    description:
      "Sets up Kaneo in its own Proxmox VE container with one command, using the community-maintained Proxmox VE Helper-Scripts. The same script updates it later.",
    license: "MIT",
  },
];
