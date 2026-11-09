import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const exchangeCodeForSession = mock();
const signInWithOAuth = mock(async () => ({ error: null }));
const getSession = mock(async () => ({ data: { session: null }, error: null }));
mock.module("../src/lib/supabase", () => ({
  supabase: { auth: { exchangeCodeForSession, getSession, signInWithOAuth,
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}));
const { default: AuthCallback } = await import("../src/pages/AuthCallback");

const { default: Auth } = await import("../src/pages/Auth");
const { default: ProtectedRoute } = await import("../src/components/ProtectedRoute");

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
  signInWithOAuth.mockClear();
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

function ConversationPage() {
  const { pathname, search } = useLocation();
  return <h1>{pathname}{search}</h1>;
}

async function renderCallback(query: string) {
  browser.location.search = query;
  await act(async () => root.render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/search" element={<h1>Search page</h1>} />
        <Route path="/search/:id" element={<ConversationPage />} />
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


async function beginSignIn(entry: string) {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/search/:id" element={<ProtectedRoute><ConversationPage /></ProtectedRoute>} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  ));
  const signIn = Array.from(browser.document.querySelectorAll("button"))
    .find(button => button.textContent?.includes("Continue with Google"));
  expect(signIn).toBeDefined();
  await act(async () => signIn?.click());
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google",
    options: { redirectTo: "https://query-ai-search.vercel.app/auth/callback" },
  });
  await act(async () => root.unmount());
  root = createRoot(browser.document.body as unknown as HTMLElement);
  exchangeCodeForSession.mockResolvedValue({
    data: { session: { access_token: "test-token", user: { id: "test-user" } } },
    error: null,
  });
}

test("a signed-out conversation link returns to the original conversation after OAuth", async () => {
  const conversation = "/search/a11dd6d7-8924-4dd5-aae8-61e416ed990b?view=full";
  await beginSignIn(conversation);
  await renderCallback("?code=test-code");
  expect(browser.document.body.textContent).toContain(conversation);
});

test.each([
  "https://example.com/search/a11dd6d7-8924-4dd5-aae8-61e416ed990b",
  "//example.com",
  "/search/invalid",
  "/search/a11dd6d7-8924-4dd5-aae8-61e416ed990b/../../auth",
])("an unsafe return destination falls back to search (%s)", async destination => {
  await beginSignIn(`/auth?returnTo=${encodeURIComponent(destination)}`);
  await renderCallback("?code=test-code");
  expect(browser.document.body.textContent).toContain("Search page");
});
