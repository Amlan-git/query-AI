import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExpressRoute } from "../vercel-handler";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleExpressRoute(req, res, "/health");
}
