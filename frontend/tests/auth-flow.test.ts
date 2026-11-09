import { expect, test } from "bun:test";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { resolveOAuthSession, checkProtectedAccess } from "../src/lib/auth-flow";

type Auth = SupabaseClient["auth"];
const oldSession = { user: { id: "old-user" } } as Session;
const newSession = { user: { id: "new-user" } } as Session;

test("a new OAuth code exchanges accounts even when an older session exists", async () => {
  const auth = {
    getSession: async () => ({ data: { session: oldSession }, error: null }),
    exchangeCodeForSession: async (code: string) => {
      expect(code).toBe("new-code");
      return { data: { session: newSession }, error: null };
    },
  } as unknown as Auth;
  expect((await resolveOAuthSession(auth, "?code=new-code" )).user.id).toBe("new-user");
});

test("a rejected new code never falls back to the previous account", async () => {
  const auth = {
    getSession: async () => ({ data: { session: oldSession }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session: null }, error: new Error("Code expired") }),
  } as unknown as Auth;
  await expect(resolveOAuthSession(auth, "?code=bad-code")).rejects.toThrow("Code expired");
});

test("an explicit provider denial is preserved even when a session already exists", async () => {
  const auth = { getSession: async () => ({ data: { session: oldSession }, error: null }) } as unknown as Auth;
  await expect(resolveOAuthSession(auth, "?error=access_denied&error_description=Access+denied")).rejects.toThrow("Access denied");
});

test("a callback without a code can recover an existing session", async () => {
  const auth = { getSession: async () => ({ data: { session: oldSession }, error: null }) } as unknown as Auth;
  expect((await resolveOAuthSession(auth, "")).user.id).toBe("old-user");
});

test("a callback without a code or session fails explicitly", async () => {
  const auth = { getSession: async () => ({ data: { session: null }, error: null }) } as unknown as Auth;
  await expect(resolveOAuthSession(auth, "")).rejects.toThrow("No authentication code");
});

test("a protected route reports a provider outage without treating it as a logout", async () => {
  const auth = { getUser: async () => ({ data: { user: null }, error: new AuthRetryableFetchError("network down", 0) }) } as unknown as Auth;
  expect((await checkProtectedAccess(auth)).status).toBe("error");
});

test("a thrown auth request settles in an error state instead of leaving loading active", async () => {
  const auth = { getUser: async () => { throw new Error("request failed"); } } as unknown as Auth;
  expect((await checkProtectedAccess(auth)).status).toBe("error");
});

test("a missing or rejected session requires sign-in", async () => {
  for (const error of [new AuthSessionMissingError(), new AuthApiError("bad token", 401, "bad_jwt")]) {
    const auth = { getUser: async () => ({ data: { user: null }, error }) } as unknown as Auth;
    expect((await checkProtectedAccess(auth)).status).toBe("signed-out");
  }
});

test("verified users can enter the protected route", async () => {
  const auth = { getUser: async () => ({ data: { user: { id: "verified-user" } }, error: null }) } as unknown as Auth;
  expect((await checkProtectedAccess(auth)).status).toBe("authenticated");
});
