import { useEffect } from "react";

type PageTitleProps = {
  title: string;
  suffix?: string;
  hideAppName?: boolean;
};

export default function PageTitle({
  title,
  suffix = "IPSTUDIO",
  hideAppName = false,
}: PageTitleProps) {
  useEffect(() => {
    const formattedTitle = hideAppName
      ? title
      : suffix
        ? `${title} — ${suffix}`
        : title;
    document.title = formattedTitle;
  }, [title, suffix, hideAppName]);

  return null;
}
