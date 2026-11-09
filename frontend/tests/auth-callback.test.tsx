import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";

const exchangeCodeForSession = mock();
const getSession = mock(async () => ({ data: { session: null }, error: null }));
mock.module("../src/lib/supabase", () => ({
  supabase: { auth: { exchangeCodeForSession, getSession } },
}));
const { default: AuthCallback } = await import("../src/pages/AuthCallback");

let browser: Window;
let root: Root;
const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;

beforeEach(() => {
  browser = new Window({ url: "https://query-ai-search.vercel.app/auth/callback" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.defineProperty(globalThis, "document", { configurable: true, value: browser.document });
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = mock(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
  root = createRoot(browser.document.body as unknown as HTMLElement);
  exchangeCodeForSession.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  await browser.happyDOM.close();
  globalThis.fetch = originalFetch;
  globals.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  for (const [key, descriptor] of [["window", originalWindow], ["document", originalDocument]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

async function renderCallback(query: string) {
  browser.location.search = query;
  await act(async () => root.render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/search" element={<h1>Search page</h1>} />
        <Route path="/auth" element={<h1>Sign-in page</h1>} />
      </Routes>
    </MemoryRouter>,
  ));
}

test("a successful code exchange opens search and removes the one-time code", async () => {
  exchangeCodeForSession.mockResolvedValue({
    data: { session: { access_token: "test-token", user: { id: "test-user" } } },
    error: null,
  });

  await renderCallback("?code=test-code");

  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
  expect(browser.document.body.textContent).toContain("Search page");
  expect(browser.location.search).toBe("");
});

test.each([
  ["an expired code", "?code=expired", "Code expired"],
  ["a missing code and session", "", "No authentication code"],
])("%s shows a retry that returns to sign-in", async (_, query, errorMessage) => {
  exchangeCodeForSession.mockResolvedValue({
    data: { session: null },
    error: new Error("Code expired"),
  });

  await renderCallback(query);

  expect(browser.document.body.textContent).toContain("Authentication Failed");
  expect(browser.document.body.textContent).toContain(errorMessage);
  const retry = browser.document.querySelector("button");
  expect(retry?.textContent).toBe("Try Again");
  await act(async () => retry?.click());
  expect(browser.document.body.textContent).toContain("Sign-in page");
});
