import { beforeEach, expect, mock, test } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

let result: any;
let thrown: Error | undefined;
// Keep token verification logic real; replace only the external auth and DB services.
mock.module("../client", () => ({
  createSupabaseClient: () => ({ auth: { getUser: async () => {
    if (thrown) throw thrown;
    return result;
  } } }),
}));
mock.module("../db", () => ({ prisma: {} }));
const { verifyToken } = await import("../middleware");
const { default: authRouter } = await import("../routes/auth.routes");

beforeEach(() => {
  thrown = undefined;
  result = { data: { user: null }, error: null };
});

async function verify() {
  let status = 200;
  let body: any;
  let continued = false;
  const req = {
    method: "GET", path: "/conversations", ip: "127.0.0.1",
    socket: {}, headers: { authorization: "Bearer test-token" },
  } as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as Response;
  await verifyToken(req, res, (() => { continued = true; }) as NextFunction);
  return { status, body, continued, user: req.user };
}

test("auth provider network outage returns 503 instead of invalidating the user's token", async () => {
  result.error = new AuthRetryableFetchError("fetch failed", 0);
  const response = await verify();
  expect(response.status).toBe(503);
  expect(response.continued).toBe(false);
});

test("unexpected auth service rejection returns 503 rather than a false 401", async () => {
  thrown = new Error("connection reset");
  expect((await verify()).status).toBe(503);
});

test("a genuinely rejected token still returns 401", async () => {
  result.error = new AuthApiError("invalid JWT", 401, "bad_jwt");
  expect((await verify()).status).toBe(401);
});

test("a verified identity is attached before allowing the protected request", async () => {
  result.data.user = { id: "verified-user" };
  const response = await verify();
  expect(response.continued).toBe(true);
  expect(response.user?.id).toBe("verified-user");
});

for (const path of ["/signin", "/signup"]) {
  async function submit() {
    let status = 200;
    const req = { headers: { authorization: "Bearer test-token" }, body: { name: "Test", provider: "GOOGLE" } } as Request;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
    const layer = authRouter.stack.find(layer => layer.route?.path === path);
    await layer!.route!.stack[0]!.handle(req, res, () => {});
    return status;
  }

  test(`${path} reports provider outages as 503`, async () => {
    result.error = new AuthRetryableFetchError("provider unavailable", 503);
    expect(await submit()).toBe(503);
  });

  test(`${path} handles thrown verification failures as 503`, async () => {
    thrown = new Error("network unavailable");
    expect(await submit()).toBe(503);
  });

  test(`${path} still rejects invalid tokens`, async () => {
    result.error = new AuthApiError("invalid JWT", 401, "bad_jwt");
    expect(await submit()).toBe(401);
  });
}
