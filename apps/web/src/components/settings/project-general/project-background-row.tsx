import { Trash2 } from "lucide-react";
import { type ChangeEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/fetchers/get-api-url";
import useRemoveProjectBackground from "@/hooks/mutations/project/use-remove-project-background";
import useUploadProjectBackground from "@/hooks/mutations/project/use-upload-project-background";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import type { ProjectWithTasks } from "@/types/project";

const ACCEPTED_BACKGROUND_TYPES =
  "image/apng,image/avif,image/gif,image/heic,image/heif,image/jpeg,image/jpg,image/png,image/webp";

type ProjectBackgroundRowProps = {
  project: ProjectWithTasks | undefined;
  canEdit: boolean;
};

export function ProjectBackgroundRow({
  project,
  canEdit,
}: ProjectBackgroundRowProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadBackground, isPending: isUploading } =
    useUploadProjectBackground();
  const { mutate: removeBackground, isPending: isRemoving } =
    useRemoveProjectBackground();
  const { data: config } = useGetConfig();
  const uploadsUnavailable = config?.hasImageUploads === false;
  const isBusy = isUploading || isRemoving;
  const backgroundVersion = project?.backgroundVersion;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !project?.id) return;

    uploadBackground({ projectId: project.id, file });
  };

  return (
    <SettingsRow
      stack
      title={t("settings:projectGeneral.backgroundLabel")}
      description={
        uploadsUnavailable
          ? t("settings:projectGeneral.backgroundUnavailable")
          : t("settings:projectGeneral.backgroundHint")
      }
    >
      {project && backgroundVersion ? (
        <img
          src={getApiUrl(
            `project/${project.id}/background?v=${encodeURIComponent(backgroundVersion)}`,
          )}
          alt=""
          className="h-8 w-14 rounded-md border border-border object-cover"
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_BACKGROUND_TYPES}
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-24"
        disabled={!canEdit || isBusy || uploadsUnavailable}
        onClick={() => inputRef.current?.click()}
      >
        {backgroundVersion
          ? t("settings:projectGeneral.backgroundReplace")
          : t("settings:projectGeneral.backgroundUpload")}
      </Button>
      {project && backgroundVersion ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          disabled={!canEdit || isBusy}
          onClick={() => removeBackground(project.id)}
          aria-label={t("settings:projectGeneral.backgroundRemove")}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
    </SettingsRow>
  );
}
