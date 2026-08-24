import type { SVGProps } from "react";

// lucide-react dropped its brand icons in v1, so the GitLab mark lives here.
export function GitlabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M23.6004 9.5927l-.0337-.0862L20.3.9814a.851.851 0 00-.3362-.405.8748.8748 0 00-.9997.0539.8748.8748 0 00-.2941.4358l-2.2431 6.8579H7.5375L5.2932.9919a.8748.8748 0 00-.2941-.4358.8748.8748 0 00-.9997-.0539.8511.8511 0 00-.3362.405L.4332 9.5065l-.0325.0862a6.0657 6.0657 0 002.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8631 1.4995 1.1321a1.0021 1.0021 0 001.2151 0l1.4995-1.1321 2.462-1.8631 5.006-3.7489.0125-.01a6.0682 6.0682 0 002.0086-7.003z" />
    </svg>
  );
}
