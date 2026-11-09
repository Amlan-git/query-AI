export function assertOAuthRedirectConfig(
  config: { site_url?: string; uri_allow_list?: string },
  origin: URL,
) {
  const siteUrl = new URL("/", origin).href;
  const callback = new URL("/auth/callback", origin).href;

  if (config.site_url !== siteUrl && config.site_url !== origin.origin) {
    throw new Error(`Supabase Site URL must be ${siteUrl}`);
  }
  if (!config.uri_allow_list?.split(",").some(entry => entry.trim() === callback)) {
    throw new Error(`Supabase redirect allowlist must contain the exact OAuth callback ${callback}`);
  }
}
