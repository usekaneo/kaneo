import assert from "node:assert/strict";
import { createServer, connect } from "node:net";
import { test } from "node:test";
import { startGateway } from "./gateway.mjs";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

test("gateway releases upstream when client closes without ending", async () => {
  const target = createServer({ allowHalfOpen: true });
  await listen(target);
  const gateway = startGateway(0, "127.0.0.1", target.address().port);
  await new Promise((resolve) => gateway.once("listening", resolve));
  const accepted = new Promise((resolve) =>
    gateway.once("connection", resolve),
  );
  const upstream = new Promise((resolve) => target.once("connection", resolve));
  const client = connect(gateway.address().port, "127.0.0.1");
  const [gatewayClient, targetSocket] = await Promise.all([accepted, upstream]);
  try {
    const closed = new Promise((resolve) => targetSocket.once("end", resolve));
    targetSocket.resume();
    gatewayClient.destroy();
    await Promise.race([
      closed,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Upstream connection stayed open")),
          500,
        ),
      ),
    ]);
  } finally {
    client.destroy();
    targetSocket.destroy();
    await Promise.all([
      new Promise((resolve) => gateway.close(resolve)),
      new Promise((resolve) => target.close(resolve)),
    ]);
  }
});

test("gateway forwards traffic to the configured service", async () => {
  const target = createServer((socket) => socket.pipe(socket));
  await listen(target);
  const gateway = startGateway(0, "127.0.0.1", target.address().port);
  await new Promise((resolve) => gateway.once("listening", resolve));
  try {
    const result = await new Promise((resolve, reject) => {
      const socket = connect(gateway.address().port, "127.0.0.1");
      socket.on("error", reject);
      socket.on("connect", () => socket.write("hello"));
      socket.on("data", (data) => {
        socket.destroy();
        resolve(data.toString());
      });
    });
    assert.equal(result, "hello");
  } finally {
    await Promise.all([
      new Promise((resolve) => gateway.close(resolve)),
      new Promise((resolve) => target.close(resolve)),
    ]);
  }
});
