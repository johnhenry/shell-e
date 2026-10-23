import { Client } from "../lib/client/index.mjs";
import { SCREEN } from "../lib/client/session-commands.mjs";
import { PORT, SESSION_ID } from "./settings.mjs";
const ADDRESS = `http://localhost:${PORT}`;
const client = new Client(ADDRESS, { token: process.env.SHELL_E_TOKEN });
const shellCommand = `vim`;
console.log(
  `SESSION_ID=${await client.session(shellCommand, {
    sessionCommand: SCREEN,
    sessionId: SESSION_ID,
  })}`
);
