import { Client } from "../lib/client/index.mjs";
import { SCREEN } from "../lib/session-commands.mjs";
import { PORT, SESSION_ID } from "./settings.mjs";
const ADDRESS = `http://localhost:${PORT}`;
const client = await new Client(ADDRESS);
const shellCommand = `vim`;
console.log(
  `SESSION_ID=${await client.session(shellCommand, {
    sessionCommand: SCREEN,
    sessionId: SESSION_ID,
  })}`
);
