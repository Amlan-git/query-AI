import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "./backend/index";

export function handleExpressRoute(
  req: VercelRequest,
  res: VercelResponse,
  pathname: string
) {
  const queryIndex = req.url?.indexOf("?") ?? -1;
  const query = queryIndex >= 0 ? req.url?.slice(queryIndex) : "";
  req.url = `${pathname}${query || ""}`;
  return app(req, res);
}
