import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useSearch } from "@/hooks/useSearch";
import SearchBar from "@/components/search/SearchBar";
import SourceCards from "@/components/search/SourceCards";
import AnswerStream from "@/components/search/AnswerStream";

export default function SearchPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  
  // Initialize the SSE stream control hook
  const { state, search, reset, setComplete } = useSearch();

  // Synchronous state reset when navigating to /search (New Search) to prevent redirect race condition
  if (!conversationId && state.status !== "idle") {
    reset();
  }

  // Load conversation details from API if we navigate directly to an existing conversation URL
  useEffect(() => {
    const activeConvId = conversationId;
    if (!activeConvId) {
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
          sources: Array<{ url: string; title: string }> | null;
        }>;

        // Find the last assistant message and its sources to hydrate the complete view
        const lastAssistant = [...messages].reverse().find((m) => m.role === "ASSISTANT");

        if (lastAssistant) {
          setComplete(lastAssistant.content, lastAssistant.sources || [], convId);
        } else {
          // If conversation has messages but no assistant response, hydrate with blank complete state
          setComplete("", [], convId);
        }
      } catch (err) {
        console.error("Failed to load conversation details:", err);
        navigate("/search");
      }
    }

    loadConversation(activeConvId);
  }, [conversationId]);

  // Navigate to conversation route once search finishes and yields a valid conversationId
  useEffect(() => {
    if (
      state.status === "complete" &&
      "conversationId" in state &&
      state.conversationId &&
      state.conversationId !== conversationId
    ) {
      navigate(`/search/${state.conversationId}`);
    }
  }, [state.status, state, conversationId, navigate]);

  // Submit queries to the SSE stream hook
  const handleSearchSubmit = async (query: string) => {
    // If the hook has an active conversationId (in streaming/complete state), use it for follow-ups
    const activeConvId = ("conversationId" in state) ? state.conversationId : conversationId;
    await search(query, activeConvId);
  };

  // View 1: IDLE / EMPTY landing state
  if (state.status === "idle") {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 max-w-3xl mx-auto w-full gap-8 select-none">
        <div className="text-center flex flex-col gap-2.5">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80 bg-clip-text text-transparent">
            Quest
          </h1>
          <p className="text-muted-foreground text-base md:text-lg font-light tracking-wide">
            Search anything. Get answers.
          </p>
        </div>
        <div className="w-full">
          <SearchBar onSearch={handleSearchSubmit} isLoading={false} />
        </div>
      </div>
    );
  }

  // Views 2-5: ACTIVE (top-pinned query bar, citation listing, streaming answer output)
  return (
    <div className="w-full min-h-screen py-8 px-4 md:px-8 max-w-4xl mx-auto flex flex-col gap-8">
      {/* SearchBar pinned to top for active sessions */}
      <div className="sticky top-0 bg-background/85 backdrop-blur-md pt-2 pb-4 z-20 border-b border-border/10">
        <SearchBar
          onSearch={handleSearchSubmit}
          isLoading={state.status === "loading" || state.status === "streaming"}
          placeholder="Ask a follow-up..."
        />
      </div>

      {/* Primary Display Block */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* View 2: LOADING state */}
        {state.status === "loading" && (
          <div className="flex flex-col gap-5 py-6 max-w-3xl mx-auto w-full select-none animate-fade-in">
            <div className="flex flex-col gap-3">
              <div className="h-4.5 w-full animate-pulse rounded-lg bg-muted/35" />
              <div className="h-4.5 w-11/12 animate-pulse rounded-lg bg-muted/35" />
              <div className="h-4.5 w-4/5 animate-pulse rounded-lg bg-muted/35" />
            </div>
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm font-medium animate-pulse">
              Searching the web...
            </div>
          </div>
        )}

        {/* View 5: ERROR state */}
        {state.status === "error" && (
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 py-4 animate-fade-in">
            <div className="p-4.5 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm font-medium shadow-sm">
              {state.message}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Please click "New Search" or re-submit a follow-up query to try again.
            </p>
          </div>
        )}

        {/* View 4: COMPLETE (show Source citations above answer) */}
        {state.status === "complete" && (
          <div className="max-w-3xl mx-auto w-full">
            <SourceCards sources={state.sources} />
          </div>
        )}

        {/* Views 3 & 4: STREAMING or COMPLETE text output */}
        {(state.status === "streaming" || state.status === "complete") && (
          <AnswerStream
            answer={state.answer}
            isStreaming={state.status === "streaming"}
          />
        )}
      </div>
    </div>
  );
}
