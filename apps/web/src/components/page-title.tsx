import { useEffect } from "react";
import { setDocumentBaseTitle } from "@/lib/document-title";

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
    setDocumentBaseTitle(formattedTitle);
  }, [title, suffix, hideAppName]);

  return null;
}
