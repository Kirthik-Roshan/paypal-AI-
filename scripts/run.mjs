import { spawn } from "node:child_process";
const dev = process.argv.includes("--dev");
const children = [
  spawn(
    process.execPath,
    [
      "--env-file-if-exists=.env.local",
      "node_modules/tsx/dist/cli.mjs",
      ...(dev ? ["watch"] : []),
      "scripts/worker.ts",
    ],
    { stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      dev ? "dev" : "start",
      "--hostname",
      "0.0.0.0",
    ],
    { stdio: "inherit" },
  ),
];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  children.forEach((c) => c.kill("SIGTERM"));
  process.exitCode = code;
}
process.on("SIGTERM", () => close());
process.on("SIGINT", () => close());
children.forEach((c) => c.on("exit", (code) => close(code || 0)));
