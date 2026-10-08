import { defineConfig } from "@kaneo/config";
import taskProgress from "kaneo-plugin-task-progress";

export default defineConfig({
  plugins: [taskProgress({ autoComplete: true })],
});
