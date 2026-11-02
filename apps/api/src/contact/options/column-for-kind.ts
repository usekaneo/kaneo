import { contactTable } from "../../database/schema";
import type { ContactOptionKind } from "./defaults";

// The contact column that stores this kind's option key.
export const columnForKind = (kind: ContactOptionKind) =>
  kind === "type" ? contactTable.type : contactTable.region;
