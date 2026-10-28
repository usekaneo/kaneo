export function DrawnCheck() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/16 transition-[scale] duration-300 ease-out starting:scale-50 motion-reduce:starting:scale-100">
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M5 12.5 10 17.5 19 7"
          pathLength={1}
          className="transition-[stroke-dashoffset] delay-150 duration-500 ease-out [stroke-dasharray:1] [stroke-dashoffset:0] starting:[stroke-dashoffset:1] motion-reduce:starting:[stroke-dashoffset:0]"
        />
      </svg>
    </span>
  );
}
