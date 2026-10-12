import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const stagingEnvPath = path.resolve(projectRoot, ".env.staging.local");

if (!fs.existsSync(stagingEnvPath)) {
  console.error(`[Error] .env.staging.local file not found at ${stagingEnvPath}`);
  process.exit(1);
}

// Parse .env.staging.local lines into an environment dictionary
const envContent = fs.readFileSync(stagingEnvPath, "utf-8");
const stagingEnv = { ...process.env };

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    stagingEnv[key] = val;
  }
}

// Ensure PORT is set to 3001 if not explicitly passed
const userArgs = process.argv.slice(2);
const hasPortArg = userArgs.includes("-p") || userArgs.includes("--port");
const nextArgs = ["dev", ...(hasPortArg ? [] : ["-p", "3001"]), ...userArgs];

console.log("[dev:staging] Loading .env.staging.local");
console.log(`[dev:staging] Target Supabase: ${stagingEnv.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET"}`);
console.log(`[dev:staging] Starting Next.js development server on port 3001...`);

// Spawn local Next.js CLI binary
const nextBin = path.resolve(projectRoot, "node_modules", ".bin", "next");
const child = spawn(nextBin, nextArgs, {
  cwd: projectRoot,
  env: stagingEnv,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
