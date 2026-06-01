import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { type SearchTurn, useSearch } from "@/hooks/useSearch";
import SearchBar from "@/components/search/SearchBar";
import SourceCards from "@/components/search/SourceCards";
import AnswerStream from "@/components/search/AnswerStream";
import FollowUpQuestions from "@/components/search/FollowUpQuestions";
import ImageSection from "@/components/search/ImageSection";
import ResearchSteps from "@/components/search/ResearchSteps";
import { ImageIcon, LinkIcon } from "lucide-react";

export default function SearchPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize the SSE stream control hook
  const { state, search, reset, setComplete } = useSearch();

  const bottomRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);
  const suppressRedirectConversationIdRef = useRef<string | null>(null);
  const [userName, setUserName] = useState("there");
  const [activeTab, setActiveTab] = useState<"answer" | "links" | "images">("answer");

  // Load user details from session to personalize the idle greeting
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const email = session.user.email;
          const namePart = email ? email.split("@")[0] : "";
          if (namePart) {
            const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
            setUserName(capitalized);
          }
        }
      } catch (err) {
        console.error("Failed to load user details for greeting:", err);
      }
    }
    loadUser();
  }, []);

  // Load conversation details from API if we navigate directly to an existing conversation URL
  useEffect(() => {
    const activeConvId = conversationId;
    if (!activeConvId) {
      if (location.state?.newChat) {
        suppressRedirectConversationIdRef.current =
          state.status === "complete" && "conversationId" in state
            ? state.conversationId
            : null;
        navigate("/search", { replace: true, state: null });
      }
      reset();
      return;
    }

    // Optimization: If the hook state is already computed and complete for this URL, skip redundant fetch
    if (
      state.status === "complete" &&
      "conversationId" in state &&
      state.conversationId === activeConvId
    ) {
      return;
    }

    async function loadConversation(convId: string) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        const response = await fetch(`/conversations/${convId}`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          // Fall back to general search page if conversation loading fails (e.g. not found)
          navigate("/search");
          return;
        }

        const json = await response.json();
        const messages = (json.data?.messages || []) as Array<{
          role: string;
          content: string;
          sources: Array<{ url: string; title: string; snippet?: string }> | null;
        }>;

        const turns = messages.reduce<SearchTurn[]>((acc, message) => {
          if (message.role === "USER") {
            acc.push({
              query: message.content,
              answer: "",
              sources: [],
              images: [],
              followUps: []
            });
            return acc;
          }

          if (message.role === "ASSISTANT") {
            const lastOpenTurn = [...acc].reverse().find((turn) => !turn.answer);
            const targetTurn = lastOpenTurn ?? {
              query: "",
              answer: "",
              sources: [],
              images: [],
              followUps: []
            };

            targetTurn.answer = message.content;
            targetTurn.sources = message.sources || [];

            if (!lastOpenTurn) {
              acc.push(targetTurn);
            }
          }

          return acc;
        }, []);
        const lastTurn = [...turns].reverse().find((turn) => turn.query || turn.answer);

        if (lastTurn) {
          setComplete(
            lastTurn.answer,
            lastTurn.sources,
            convId,
            lastTurn.query,
            lastTurn.followUps,
            lastTurn.images,
            turns.map((turn) => turn.query).filter(Boolean),
            turns
          );
        } else {
          setComplete("", [], convId);
        }
      } catch (err) {
        console.error("Failed to load conversation details:", err);
        navigate("/search");
      }
    }

    loadConversation(activeConvId);
  }, [conversationId, location.key]);

  // Navigate to conversation route once search finishes and yields a valid conversationId
  useEffect(() => {
    if (
      state.status === "complete" &&
      "conversationId" in state &&
      state.conversationId &&
      state.conversationId !== conversationId &&
      (conversationId || state.query)
    ) {
      if (suppressRedirectConversationIdRef.current === state.conversationId) {
        suppressRedirectConversationIdRef.current = null;
        return;
      }
      navigate(`/search/${state.conversationId}`);
    }
  }, [state.status, state, conversationId, navigate]);

  // Auto-scroll behavior
  useEffect(() => {
    if (state.status === "loading") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (state.status === "streaming" || state.status === "complete") {
      const target = answerEndRef.current ?? answerRef.current;
      target?.scrollIntoView({
        behavior: state.status === "streaming" ? "auto" : "smooth",
        block: "nearest"
      });
    }
  }, [state]);

  const scrollToSection = (section: "answer" | "links" | "images") => {
    setActiveTab(section);

    if (section === "answer") {
      answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (section === "links") {
      linksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (section === "images") {
      imagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Submit queries to the SSE stream hook
  const handleSearchSubmit = async (query: string) => {
    // The URL is the source of truth. On /search, this must be a brand-new conversation.
    await search(query, conversationId);
  };

  const autoSubmittedPromptRef = useRef<string | null>(null);

  useEffect(() => {
    if (conversationId || state.status !== "idle") return;

    const prompt = new URLSearchParams(location.search).get("prompt")?.trim();
    if (!prompt || autoSubmittedPromptRef.current === prompt) return;

    autoSubmittedPromptRef.current = prompt;
    void search(prompt, undefined);
  }, [conversationId, location.search, search, state.status]);

  // View 1: IDLE / EMPTY landing state — Gemini-style hero
  if (state.status === "idle") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 select-none overflow-hidden">
        {/* Subtle radial glow background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 55%, oklch(0.18 0.06 245 / 0.7) 0%, oklch(0.08 0.02 245 / 0.3) 50%, transparent 80%)",
            animation: "glow-pulse 8s ease-in-out infinite",
          }}
        />

        <div className="w-full max-w-2xl flex flex-col items-center relative z-10">
          {/* Greeting */}
          <h1
            className="text-3xl md:text-4xl lg:text-[42px] font-light text-foreground/90 tracking-[-0.01em] mb-10 text-center leading-snug"
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
          >
            Hi {userName}, what's your query?
          </h1>

          {/* Search Composer */}
          <div className="w-full">
            <SearchBar onSearch={handleSearchSubmit} isLoading={false} autoFocus />
          </div>

          {/* Hint text */}
          <p className="mt-5 text-[13px] text-muted-foreground/35 font-light text-center">
            Search the web, ask a question, or start a conversation
          </p>
        </div>
      </div>
    );
  }

  const activeQuestion = "query" in state ? state.query : "";
  const activeSources = "sources" in state ? state.sources : [];
  const activeImages = "images" in state ? state.images : [];
  const activeAnswer = "answer" in state ? state.answer : "";
  const activeFollowUps = "followUps" in state ? state.followUps : [];
  const activeTurns =
    "turns" in state && state.turns.length > 0
      ? state.turns
      : activeQuestion
        ? [{
            query: activeQuestion,
            answer: activeAnswer,
            sources: activeSources,
            images: activeImages,
            followUps: activeFollowUps
          }]
        : [];
  const isAnswerStreaming = state.status === "streaming";
  const latestTurnIndex = Math.max(0, activeTurns.length - 1);

  // Views 2-5: ACTIVE (top-pinned query bar, citation listing, streaming answer output)
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        background: "radial-gradient(circle at bottom, oklch(0.12 0.025 245) 0%, oklch(0.07 0.015 245) 65%, oklch(0.04 0.008 245) 100%)"
      }}
    >
      <div className="border-b border-white/[0.06] bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-[58px] w-full max-w-[790px] items-end gap-7 px-4">
          <button
            onClick={() => scrollToSection("answer")}
            className={`flex h-full items-center gap-2 border-b-2 pt-1 text-sm font-medium transition-colors ${
              activeTab === "answer"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground/85 hover:text-foreground"
            }`}
          >
            <span className="flex size-4 items-center justify-center text-[13px] font-bold leading-none">Q</span>
            Answer
          </button>
          <button
            onClick={() => scrollToSection("links")}
            className={`flex h-full items-center gap-2 border-b-2 pt-1 text-sm font-medium transition-colors ${
              activeTab === "links"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground/85 hover:text-foreground"
            }`}
          >
            <LinkIcon className="size-4" />
            Links
          </button>
          <button
            onClick={() => scrollToSection("images")}
            className={`flex h-full items-center gap-2 border-b-2 pt-1 text-sm font-medium transition-colors ${
              activeTab === "images"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground/85 hover:text-foreground"
            }`}
          >
            <ImageIcon className="size-4" />
            Images
          </button>
        </div>
      </div>

      {/* Scrollable answer area */}
      <div className="flex-1 overflow-y-auto px-4 py-9">
        <div className="mx-auto flex w-full max-w-[790px] flex-col gap-7">

          {activeTurns.map((turn, index) => {
            const isLatestTurn = index === latestTurnIndex;
            const turnIsLoading = isLatestTurn && state.status === "loading";
            const turnIsStreaming = isLatestTurn && isAnswerStreaming;

            return (
              <div key={`${turn.query || "assistant"}-${index}`} className="flex flex-col gap-7">
                {turn.query && (
                  <div className="ml-auto max-w-[660px] rounded-[18px] bg-white/[0.055] px-4 py-3 text-[15px] leading-relaxed text-foreground/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:px-5">
                    {turn.query}
                  </div>
                )}

                {turnIsLoading && (
                  <div className="flex flex-col gap-4 py-2 px-1">
                    <ResearchSteps query={turn.query} isStreaming sourceCount={turn.sources.length} />
                    <div className="flex flex-col gap-3 animate-pulse">
                      <div className="h-4.5 bg-white/[0.04] border border-white/[0.03] rounded-lg w-full" />
                      <div className="h-4.5 bg-white/[0.04] border border-white/[0.03] rounded-lg w-11/12" />
                      <div className="h-4.5 bg-white/[0.04] border border-white/[0.03] rounded-lg w-4/5" />
                    </div>
                  </div>
                )}

                {(turn.answer || turnIsStreaming) && (
                  <div ref={isLatestTurn ? answerRef : undefined} className="scroll-mt-6">
                    <ResearchSteps
                      query={turn.query}
                      isStreaming={turnIsStreaming}
                      sourceCount={turn.sources.length}
                    />
                    <AnswerStream
                      answer={turn.answer}
                      isStreaming={turnIsStreaming}
                      sources={turn.sources}
                    />
                    <div ref={isLatestTurn ? answerEndRef : undefined} />
                  </div>
                )}

                {turn.sources.length > 0 && (
                  <div ref={isLatestTurn ? linksRef : undefined} className="scroll-mt-6">
                    <SourceCards sources={turn.sources} />
                  </div>
                )}

                {turn.images.length > 0 && (
                  <div ref={isLatestTurn ? imagesRef : undefined} className="scroll-mt-6">
                    <ImageSection images={turn.images} />
                  </div>
                )}
              </div>
            );
          })}

          {activeFollowUps.length > 0 && (
            <FollowUpQuestions
              questions={activeFollowUps}
              onSelect={handleSearchSubmit}
              disabled={state.status === "loading" || state.status === "streaming"}
            />
          )}

          {/* Error */}
          {state.status === "error" && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-xl p-4 border border-destructive/20">
              {state.message}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom input — always visible */}
      <div className="px-4 pb-6 pt-3 border-t border-white/[0.05] bg-background/60 backdrop-blur-md">
        <div className="max-w-2xl mx-auto w-full">
          <SearchBar
            onSearch={handleSearchSubmit}
            isLoading={state.status === "loading" || state.status === "streaming"}
            placeholder="Ask a follow-up…"
          />
        </div>
      </div>
    </div>
  );
}
