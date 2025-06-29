import { Hono } from "hono";
import getSettings from "../utils/get-settings";

const config = new Hono().get("/", async (c) => {
  const settings = getSettings();

  return c.json(settings);
});

export default config;
