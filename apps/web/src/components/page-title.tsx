import { useEffect } from "react";

type PageTitleProps = {
  title: string;
  suffix?: string;
  hideAppName?: boolean;
};

export default function PageTitle({
  title,
  suffix = "Kaneo",
  hideAppName = false,
}: PageTitleProps) {
  useEffect(() => {
    document.title = [title, hideAppName ? null : suffix]
      .filter(Boolean)
      .join(" · ");
  }, [title, suffix, hideAppName]);

  return null;
}
