const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const DIST_DIR = path.join(__dirname, "dist");
const BACKEND_ORIGIN = "http://localhost:3001";

// Load .env variables programmatically to ensure Express serves them correctly to the client via /env.json
try {
  const envPath = path.join(__dirname, ".env");
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const [key, ...valueParts] = trimmedLine.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, ""); // strip optional quotes
      process.env[key.trim()] = value;
    }
  }
  console.log("Successfully loaded environment from .env file programmatically in Express.");
} catch (e) {
  console.warn("Could not load local .env file in Express, falling back to shell environment:", e.message);
}

// 1. Middleware to resolve relative path assets from subroutes (e.g. /auth/chunk-xxx.js -> /chunk-xxx.js)
app.use((req, res, next) => {
  const assetExtensions = [".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".map", ".ico", ".json"];
  const ext = path.extname(req.path);
  if (assetExtensions.includes(ext)) {
    const filename = path.basename(req.path);
    req.url = "/" + filename;
  }
  next();
});

// 2. Serve env.json dynamically
app.get("/env.json", (req, res) => {
  res.json({
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
});

// 3. Proxy API calls to backend (Express 5/path-to-regexp v8 requires named wildcards e.g. *any)
const proxyRoutes = ["/signin", "/signup", "/quest_ask", "/conversations", "/health"];
app.all(proxyRoutes.flatMap(r => [r, `${r}/*any`]), async (req, res) => {
  try {
    const backendUrl = `${BACKEND_ORIGIN}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host; // let fetch set correct host header

    const body = ["GET", "HEAD"].includes(req.method)
      ? undefined
      : await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
          req.on("error", reject);
        });

    const response = await fetch(backendUrl, {
      method: req.method,
      headers,
      body,
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Proxy error");
  }
});

// 4. Serve static files from dist
app.use(express.static(DIST_DIR));

// 5. SPA Fallback: serve index.html for all other routes (path-to-regexp v8 named wildcard)
app.get("/*any", (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Node/Express Static Server running on port ${PORT}`);
});
