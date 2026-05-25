import { serve } from "bun";
import path from "node:path";

/**
 * Backend API routes that must be reverse-proxied from the Bun dev server
 * (port 3000) to the Express backend (port 3001).
 */
const BACKEND_ORIGIN = "http://localhost:3001";
const DIST_DIR = path.join(process.cwd(), "dist");

/**
 * Creates a proxy handler that forwards the incoming request to the Express
 * backend, preserving method, headers, and body for full HTTP fidelity.
 */
async function proxyToBackend(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const backendUrl = `${BACKEND_ORIGIN}${url.pathname}${url.search}`;

  // Read the body as ArrayBuffer first — Bun cannot forward
  // a ReadableStream directly as it may already be consumed
  const body = req.method !== "GET" && req.method !== "HEAD" 
      ? await req.arrayBuffer() 
      : null;

  return fetch(backendUrl, {
      method: req.method,
      headers: req.headers,
      body: body,
  });
}

/**
 * Production-ready Static File Server in Bun.
 * Serves the statically compiled assets from the "dist" directory on disk.
 * Decouples subroute assets to the dist root and sends "Connection: close"
 * in every response to completely avoid Bun v1.3.x HTTP/1.1 socket pipelining/shifting bugs.
 */
const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. API proxy routes
    if (
      url.pathname === "/signin" ||
      url.pathname === "/signup" ||
      url.pathname === "/quest_ask" ||
      url.pathname.startsWith("/conversations") ||
      url.pathname === "/health"
    ) {
      const response = await proxyToBackend(req);
      // Append Connection: close to proxy response
      const headers = new Headers(response.headers);
      headers.set("Connection", "close");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // 2. env.json route (bridge fallback)
    if (url.pathname === "/env.json") {
      return Response.json({
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      }, {
        headers: {
          "Connection": "close",
          "Cache-Control": "no-store",
        }
      });
    }

    // 3. Serve static files from /dist
    let filePath = path.join(DIST_DIR, url.pathname);
    const assetExtensions = [".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".map", ".ico", ".json"];
    const ext = path.extname(url.pathname);

    // If it's a static asset loaded from a subroute (e.g. /auth/chunk-xxx.js), 
    // resolve it to the root of the dist folder.
    if (assetExtensions.includes(ext)) {
      filePath = path.join(DIST_DIR, path.basename(url.pathname));
    }

    // Security check: prevent directory traversal attacks
    if (!filePath.startsWith(DIST_DIR)) {
      return new Response("Forbidden", { 
        status: 403,
        headers: { "Connection": "close" }
      });
    }

    let file = Bun.file(filePath);
    if (await file.exists()) {
      const mimeTypes: Record<string, string> = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".map": "application/json",
        ".ico": "image/x-icon",
        ".json": "application/json",
        ".html": "text/html",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";
      const buffer = await file.arrayBuffer();

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "Connection": "close",
        },
      });
    }

    // 4. SPA fallback: serve index.html for all other routes
    const indexFile = Bun.file(path.join(DIST_DIR, "index.html"));
    const indexBuffer = await indexFile.arrayBuffer();
    return new Response(indexBuffer, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
        "Connection": "close",
      },
    });
  },
});

console.log(`🚀 Production Static Server running at ${server.url}`);
