import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExpressRoute } from "../../vercel-handler";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const conversationId = req.query.conversationId;
  const id = Array.isArray(conversationId) ? conversationId[0] : conversationId;
  await handleExpressRoute(req, res, `/conversations/${id || ""}`);
}
