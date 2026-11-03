import { isAuthApiError, isAuthSessionMissingError, type Session, type SupabaseClient } from "@supabase/supabase-js";

type Auth = SupabaseClient["auth"];
export type AccessState = { status: "loading" | "authenticated" | "signed-out" | "error" };

// Authentication decisions are independent of rendering so they can be verified
// without browser storage or a live provider.
export async function resolveOAuthSession(auth: Auth, search: string): Promise<Session> {
  const params = new URLSearchParams(search);
  if (params.has("error")) {
    throw new Error(params.get("error_description") || "Sign-in was not completed. Please try again.");
  }
  const code = params.get("code");
  if (code) {
    const { data, error } = await auth.exchangeCodeForSession(code);
    if (error || !data.session) throw error || new Error("Authentication failed. Please try again.");
    return data.session;
  }
  // Recovery is safe only when there is no new login to exchange.
  const { data: { session }, error } = await auth.getSession();
  if (error) throw error;
  if (session) return session;
  throw new Error("No authentication code found in the callback URL.");
}

export async function checkProtectedAccess(auth: Auth): Promise<AccessState> {
  try {
    const { data, error } = await auth.getUser();
    if (error) {
      const rejected = isAuthSessionMissingError(error) ||
        (isAuthApiError(error) && [400, 401, 403].includes(error.status));
      return { status: rejected ? "signed-out" : "error" };
    }
    return { status: data.user ? "authenticated" : "signed-out" };
  } catch {
    return { status: "error" };
  }
}
