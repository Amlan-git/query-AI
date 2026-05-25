import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor">
    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.53 0-6.4-2.87-6.4-6.4s2.87-6.4 6.4-6.4c1.558 0 2.977.56 4.088 1.486L21.12 4.3C18.913 2.248 15.82 1 12.24 1 6.032 1 1 6.032 1 12.24s5.032 11.24 11.24 11.24c5.897 0 10.74-4.254 10.74-11.24 0-.768-.073-1.507-.197-2.21H12.24z" />
  </svg>
);

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

export default function Auth() {
  const [loading, setLoading] = useState(false);

  async function login(provider: "github" | "google") {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      console.error("[auth] OAuth error:", error.message);
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-md p-6 relative z-10 flex min-h-[80vh] items-center justify-center">
      <Card className="w-full bg-gradient-to-b from-card/85 to-card border shadow-xl backdrop-blur-md transition-all duration-300">
        <CardHeader className="text-center py-8 gap-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <Shield className="size-7" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Quest Login
          </CardTitle>
          <CardDescription className="max-w-xs mx-auto">
            Choose your preferred sign-in provider to continue your research session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6">
          <Button
            onClick={() => login("google")}
            disabled={loading}
            className="w-full gap-3 px-6 py-5 text-base font-semibold shadow-md transition-transform hover:scale-102 flex items-center justify-center cursor-pointer"
          >
            <GoogleIcon className="size-5" />
            Continue with Google
          </Button>

          <Button
            onClick={() => login("github")}
            disabled={loading}
            variant="outline"
            className="w-full gap-3 px-6 py-5 text-base font-semibold border shadow-sm hover:scale-102 flex items-center justify-center cursor-pointer"
          >
            <GithubIcon className="size-5" />
            Continue with GitHub
          </Button>
        </CardContent>
        {loading && (
          <CardFooter className="justify-center flex flex-col gap-2 pb-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground text-xs font-semibold animate-pulse">
              Redirecting to provider...
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
