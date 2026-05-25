import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertCircle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const exchangeInitiated = useRef(false);

  useEffect(() => {
    async function syncAndNavigate(session: any) {
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

      // Navigate to the main app
      navigate("/search");
    }

    async function handleCallback() {
      if (exchangeInitiated.current) return;
      exchangeInitiated.current = true;

      try {
        // 1. Check if a session already exists first (e.g. if HMR reloaded or pre-exchanged)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log("[auth-callback] Session already exists in client, navigating...");
          await syncAndNavigate(existingSession);
          return;
        }

        // 2. Extract the PKCE authorization code from the URL query params.
        const code = new URLSearchParams(window.location.search).get("code");

        if (!code) {
          setStatus("error");
          setErrorMessage("No authentication code found in the callback URL.");
          return;
        }

        // Diagnostic Logging of localStorage
        console.log("[auth-callback] All localStorage keys:", Object.keys(localStorage));
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            console.log(`[auth-callback] localStorage key: ${key} = ${localStorage.getItem(key)?.substring(0, 50)}...`);
          }
        }

        // 3. Exchange the code for a session.
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data.session) {
          // If exchangeCodeForSession failed, double check if a session somehow got set during the exchange
          const { data: { session: backupSession } } = await supabase.auth.getSession();
          if (backupSession) {
            console.log("[auth-callback] Exchange error occurred but active session found, continuing...");
            await syncAndNavigate(backupSession);
            return;
          }

          console.error("[auth-callback] Exchange code failed:", error);
          setStatus("error");
          setErrorMessage(
            error?.message || "Authentication failed. Please try again."
          );
          return;
        }

        // 4. Sync session to backend and navigate
        await syncAndNavigate(data.session);
      } catch (err: unknown) {
        console.error("[auth-callback] Unexpected error:", err);
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    }

    handleCallback();
  }, [navigate]);

  if (status === "error") {
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
            <Button onClick={() => navigate("/auth")} className="px-6 py-5 cursor-pointer">
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
