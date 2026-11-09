import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { resolveOAuthSession } from "@/lib/auth-flow";
import { pendingConversationReturn, rememberConversationReturn } from "@/lib/conversation-return";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const exchangeInitiated = useRef(false);

  useEffect(() => {
    async function syncAndNavigate(session: Session) {
      const name =
        session.user?.user_metadata?.full_name ||
        session.user?.user_metadata?.name ||
        session.user?.email ||
        "User";
      const rawProvider = session.user?.app_metadata?.provider || "google";
      const provider = rawProvider === "github" ? "GITHUB" : "GOOGLE";

      try {
        const response = await fetch("/signin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name, provider }),
        });

        if (!response.ok) {
          console.warn(
            "[auth-callback] Backend sync failed:",
            await response.text()
          );
        } else {
          console.log("[auth-callback] Backend sync succeeded");
        }
      } catch (syncError) {
        // Non-fatal: log and continue — the user is already authenticated
        console.warn(
          "[auth-callback] Network error during backend sync:",
          syncError
        );
      }

      const destination = pendingConversationReturn();
      rememberConversationReturn(null);
      const prompt = new URLSearchParams(window.location.search).get("prompt");
      navigate(destination ?? (prompt ? `/search?prompt=${encodeURIComponent(prompt)}` : "/search"), { replace: true });
    }

    async function handleCallback() {
      if (exchangeInitiated.current) return;
      exchangeInitiated.current = true;

      try {
        const callbackUrl = new URL(window.location.href);
        const session = await resolveOAuthSession(supabase.auth, callbackUrl.search);
        // OAuth codes can only be redeemed once. A reload during profile sync
        // must recover the newly established session instead of redeeming it again.
        if (callbackUrl.searchParams.has("code")) {
          callbackUrl.searchParams.delete("code");
          window.history.replaceState(window.history.state, "", callbackUrl);
        }
        await syncAndNavigate(session);
      } catch (err: unknown) {
        console.error("[auth-callback] Unexpected error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      }
    }

    handleCallback();
  }, [navigate]);

  if (status === "error") {
    const destination = pendingConversationReturn();
    const retryPath = destination ? `/auth?${new URLSearchParams({ returnTo: destination })}` : "/auth";
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6 relative z-10">
        <Card className="w-full max-w-md bg-gradient-to-b from-card/85 to-card border border-destructive/20 shadow-xl backdrop-blur-md">
          <CardHeader className="text-center py-8 gap-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
              <AlertCircle className="size-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-destructive">
              Authentication Failed
            </CardTitle>
            <CardDescription className="max-w-xs mx-auto">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-8">
            <Button onClick={() => navigate(retryPath)} className="px-6 py-5 cursor-pointer">
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6 relative z-10">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground text-sm font-semibold animate-pulse">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}
