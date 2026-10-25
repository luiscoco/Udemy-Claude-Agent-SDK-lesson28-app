import { runAgent, validateConfig } from "./agent.js";
await runAgent(
  validateConfig({ mode: process.argv[2] || "allow-fallback" }),
  (e) => console.log(JSON.stringify(e)),
);
