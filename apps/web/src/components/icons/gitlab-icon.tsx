import type { SVGProps } from "react";

// lucide-react dropped its brand icons in v1, so the GitLab tanuki lives here.
export function GitlabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="m23.6 9.593-.033-.086L20.32 1.13a.85.85 0 0 1 .001-.002.85.85 0 0 0-1.616.086l-2.19 6.7H7.485l-2.19-6.7A.85.85 0 0 0 3.68 1.13L.433 9.507.4 9.593a5.96 5.96 0 0 0 1.977 6.886l.01.01.03.021 4.882 3.657 2.416 1.828 1.47 1.11a1 1 0 0 0 1.21 0l1.47-1.11 2.416-1.828 4.912-3.68.012-.01A5.96 5.96 0 0 0 23.6 9.593" />
    </svg>
  );
}
