import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const exchangeCodeForSession = mock();
const signInWithOAuth = mock(async () => ({ error: null }));
const getSession = mock(async (): Promise<{ data: { session: { access_token: string } | null }; error: null }> =>
  ({ data: { session: null }, error: null }));
mock.module("../src/lib/supabase", () => ({
  supabase: { auth: { exchangeCodeForSession, getSession, signInWithOAuth,
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}));
const { default: AuthCallback } = await import("../src/pages/AuthCallback");

const { default: Auth } = await import("../src/pages/Auth");
const { default: ProtectedRoute } = await import("../src/components/ProtectedRoute");
const { useSearch } = await import("../src/hooks/useSearch");

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
  getSession.mockResolvedValue({ data: { session: null }, error: null });
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

const conversationId = "dbf9e48a-6f87-4d72-b84d-01c1d6932752";

async function mountSearch() {
  getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null });
  let controls!: ReturnType<typeof useSearch>;
  function SearchProbe() {
    controls = useSearch();
    return <output>{controls.state.status}</output>;
  }
  await act(async () => root.render(<SearchProbe />));
  return {
    search: (id?: string) => controls.search("private query", id),
    reset: () => controls.reset(),
  };
}

test.each([
  ["new", undefined, true],
  ["follow_up", conversationId, true],
  ["new", undefined, false],
] as const)("reports %s search (conversation=%s, complete=%s)", async (operation, id, complete) => {
  const controls = await mountSearch();
  const requests = mock(async (url: string, _init: RequestInit) => {
    if (url.endsWith("/telemetry")) return new Response(null, { status: 204 });
    const chunks = [
      "<ME",
      `TA>${JSON.stringify({ conversationId })}</META>\n<SOURCES>[]</SOURCES>\n<IMAGES>[]</IMAGES>\n`,
      "private answer",
      ...(complete ? ["\n<FOLLOW_UPS>[]</FOLLOW_UPS>\n"] : []),
    ];
    return new Response(new ReadableStream({
      start(stream) {
        for (const chunk of chunks) stream.enqueue(new TextEncoder().encode(chunk));
        stream.close();
      },
    }));
  });
  globalThis.fetch = requests as unknown as typeof fetch;

  await act(async () => controls.search(id));

  expect(browser.document.body.textContent).toBe(complete ? "complete" : "error");
  const [searchRequest, telemetryRequest] = requests.mock.calls;
  expect(searchRequest?.[0]).toBe(id ? "/query_ask/follow_up" : "/query_ask");
  expect(telemetryRequest?.[0]).toBe("/query_ask/telemetry");
  expect(JSON.parse(String(telemetryRequest?.[1].body))).toEqual({
    operation,
    requestId: (searchRequest?.[1].headers as Record<string, string>)["X-Search-Request-Id"],
    outcome: complete ? "complete" : "failed",
    firstTextMs: expect.any(Number),
    durationMs: expect.any(Number),
  });
});

test("reset cancels an in-flight search and reports cancellation separately", async () => {
  const controls = await mountSearch();
  let requestStarted!: () => void;
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  const requests = mock(async (url: string, init: RequestInit) => {
    if (url.endsWith("/telemetry")) return new Response(null, { status: 204 });
    requestStarted();
    return new Promise<Response>((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });
  });
  globalThis.fetch = requests as unknown as typeof fetch;

  await act(async () => {
    const pending = controls.search();
    await started;
    controls.reset();
    await pending;
  });

  expect(browser.document.body.textContent).toBe("idle");
  expect(JSON.parse(String(requests.mock.calls[1]?.[1].body))).toMatchObject({
    outcome: "cancelled", firstTextMs: null,
  });
});
