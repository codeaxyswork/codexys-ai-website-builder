import fs from "fs";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  const envContent = fs.readFileSync(file, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchOpenApiSpec() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  const spec = await res.json();
  console.log("OpenAPI Title:", spec.info?.title);
  console.log("RPC Endpoints:", Object.keys(spec.paths || {}).filter((p) => p.startsWith("/rpc/")));
}

fetchOpenApiSpec();
