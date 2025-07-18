import { spawn } from "node:child_process";
import { join } from "node:path";

console.log("🚀 Starting Electro Viewer development servers...");

// Start the backend server
const backend = spawn("npx", ["tsx", "server/index.ts"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

// Start the frontend server
const frontend = spawn("npm", ["run", "vite"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down servers...");
  backend.kill();
  frontend.kill();
  process.exit(0);
});

// Handle process errors
backend.on("error", (err) => {
  console.error("Backend error:", err);
});

frontend.on("error", (err) => {
  console.error("Frontend error:", err);
});
