import { HTTPException } from "hono/http-exception";
import db from "../../database";

async function getLabel(id: string) {
  const label = await db.query.labelTable.findFirst({
    where: (label, { eq }) => eq(label.id, id),
  });

  if (!label) {
    throw new HTTPException(404, {
      message: "Label not found",
    });
  }

  return label;
}

export default getLabel;
