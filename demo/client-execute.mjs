import { Client } from "../lib/client/index.mjs";
import { PORT } from "./settings.mjs";
const ADDRESS = `http://localhost:${PORT}`;
// Token is printed by `shell-e serve` / demo/server.mjs; pass it via env.
const client = new Client(ADDRESS, { token: process.env.SHELL_E_TOKEN });
const remote = await client.exec(`bash`);
setTimeout(async () => {
  for await (const output of remote.stdout) {
    console.log(output);
  }
}, 1000);
setTimeout(async () => {
  for await (const output of remote.stderr) {
    console.error(output);
  }
});
remote.stdin("ls -la\n");
remote.stdin("pwd\n");
remote.stdin("echo $USER\n");
