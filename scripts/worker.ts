import { workOnce } from "../src/lib/jobs";
console.log("ProcureProof durable job worker started.");
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
while (!stopped) {
  if (!(await workOnce()))
    await new Promise((resolve) => setTimeout(resolve, 1500));
}
