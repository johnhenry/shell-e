import { Server } from "../lib/server/index.mjs";
import { PORT } from "./settings.mjs";
const server = new Server({ verbose: true });
server.listen(PORT);
