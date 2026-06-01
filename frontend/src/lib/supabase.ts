import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy singleton pattern — ensures exactly ONE Supabase client is ever created,
 * regardless of how many times this module is imported or re-evaluated by Bun's
 * HMR during development. This is critical for PKCE: the code verifier written
 * to localStorage by signInWithOAuth() on the /auth page must be readable by
 * the same client instance on the /auth/callback page after the OAuth redirect.
 *
 * The top-level `await` on the singleton promise means every importing module
 * suspends until the client is ready — no race conditions with button clicks.
 */
let _supabasePromise: Promise<SupabaseClient> | null = null;

function createSupabaseClientSingleton(): Promise<SupabaseClient> {
    if (_supabasePromise) return _supabasePromise;

    _supabasePromise = fetch("/env.json")
        .then((res) => {
            if (!res.ok) throw new Error(`Failed to load env.json: ${res.status}`);
            return res.json();
        })
        .then((env: Record<string, string>) => {
            const url = env.VITE_SUPABASE_URL;
            const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

            if (!url || !key) {
                throw new Error(
                    "[supabase] Missing env vars: VITE_SUPABASE_URL or " +
                    "VITE_SUPABASE_PUBLISHABLE_KEY are undefined. " +
                    "Check that your frontend .env file exists and is loaded."
                );
            }

            return createClient(url, key, {
                auth: {
                    flowType: "pkce",
                    /**
                     * detectSessionInUrl is set to FALSE intentionally.
                     *
                     * When true, the SDK's constructor fires initialize() as an
                     * async fire-and-forget that auto-detects ?code= in the URL,
                     * reads the PKCE verifier from localStorage, exchanges it,
                     * and DELETES the verifier — all before AuthCallback.tsx's
                     * useEffect even fires. This creates a race condition where
                     * exchangeCodeForSession() finds the verifier already consumed.
                     *
                     * By setting this to false, the SDK does NOT auto-exchange.
                     * AuthCallback.tsx handles the code exchange manually via
                     * exchangeCodeForSession() — the only consumer of the verifier.
                     */
                    detectSessionInUrl: false,
                    persistSession: true,
                    storage: window.localStorage,
                    storageKey: "query-auth",
                },
            });
        });

    return _supabasePromise;
}

// Initialize immediately on module load — the top-level await blocks all
// importers until the client is fully constructed with valid env vars.
export const supabase = await createSupabaseClientSingleton();
