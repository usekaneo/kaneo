import { once } from "node:events";
import { createServer, type Socket } from "node:net";

// A loopback-only SMTP sink: never forwards mail or connects to a real provider.
export async function createPlaintextRelay() {
  const commands: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test relay\r\n");
    let pending = "";
    let inData = false;
    socket.on("data", (chunk) => {
      pending += chunk.toString();
      let end = pending.indexOf("\r\n");
      while (end >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 accepted\r\n");
          }
        } else {
          commands.push(line);
          if (line.startsWith("EHLO")) {
            socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
          } else if (line === "STARTTLS") {
            socket.write("502 TLS unavailable\r\n");
          } else if (line.startsWith("AUTH")) {
            socket.write("235 authenticated\r\n");
          } else if (line === "DATA") {
            inData = true;
            socket.write("354 start mail\r\n");
          } else if (line === "QUIT") {
            socket.end("221 bye\r\n");
          } else {
            socket.write("250 OK\r\n");
          }
        }
        end = pending.indexOf("\r\n");
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No relay port");
  return {
    commands,
    port: address.port,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
