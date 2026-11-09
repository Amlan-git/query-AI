import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { createSupabaseClient } from "./client.js";

type Verification =
  | { user: User }
  | { user: null; status: 401 | 503; error: string };

const unavailable = {
  user: null, status: 503,
  error: "Sign-in service is temporarily unavailable. Please try again shortly.",
} as const;

export async function verifyAccessToken(token: string): Promise<Verification> {
  try {
    const { data, error } = await createSupabaseClient().auth.getUser(token);
    if (isAuthRetryableFetchError(error) || (error?.status != null && error.status >= 500)) {
      return unavailable;
    }
    if (error || !data.user) {
      return { user: null, status: 401, error: "Invalid or expired token" };
    }
    return { user: data.user };
  } catch {
    return unavailable;
  }
}
