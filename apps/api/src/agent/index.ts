import { apiRouter } from "../openapi";
import conversations from "./routes/conversations";
import runs from "./routes/runs";
import proposals from "./routes/proposals";

const agent = apiRouter()
  .route("/", conversations)
  .route("/", runs)
  .route("/", proposals);
export default agent;
