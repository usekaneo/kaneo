import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const LEDGER = path.join(
  homedir(),
  ".local/state/peekareq/code-review-budget.json",
);

import { LIMIT } from "./limits.mjs";

export { LIMIT, PRICES, reservation } from "./limits.mjs";

export class Budget {
  constructor(file = LEDGER) {
    this.file = file;
  }

  async transaction(fn) {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const lock = `${this.file}.lock`;
    let locked = false;
    for (let attempt = 0; attempt < 30 && !locked; attempt++) {
      try {
        await mkdir(lock);
        locked = true;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        await delay(20);
      }
    }
    if (!locked) throw new Error("Budget ledger is locked; no request sent.");
    try {
      let state;
      try {
        state = JSON.parse(await readFile(this.file, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        state = { version: 1, limit: LIMIT, entries: [] };
      }
      if (
        state.version !== 1 ||
        state.limit !== LIMIT ||
        !Array.isArray(state.entries) ||
        state.entries.some((e) => !Number.isFinite(e.charged) || e.charged < 0)
      )
        throw new Error("Invalid budget ledger; refusing paid calls.");
      const result = await fn(state);
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
      await rename(temp, this.file);
      return result;
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }

  async reserve(amount, label) {
    return this.transaction((state) => {
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        state.halted ||
        state.entries.reduce((n, e) => n + e.charged, 0) + amount > LIMIT
      )
        throw new Error("Budget exhausted or halted; no request sent.");
      const entry = {
        id: randomUUID(),
        at: new Date().toISOString(),
        label,
        reserved: amount,
        charged: amount,
        status: "reserved",
      };
      state.entries.push(entry);
      return entry.id;
    });
  }

  async settle(id, usage, model) {
    return this.transaction((state) => {
      const e = state.entries.find((entry) => entry.id === id);
      if (e?.status !== "reserved")
        throw new Error("Unknown or settled budget reservation.");
      e.model = model;
      if (Number.isFinite(usage?.cost) && usage.cost >= 0) {
        e.reported = usage.cost;
        e.charged = usage.cost * 1.15;
        e.status = "reported";
        if (e.charged > e.reserved) state.halted = true;
      } else e.status = "unknown-cost";
      return e;
    });
  }

  async status() {
    return this.transaction((state) => ({
      limit: LIMIT,
      committed: state.entries.reduce((n, e) => n + e.charged, 0),
      reported: state.entries.reduce((n, e) => n + (e.reported || 0), 0),
      unknown: state.entries.filter((e) => e.status !== "reported").length,
      calls: state.entries.length,
      halted: state.halted === true,
    }));
  }
}
