import { useTranslation } from "react-i18next";
import type { GithubRepository } from "@/fetchers/github-integration/list-repositories";
import { useLocale } from "@/hooks/use-locale";
import { formatRelativeTime } from "@/lib/format";

type GithubRepositoryMetaProps = {
  repository: GithubRepository;
};

export function GithubRepositoryMeta({
  repository,
}: GithubRepositoryMetaProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const updated = repository.updated_at
    ? t("settings:repositoryBrowser.updated", {
        time: formatRelativeTime(repository.updated_at, locale),
      })
    : null;

  return <>{[repository.description, updated].filter(Boolean).join(" · ")}</>;
}
