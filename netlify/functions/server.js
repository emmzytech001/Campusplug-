import serverless from "serverless-http";
import { app } from "../../src/server.js";
import { migrate } from "../../src/db.js";

await migrate();

export const handler = serverless(app);
