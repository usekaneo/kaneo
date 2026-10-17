type UsageAvatarsProps = { initial: string; team: boolean };

export function UsageAvatars({ initial, team }: UsageAvatarsProps) {
  const avatar =
    "-ms-2 flex size-6 items-center justify-center rounded-full border-2 border-background first:ms-0";

  return (
    <span aria-hidden="true" className="flex w-13 shrink-0">
      <span
        className={`${avatar} bg-foreground font-semibold text-[10px] text-background`}
      >
        {initial}
      </span>
      {team ? (
        <>
          <span className={`${avatar} bg-muted-foreground/60`} />
          <span className={`${avatar} bg-muted-foreground/30`} />
        </>
      ) : null}
    </span>
  );
}
