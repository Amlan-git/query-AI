import { expect, test } from "bun:test";
import { assertOAuthRedirectConfig } from "../oauth-redirect";

const origin = new URL("https://query-ai-search.vercel.app");
const callback = new URL("/auth/callback", origin).href;
const legacy = "https://queryaisearch.vercel.app";

test("accepts the canonical site and exact callback alongside other entries", () => {
  expect(() => assertOAuthRedirectConfig({
    site_url: origin.href,
    uri_allow_list: `${legacy}/auth/callback, ${callback}`,
  }, origin)).not.toThrow();
});

test("rejects the legacy Site URL even when the callback is allowed", () => {
  expect(() => assertOAuthRedirectConfig({
    site_url: legacy,
    uri_allow_list: callback,
  }, origin)).toThrow("Site URL");
});

test("rejects a wildcard or legacy callback in place of the exact entry", () => {
  expect(() => assertOAuthRedirectConfig({
    site_url: origin.href,
    uri_allow_list: `${legacy}/auth/callback,${origin.origin}/**`,
  }, origin)).toThrow("exact OAuth callback");
});
