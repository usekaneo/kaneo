import db from "../../database";

async function getLabelsByTaskId(taskId: string) {
  const labels = await db.query.labelTable.findMany({
    where: (label, { eq }) => eq(label.taskId, taskId),
  });

  return labels;
}

export default getLabelsByTaskId;
