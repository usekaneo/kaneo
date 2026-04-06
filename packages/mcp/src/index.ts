#!/usr/bin/env node
import { runCli } from "./cli.js";

runCli().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
