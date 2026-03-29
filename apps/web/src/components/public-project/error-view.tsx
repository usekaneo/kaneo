import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KaneoBranding } from "./kaneo-branding";

export function ErrorView() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/12">
            <ExternalLink className="h-10 w-10 text-destructive-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">
              {t("publicProject:error.title")}
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t("publicProject:error.description")}
            </p>
          </div>
          <KaneoBranding />
        </div>
      </div>
    </div>
  );
}
