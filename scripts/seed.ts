import { seedWorkspace } from "../src/lib/seed";
await seedWorkspace("sample-cli");
console.log(
  "Isolated CLI sample workspace prepared. The browser creates its own private sample session.",
);
