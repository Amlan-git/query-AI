import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

// Programmatically load .env file to guarantee variables are baked in during production build
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

try {
  const envPath = path.join(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const [key, ...valueParts] = trimmedLine.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, ""); // strip optional quotes
      if (key.trim() === "VITE_SUPABASE_URL") supabaseUrl = value;
      if (key.trim() === "VITE_SUPABASE_PUBLISHABLE_KEY") supabaseKey = value;
    }
  }
  console.log("Successfully loaded environment from .env file programmatically.");
} catch (e) {
  console.warn("No local .env file found or loaded, falling back to shell environment.");
}

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL BUILD ERROR: Supabase environment variables are missing!");
  process.exit(1);
}

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "process.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
  },
});

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
