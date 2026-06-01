import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUp, Globe2, Quote, Search, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const exampleQuestions = [
  "What's driving data-center power demand in 2026?",
  "Compare Bun and Node for production servers",
  "How does PKCE OAuth actually work?",
  "Latest findings on microplastics and health",
];

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeExample, setActiveExample] = useState(exampleQuestions[0]);
  const [pointer, setPointer] = useState({ x: 50, y: 35 });

  const startAuthFlow = (prompt: string) => {
    const trimmed = prompt.trim();
    const search = trimmed ? `?prompt=${encodeURIComponent(trimmed)}` : "";
    navigate(`/auth${search}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startAuthFlow(query);
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#070806] text-[#f4f1eb]"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition-[background] duration-300"
        style={{
          background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(91, 225, 223, 0.12), transparent 26%)`,
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-[#5be1df]/[0.055] blur-3xl home-breathe" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-5 py-5 md:px-10">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 text-left"
            aria-label="Query home"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-[#5be1df] text-[#06110f]">
              <Search className="size-3.5" strokeWidth={2.7} />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight text-[#f7f2ea]">
              Query
            </span>
          </button>

          <nav className="flex items-center gap-3 text-sm text-[#aaa49a]">
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-xl border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-[#d9d3ca] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.08] hover:text-[#f7f2ea]"
            >
              <a
                href="https://github.com/Amlan-git/query-AI"
                target="_blank"
                rel="noreferrer"
              >
                <GithubIcon className="size-4" />
                <span className="hidden sm:inline">View on GitHub</span>
                <span className="sm:hidden">GitHub</span>
              </a>
            </Button>
            <Button
              onClick={() => startAuthFlow("")}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.075] px-4 text-sm font-medium text-[#f3eee7] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.12]"
            >
              Sign in
            </Button>
          </nav>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center pb-8 pt-14 text-center md:pt-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#5be1df]/35 bg-[#5be1df]/10 px-3 py-1.5 text-xs font-medium text-[#72edeb] shadow-[0_0_26px_rgba(91,225,223,0.08)] home-float">
            <span className="size-2 rounded-full bg-[#5be1df] home-ping-dot" />
            Real-time answers, grounded in live sources
          </div>

          <h1 className="max-w-[560px] font-serif text-[44px] font-semibold leading-[0.96] tracking-[-0.03em] text-[#faf7f1] md:text-[64px]">
            Ask anything.
            <br />
            Get answers
            <br />
            you can <em className="font-serif italic text-[#5be1df]">trust.</em>
          </h1>

          <p className="mt-8 max-w-[620px] text-[15px] leading-7 text-[#aaa49a] md:text-base">
            Query searches the live web, reads the best sources, and writes a clear, cited answer
            so you can see exactly where every claim comes from.
          </p>

          <div className="relative mt-9 w-full max-w-[790px] px-0 py-10">
            <form
              onSubmit={handleSubmit}
              className="group mx-auto flex min-h-[66px] w-full max-w-[640px] items-center gap-3 rounded-[18px] border border-white/10 bg-[#171612] px-4 shadow-[0_18px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-[#5be1df]/45 focus-within:shadow-[0_24px_80px_rgba(91,225,223,0.10),inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <Search className="size-5 shrink-0 text-[#8c877d] transition-colors group-focus-within:text-[#5be1df]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-[#f4f1eb] outline-none placeholder:text-[#827d74]"
                placeholder="Ask Query anything..."
                aria-label="Ask Query anything"
              />
              <span className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#c4beb4] sm:flex">
                <Globe2 className="size-3.5" />
                Web
              </span>
              <button
                type="submit"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#5be1df] text-[#05110f] transition-transform hover:scale-[1.05] active:scale-95 disabled:opacity-60"
                disabled={!query.trim()}
                aria-label="Continue to sign in"
              >
                <ArrowUp className="size-5" strokeWidth={2.7} />
              </button>
            </form>

            <div className="mx-auto mt-4 flex w-full max-w-[620px] items-center justify-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-[11px] text-[#9f998f]">
              <span className="inline-flex items-center gap-1.5 text-[#72edeb]">
                <span className="size-1.5 rounded-full bg-[#5be1df] home-ping-dot" />
                Live flow
              </span>
              <span className="hidden h-px flex-1 overflow-hidden rounded-full bg-white/[0.08] sm:block">
                <span className="block h-full w-1/3 rounded-full bg-[#5be1df]/70 home-scan" />
              </span>
              <span className="truncate">{query || activeExample}</span>
            </div>

            <div className="mx-auto mt-5 flex max-w-[660px] flex-wrap justify-center gap-3">
              {exampleQuestions.map((question, index) => (
                <button
                  key={question}
                  onMouseEnter={() => setActiveExample(question)}
                  style={{ animationDelay: `${index * 90}ms` }}
                  onClick={() => startAuthFlow(question)}
                  className="group home-chip inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#171612] px-4 py-2 text-xs text-[#d6d0c7] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5be1df]/40 hover:bg-[#1d211d] hover:text-[#f7f2ea] hover:shadow-[0_10px_30px_rgba(91,225,223,0.08)]"
                >
                  <Sparkles className="size-3 text-[#5be1df] transition-transform duration-200 group-hover:rotate-12" />
                  {question}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid w-full max-w-[780px] gap-4 border-t border-white/10 pt-7 text-left md:grid-cols-3">
            <Card className="group home-card-rise border-white/[0.07] bg-white/[0.035] py-0 text-[#f4f1eb] shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-[#5be1df]/25 hover:bg-white/[0.055] hover:shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <CardHeader className="gap-3 p-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.07] text-[#5be1df] transition-colors group-hover:bg-[#5be1df]/12">
                  <Globe2 className="size-4" />
                </span>
                <CardTitle className="text-sm font-semibold text-[#f4f1eb]">Live web search</CardTitle>
                <CardDescription className="text-xs leading-5 text-[#8f897f]">
                  Answers grounded in current sources, never guessed.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group home-card-rise border-white/[0.07] bg-white/[0.035] py-0 text-[#f4f1eb] shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-[#5be1df]/25 hover:bg-white/[0.055] hover:shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <CardHeader className="gap-3 p-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.07] text-[#5be1df] transition-colors group-hover:bg-[#5be1df]/12">
                  <Quote className="size-4" />
                </span>
                <CardTitle className="text-sm font-semibold text-[#f4f1eb]">Every claim cited</CardTitle>
                <CardDescription className="text-xs leading-5 text-[#8f897f]">
                  Inline citations link straight to the source.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group home-card-rise border-white/[0.07] bg-white/[0.035] py-0 text-[#f4f1eb] shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-[#5be1df]/25 hover:bg-white/[0.055] hover:shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <CardHeader className="gap-3 p-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.07] text-[#5be1df] transition-colors group-hover:bg-[#5be1df]/12">
                  <Zap className="size-4" />
                </span>
                <CardTitle className="text-sm font-semibold text-[#f4f1eb]">Streams as it thinks</CardTitle>
                <CardDescription className="text-xs leading-5 text-[#8f897f]">
                  Watch the answer build word by word after sign in.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
