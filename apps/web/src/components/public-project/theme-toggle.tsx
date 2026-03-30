import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getClickCoordinates } from "@/lib/get-click-coordinates";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useUserPreferencesStore();

  const toggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const newTheme = theme === "dark" ? "light" : "dark";
    const coordinates = getClickCoordinates(event);
    setTheme(newTheme, coordinates);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="h-8 w-8 p-0"
      aria-label={
        theme === "dark"
          ? t("publicProject:theme.switchToLight")
          : t("publicProject:theme.switchToDark")
      }
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
