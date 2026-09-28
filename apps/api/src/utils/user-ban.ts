import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { schema } from "../database";

export type BanState = {
  banned?: boolean | null;
  banExpires?: Date | string | null;
};

export function isBanActive(user: BanState | null | undefined) {
  if (!user?.banned) {
    return false;
  }
  if (!user.banExpires) {
    return true;
  }
  return new Date(user.banExpires).getTime() >= Date.now();
}

export function notBannedCondition() {
  return or(
    isNull(schema.userTable.banned),
    eq(schema.userTable.banned, false),
    and(
      isNotNull(schema.userTable.banExpires),
      lt(schema.userTable.banExpires, new Date()),
    ),
  );
}
