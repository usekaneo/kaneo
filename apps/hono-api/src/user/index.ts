import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { z } from "zod";
import signIn from "./controllers/sign-in";
import signUp from "./controllers/sign-up";

export const user = new Hono().use(
  jwt({
    secret: process.env.JWT_ACCESS ?? "",
  }),
);

export const route = user
  .post(
    "/sign-in",
    zValidator("json", z.object({ email: z.string(), password: z.string() })),
    async (c) => {
      const { email, password } = c.req.valid("json");

      const user = await signIn(email, password);

      return c.json(user);
    },
  )
  .post(
    "/sign-up",
    zValidator(
      "json",
      z.object({ email: z.string(), password: z.string(), name: z.string() }),
    ),
    async (c) => {
      const { email, password, name } = c.req.valid("json");

      const user = await signUp(email, password, name);

      return c.json(user);
    },
  )
  .post("/sign-out", async (c) => {
    return c.json({ message: "Hello, World!" });
  });
