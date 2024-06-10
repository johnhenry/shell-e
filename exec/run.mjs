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
      const {verbose, port} = argv;
      if(argv.env){
        argv.env = argv.env.reduce((acc, item) => {
        const [key, value] = item.split("=");
        acc[key] = value;
        return acc;
        }, {});
      }
      argv.cwd = argv.cwd || argv._[1];
      delete argv.verbose;
      delete argv.v;
      delete argv.port;
      delete argv.p;
      const server = new Server({ verbose, port }, argv);
      server.listen();
    })
  .demandCommand(1, `try: ${NAME} serve`)
  .alias("h", "help")
  .help().argv;
