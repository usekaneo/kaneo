import { main } from "./main";

function flush(stream: NodeJS.WriteStream): Promise<void> {
  return new Promise((resolve) => {
    stream.write("", () => resolve());
  });
}

const code = await main(process.argv.slice(2));
await Promise.all([flush(process.stdout), flush(process.stderr)]);
process.exit(code);
