import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExpressRoute } from "../../vercel-handler";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const conversationId = req.query.conversationId;
  const id = Array.isArray(conversationId) ? conversationId[0] : conversationId;
  return handleExpressRoute(req, res, `/conversations/${id || ""}`);
}
