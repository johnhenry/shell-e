import { Client } from "../lib/client/index.mjs";
import { PORT } from "./settings.mjs";
const ADDRESS = `http://localhost:${PORT}`;
const client = await new Client(ADDRESS);
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
