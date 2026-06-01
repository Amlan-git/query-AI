import { useState } from "react";
import { useSearchParams } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={props.className} aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.82-.07-1.42-.22-2.05H12v3.72h5.51c-.11.93-.71 2.32-2.05 3.26l-.02.13 2.98 2.31.2.02c1.84-1.7 2.98-4.2 2.98-7.39Z" />
    <path fill="#34A853" d="M12 22c2.63 0 4.84-.87 6.45-2.37l-3.07-2.38c-.82.57-1.92.97-3.38.97-2.57 0-4.75-1.7-5.53-4.04l-.12.01-3.1 2.4-.04.11A9.99 9.99 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.47 14.18A6.17 6.17 0 0 1 6.14 12c0-.76.12-1.49.32-2.18l-.01-.13-3.14-2.44-.1.05A9.99 9.99 0 0 0 2.14 12c0 1.61.39 3.13 1.07 4.47l3.26-2.29Z" />
    <path fill="#EA4335" d="M12 5.78c1.83 0 3.07.79 3.77 1.45l2.75-2.69C16.84 2.98 14.63 2 12 2a9.99 9.99 0 0 0-8.79 5.3l3.25 2.52C7.25 7.48 9.43 5.78 12 5.78Z" />
  </svg>
);

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const prompt = searchParams.get("prompt") || "";

  async function login(provider: "github" | "google") {
    setLoading(true);
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    if (prompt) {
      callbackUrl.searchParams.set("prompt", prompt);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString()
      }
    });

    if (error) {
      console.error("[auth] OAuth error:", error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070806] px-6 py-10 text-[#f4f1eb]">
      <section className="flex w-full max-w-[560px] flex-col items-center text-center">
        <div className="mb-9 inline-flex items-center gap-3 rounded-full border border-[#5be1df]/45 bg-[#5be1df]/10 px-4 py-2 text-sm font-medium text-[#72edeb] shadow-[0_0_30px_rgba(91,225,223,0.08)]">
          <span className="size-2 rounded-full bg-[#5be1df]" />
          Sign in to continue
        </div>

        <h1 className="max-w-[520px] font-serif text-[42px] font-semibold leading-[1.03] tracking-[-0.03em] text-[#faf7f1] md:text-[52px]">
          Answers you can <em className="font-serif italic text-[#5be1df]">trust</em>
          <br />
          are one sign-in away.
        </h1>

        <div className="mt-11 flex w-full max-w-[426px] flex-col gap-4">
          <Button
            onClick={() => login("google")}
            disabled={loading}
            className="h-[60px] w-full gap-4 rounded-xl border border-white/10 bg-[#1d1a15] px-6 text-base font-semibold text-[#f4f1eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-[#25221c] disabled:opacity-60"
          >
            <GoogleIcon className="size-6" />
            Continue with Google
          </Button>

          <Button
            onClick={() => login("github")}
            disabled={loading}
            className="h-[60px] w-full gap-4 rounded-xl border border-white/10 bg-[#1d1a15] px-6 text-base font-semibold text-[#f4f1eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-[#25221c] disabled:opacity-60"
          >
            <GithubIcon className="size-6 text-white" />
            Continue with GitHub
          </Button>

          <div className="mt-4 flex items-center justify-center gap-3 text-[15px] text-[#928d84]">
            {loading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-[#5be1df] border-t-transparent" />
            ) : (
              <ShieldCheck className="size-4 text-[#5be1df]" />
            )}
            <span>{loading ? "Redirecting to provider..." : "No passwords - single sign-on only"}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
