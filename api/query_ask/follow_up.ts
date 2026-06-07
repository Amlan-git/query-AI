import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExpressRoute } from "../../vercel-handler";

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleExpressRoute(req, res, "/query_ask/follow_up");
}
