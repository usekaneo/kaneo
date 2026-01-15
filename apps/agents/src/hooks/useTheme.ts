import { useEffect } from "react";

const useTheme = (theme?: "dark" | "light") => {
  useEffect(() => {
    const html = document.querySelector("html");

    if (theme === "dark") {
      html?.classList.add("dark");
    } else if (theme === "light" && html?.classList.contains("dark"))
      html.classList.remove("dark");
  }, [theme]);
};

export default useTheme;
