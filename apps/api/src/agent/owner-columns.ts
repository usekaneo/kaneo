import { schema } from "../database";

// The public profile shown for a conversation's owner; never email or roles.
export const ownerColumns = {
  id: schema.userTable.id,
  name: schema.userTable.name,
  image: schema.userTable.image,
};
