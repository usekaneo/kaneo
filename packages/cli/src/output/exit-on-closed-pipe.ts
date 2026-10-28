type Writable = {
  on(event: "error", listener: (error: NodeJS.ErrnoException) => void): unknown;
};

export function exitOnClosedPipe(
  streams: ReadonlyArray<Writable>,
  exit: (code: number) => void = (code) => process.exit(code),
): void {
  for (const stream of streams) {
    stream.on("error", (error) => {
      if (error.code === "EPIPE") exit(0);
      else throw error;
    });
  }
}
