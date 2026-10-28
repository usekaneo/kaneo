import { apiRouter } from "../openapi";
import conversations from "./routes/conversations";
import runs from "./routes/runs";
import proposals from "./routes/proposals";
import automations from "./routes/automations";
import attachments from "./routes/attachments";

const agent = apiRouter()
  .route("/", conversations)
  .route("/", runs)
  .route("/", proposals)
  .route("/", attachments)
  .route("/", automations);
export default agent;
