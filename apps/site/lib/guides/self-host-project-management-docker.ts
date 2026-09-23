import type { Guide } from "./types";

export const selfHostProjectManagementDocker: Guide = {
  slug: "self-host-project-management-docker",
  question: "How do I self-host a project management tool with Docker?",
  title: "How to self-host a project management tool with Docker",
  description:
    "A practical guide to self-hosting a project manager with Docker Compose: what you need, how to run Kaneo, and what to get right on backups, TLS, and updates.",
  summary:
    "What self-hosting actually involves, and a working Docker Compose setup you can copy.",
  answer:
    "You need a small Linux server, Docker with the Compose plugin, a domain pointed at it, and a reverse proxy for TLS. For Kaneo, that means a compose file with two services, the Kaneo container and PostgreSQL, an environment file, and a proxy such as Caddy or Traefik in front. Budget an hour for the first install and a recurring ten minutes a month for updates and backup checks.",
  sections: [
    {
      heading: "What you need",
      body: [
        "A server with 2 vCPU and 2GB of RAM is enough for a small team, and 1GB will do for a handful of people. Any current Debian or Ubuntu LTS is fine.",
        "Docker Engine with the Compose plugin, a DNS record pointing at the server, and ports 80 and 443 open. Everything else runs inside the compose network.",
        "A backup destination that is not the same machine. Object storage, another VPS, or a home NAS over a tunnel. A backup on the server you are backing up is a rehearsal, not a backup.",
      ],
    },
    {
      heading: "The compose file",
      body: [
        "Kaneo runs as one application container alongside PostgreSQL. The container serves both the API and the web app on port 5173, so the reverse proxy has a single upstream.",
        "Create a compose.yml with a postgres service using the postgres:16-alpine image and a named volume, and a kaneo service using ghcr.io/usekaneo/kaneo:latest that depends on Postgres being healthy. Put your secrets in a .env file next to it and load it with env_file. The full file, with health checks and every environment variable explained, is in the installation guide.",
        "If you would rather not write it yourself, the drim CLI sets up Kaneo, PostgreSQL, and HTTPS in one step: run drim setup on a fresh server and answer the prompts.",
      ],
      items: [
        {
          name: "Installation guide",
          href: "/docs/core/installation",
          body: "The complete compose file, environment variables, and first-run steps.",
        },
        {
          name: "Environment variables",
          href: "/docs/core/installation/environment-variables",
          body: "Every setting, including database URL, base URLs, and OIDC configuration.",
        },
        {
          name: "Object storage",
          href: "/docs/core/installation/object-storage-and-image-uploads",
          body: "S3-compatible storage for attachments and avatars, including MinIO on your own hardware.",
        },
      ],
    },
    {
      heading: "The four things people get wrong",
      body: [
        "TLS as an afterthought. Put Caddy, Traefik, or nginx in front from the first day, not after someone has typed a password over plain HTTP. Caddy needs about four lines for automatic certificates.",
        "No backups of the database volume. A weekly pg_dump to object storage, and one restore test, is the entire discipline. Test the restore, or you have a backup of unknown quality.",
        "Pinning to latest and never updating, or updating blind. Pin a version tag, read the release notes, and take a database dump before upgrading. Kaneo's migrations run automatically on start and are written to work on existing installations, but a dump costs nothing.",
        "Skipping single sign-on because it looks like work. Connecting Google, GitHub, Discord, or your own OIDC provider takes minutes in Kaneo and is free on every build, and it removes an entire class of password problems.",
      ],
    },
    {
      heading: "Is self-hosting worth it?",
      body: [
        "It is worth it when data control genuinely matters to you, when per-user pricing has stopped making sense, or when you simply prefer owning the thing your team depends on. A small VPS costs a few dollars a month and will comfortably run a tracker for a team of twenty.",
        "It is not worth it if nobody wants to own updates and backups. That is a real job, small but recurring. If no one wants it, a managed cloud is the honest answer, and Kaneo Cloud is $4 a month for one person or $5 per user a month for a team, running the same MIT-licensed software you could host yourself.",
      ],
    },
  ],
  faq: [
    {
      question: "What are the minimum requirements to self-host Kaneo?",
      answer:
        "A Linux server with Docker and the Compose plugin, roughly 1 to 2GB of RAM, and PostgreSQL, which the compose file provides. Redis is optional and only needed to coordinate realtime updates across multiple API instances.",
    },
    {
      question: "Can I run it on a Raspberry Pi or a home server?",
      answer:
        "Yes, for a small team. The requirements are modest. Put it behind a tunnel or a reverse proxy with TLS rather than exposing ports directly, and keep backups somewhere other than the same SD card.",
    },
    {
      question: "Does Kaneo run on Kubernetes?",
      answer:
        "Yes. There is an official Helm chart in the repository under charts/kaneo, which covers the API, web app, database configuration, and ingress.",
    },
    {
      question: "How do updates work?",
      answer:
        "Pull the new image tag and restart the stack. Database migrations run on startup and are written to work against existing installations. Take a database dump first, as with anything.",
    },
  ],
  related: [
    { label: "Installation guide", href: "/docs/core/installation" },
    {
      label: "Best open-source project management software",
      href: "/guides/best-open-source-project-management-software",
    },
    { label: "Pricing", href: "/pricing" },
  ],
  updatedOn: "2026-08-19",
};
