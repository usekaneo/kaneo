import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { getClickCoordinates } from "@/lib/get-click-coordinates";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function ThemeToggle() {
  const { theme, setTheme } = useUserPreferencesStore();

  const toggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const newTheme = theme === "dark" ? "light" : "dark";
    const coordinates = getClickCoordinates(event);
    setTheme(newTheme, coordinates);
  };

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}
