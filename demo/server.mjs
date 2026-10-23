import { Server } from "../lib/server/index.mjs";
import { PORT } from "./settings.mjs";
// Binds 127.0.0.1 and prints a random token. Run clients with SHELL_E_TOKEN=<token>.
const server = new Server({ verbose: true });
server.listen(PORT);
