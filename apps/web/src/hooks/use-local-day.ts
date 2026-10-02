import { startOfDay } from "date-fns";
import { useEffect, useState } from "react";

export function useLocalDay() {
  const [day, setDay] = useState(() => startOfDay(new Date()).getTime());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setDay(startOfDay(now).getTime());
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(update, midnight.getTime() - now.getTime());
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return day;
}
