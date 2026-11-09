export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  const source = new URL("https://queryaisearch.vercel.app" + req.url);
  const destination = new URL("https://query-ai-search.vercel.app");
  const staleCallback = /^\/auth\/callback\/?$/.test(source.pathname) ||
    (source.pathname === "/" && ["code", "error", "error_code", "error_description"]
      .some(key => source.searchParams.has(key)));

  if (staleCallback) {
    destination.pathname = "/auth";
    res.setHeader("Referrer-Policy", "no-referrer");
  } else {
    destination.pathname = source.pathname;
    destination.search = source.search;
  }
  res.setHeader("Location", destination.href);
  return res.status(307).end();
}
