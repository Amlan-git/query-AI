import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../backend/index";

export default function handler(req: VercelRequest, res: VercelResponse) {
  req.url = req.url?.replace(/^\/api(?=\/|$)/, "") || "/";
  return app(req, res);
}
