#!/usr/bin/env node --no-warnings
import PACKAGE from "../package.json" with { type: "json" };
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
const NAME = PACKAGE.name;
const VERSION = PACKAGE.version;
import { Server } from "../lib/server/index.mjs";
yargs(hideBin(process.argv))
  .version(VERSION)
  .scriptName(NAME)
  .usage("$0 <cmd> [args]")
  .command(
    "serve [cwd]",
    `start ${NAME} server`,
    (yargs) => {
      // most of the options are from child_process.exec options (see https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback)
      yargs.option("verbose", {
          alias: "v",
          describe: "verbose mode",
          default: false,
          type: "boolean",
        })
        .option("host", {
          describe: "Interface to bind. Default is loopback; anything else prints a warning.",
          default: "127.0.0.1",
          type: "string",
        })
        .option("token", {
          describe: "Auth token required on every request. Default: env SHELL_E_TOKEN, else a random per-run token printed at startup.",
          type: "string",
        })
        .option("allow-origin", {
          describe: "Browser Origin allowed to connect (repeatable), e.g. chrome-extension://<id>. Default: none.",
          type: "array",
          string: true,
          default: [],
        })
        .option("port", {
          alias: "p",
          describe: "server port",
          default: 8085,
          type: "number",
        })
        .option("cwd", {
          describe: "Current working directory of the child process. Default: process.cwd()",
          type: "string",
        })
        .option("env", {
          alias: "e",
          describe: "Environment key-value pairs. Default: process.env",
          type: "array",
        })
        .option("encoding", {
          describe: "Default: 'utf8'",
          type: "string",
        })
        .option("shell", {
          describe: "Shell to execute the command with. See Shell requirements and Default Windows shell. Default: '/bin/sh' on Unix, process.env.ComSpec on Windows.",
          type: "string",
        })
        .option("timeout", {
          describe: "Default: 0",
          type: "number",
        })
        .option("maxBuffer", {
          describe: "Largest amount of data in bytes allowed on stdout or stderr. If exceeded, the child process is terminated and any output is truncated. See caveat at maxBuffer and Unicode. Default: 1024 * 1024.",
          type: "string",
        })
        .option("killSignal", {
          describe: "Default: 'SIGTERM",
          type: "string",
        })
        .option("uid", {
          describe: "Sets the user identity of the process (see setuid(2)).",
          type: "number",
        })
        .option("gid", {
          describe: "Sets the group identity of the process (see setgid(2)).",
          type: "number",
        })
        .option("windowsHide", {
          describe: "Hide the subprocess console window that would normally be created on Windows systems. Default: false.",
          type: "boolean",
        })
    },(argv)=>{
      const { verbose, port, host, token } = argv;
      const allowedOrigins = argv.allowOrigin || [];
      if(argv.env){
        argv.env = argv.env.reduce((acc, item) => {
          const i = String(item).indexOf("=");
          acc[String(item).slice(0, i)] = String(item).slice(i + 1);
          return acc;
        }, {});
      }
      const cwd = argv.cwd || argv._[1];
      const EXEC_KEYS = ["env","encoding","shell","timeout","maxBuffer","killSignal","uid","gid","windowsHide"];
      const execOptions = Object.fromEntries(
        EXEC_KEYS.filter((k) => argv[k] !== undefined).map((k) => [k, argv[k]])
      );
      if (cwd) execOptions.cwd = cwd;
      const server = new Server({ verbose, port, host, token, allowedOrigins }, execOptions);
      server.listen();
    })
  .demandCommand(1, `try: ${NAME} serve`)
  .alias("h", "help")
  .help().argv;
