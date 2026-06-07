import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExpressRoute } from "../vercel-handler";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleExpressRoute(req, res, "/signin");
}
