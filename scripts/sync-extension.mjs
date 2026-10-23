#!/usr/bin/env node
// Bundle the client library into the extension so it never has to import
// code from the server at runtime. Run after editing lib/client/*.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "lib/client");
const to = path.join(root, "extension/vendor/client");
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from)) cpSync(path.join(from, f), path.join(to, f));
