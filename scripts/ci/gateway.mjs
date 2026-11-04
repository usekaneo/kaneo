import { createServer, connect } from "node:net";
import { pathToFileURL } from "node:url";

export function startGateway(port, host, targetPort) {
  const server = createServer((client) => {
    const upstream = connect(targetPort, host);
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => {
      if (!client.readableEnded) upstream.destroy();
    });
    upstream.on("close", () => {
      if (!upstream.readableEnded) client.destroy();
    });
    client.pipe(upstream).pipe(client);
  });
  return server.listen(port, "0.0.0.0");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const [port, host, targetPort] of [
    [15173, "app", 5173],
    [15174, "second", 5173],
    [15175, "upgrade", 5173],
    [19040, "minio", 9000],
  ]) {
    startGateway(port, host, targetPort);
  }
}
