import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Client, localOrigin, ready, seed } from "./http.mjs";

const require = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const WebSocket = createRequire(require.resolve("@hono/node-ws"))("ws");
const origins = process.argv.slice(2).map(localOrigin);
assert.ok(
  origins.length === 1 || origins.length === 2,
  "Pass one no-Redis origin or two Redis-backed origins",
);
await Promise.all(origins.map(ready));
const fixture = await seed(origins[0], "realtime");
const sockets = [];
try {
  // Two clients even without Redis; mutation initiator suppression must not hide updates from other windows.
  for (const [index, origin] of (origins.length === 1
    ? [origins[0], origins[0]]
    : origins
  ).entries()) {
    const client = new Client(origin);
    await client.signin(fixture.client.email);
    const socket = new WebSocket(
      `${origin.replace("http:", "ws:")}/api/ws/${fixture.project.id}?windowId=ci-${index}`,
      {
        headers: { Cookie: client.cookie, Origin: origin },
        handshakeTimeout: 10_000,
      },
    );
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
  }
  const received = sockets.map(
    (socket) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Task event did not reach every instance")),
          15_000,
        );
        socket.on("message", (data) => {
          const message = JSON.parse(String(data));
          if (
            message.type === "TASK_UPDATED" &&
            message.taskId === fixture.task.id
          ) {
            clearTimeout(timeout);
            resolve(message);
          }
        });
        socket.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      }),
  );
  // Attach rejection handlers before issuing the mutation.
  const delivery = Promise.all(received);
  await Promise.all([
    delivery,
    fixture.client.json(`/api/task/status/${fixture.task.id}`, "PUT", {
      status: "in-progress",
    }),
  ]);
  assert.equal(
    (await fixture.client.json(`/api/task/${fixture.task.id}`)).status,
    "in-progress",
  );
  console.log(
    `Realtime passed with ${origins.length === 1 ? "no Redis" : "two API instances and Redis"}`,
  );
} finally {
  for (const socket of sockets) socket.terminate();
}
