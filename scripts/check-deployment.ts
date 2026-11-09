import { assertOAuthRedirectConfig } from "./oauth-redirect";

const target = Bun.argv[2];
if (!target) {
  console.error("Usage: bun scripts/check-deployment.ts https://your-deployment.vercel.app");
  process.exit(2);
}

const origin = new URL(target);
if (origin.protocol !== "https:" || origin.username || origin.password) {
  console.error("Use an HTTPS deployment URL without credentials.");
  process.exit(2);
}

const isProduction = origin.origin === "https://query-ai-search.vercel.app";

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, origin), {
    ...init, redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  const type = response.headers.get("content-type") || "unknown content type";
  const json = type.includes("application/json") ? await response.json().catch(() => null) : null;
  return { status: response.status, type, json };
}

let failed = false;
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

function assertResponse(result: Awaited<ReturnType<typeof request>>, status: number) {
  if (result.status !== status || !result.json || typeof result.json !== "object") {
    throw new Error(`expected ${status} JSON, received ${result.status} ${result.type}`);
  }
}

await Promise.all([
  check("/health", async () => {
    const response = await request("/health");
    assertResponse(response, 200);
    if (response.json.ok !== true) throw new Error("health did not report ok");
    const missing = ["database", "supabaseUrl", "supabaseSecret", "tavily", "googleGenerativeAi"]
      .filter(name => response.json.env?.[name] !== true);
    if (missing.length) throw new Error(`missing server configuration: ${missing.join(", ")}`);
  }),
  check("/conversations rejects anonymous requests", async () => {
    assertResponse(await request("/conversations"), 401);
  }),
  ...["/signin", "/signup", "/query_ask", "/query_ask/follow_up"].map(path =>
    check(`${path} rejects anonymous requests`, async () => {
      assertResponse(await request(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Deployment probe", provider: "GOOGLE" }),
      }), 401);
    }),
  ),
  ...(isProduction ? [check("production Supabase OAuth redirects", async () => {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) throw new Error("set SUPABASE_ACCESS_TOKEN with Auth config read access");

    const publicConfig = await request("/env.json");
    assertResponse(publicConfig, 200);
    const supabaseUrl = new URL(publicConfig.json.VITE_SUPABASE_URL);
    const project = /^([a-z0-9]{20})\.supabase\.co$/.exec(supabaseUrl.hostname)?.[1];
    if (!project) throw new Error("cannot determine the Supabase project from /env.json");

    const config = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!config.ok) throw new Error(`Supabase Management API returned HTTP ${config.status}`);
    assertOAuthRedirectConfig(await config.json(), origin);
  })] : []),
  check("public Supabase configuration and OAuth providers", async () => {
    const response = await request("/env.json");
    assertResponse(response, 200);
    const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = response.json;
    if (typeof url !== "string" || typeof key !== "string") throw new Error("public configuration is incomplete");

    let role: string | undefined;
    try { role = JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString()).role; } catch {}
    if (!key.startsWith("sb_publishable_") && role !== "anon") {
      throw new Error("public configuration does not contain a publishable or anon key");
    }

    let settings: Response;
    try {
      const endpoint = new URL("/auth/v1/settings", url);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
        throw new Error("invalid Supabase URL");
      }
      settings = await fetch(endpoint, {
        headers: { apikey: key }, redirect: "error", signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error("cannot reach the configured Supabase Auth service");
    }
    if (!settings.ok) throw new Error(`Supabase Auth returned ${settings.status}`);
    const { external } = await settings.json();
    const disabled = ["google", "github"].filter(provider => external?.[provider] !== true);
    if (disabled.length) throw new Error(`OAuth providers not enabled: ${disabled.join(", ")}`);
  }),
]);

if (failed) process.exitCode = 1;
