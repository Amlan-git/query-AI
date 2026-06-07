import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "./backend/index";

/**
 * Hand a Vercel serverless invocation to the Express app and keep the
 * function alive until the response is fully flushed.
 *
 * Vercel's Node runtime considers the function "done" the moment the handler
 * returns. Express dispatches synchronously, so a naive `return app(req, res)`
 * returns immediately while the SSE stream is still writing — Vercel then
 * tears down the socket mid-stream. Wrapping it in a promise that resolves on
 * `finish`/`close` keeps the invocation running through `res.end()`.
 */
export function handleExpressRoute(
  req: VercelRequest,
  res: VercelResponse,
  pathname: string
): Promise<void> {
  // Preserve query string while overriding the path Express sees.
  const queryIndex = req.url?.indexOf("?") ?? -1;
  const query = queryIndex >= 0 ? req.url?.slice(queryIndex) : "";
  req.url = `${pathname}${query || ""}`;

  // @vercel/node parses JSON bodies and drains the underlying stream before
  // we get here. Tell body-parser the body is already consumed so it doesn't
  // try to re-read the empty stream and clobber req.body with {}.
  const body = (req as { body?: unknown }).body;
  if (body && typeof body === "object") {
    (req as { _body?: boolean })._body = true;
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    res.on("finish", done);
    res.on("close", done);
    res.on("error", done);

    app(req, res);
  });
}
