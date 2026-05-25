import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type Source = {
  url: string;
  title: string;
};

export type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "streaming"; answer: string; conversationId: string }
  | { status: "complete"; answer: string; sources: Source[]; conversationId: string }
  | { status: "error"; message: string };

export function useSearch() {
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function search(query: string, conversationId?: string): Promise<void> {
    setState({ status: "loading" });

    try {
      // 1. Get Supabase session to secure request with JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState({ status: "error", message: "Not authenticated" });
        return;
      }

      // 2. Open HTTP connection for Server-Sent Events (SSE)
      const response = await fetch("/quest_ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ query, conversationId })
      });

      if (!response.ok || !response.body) {
        setState({ status: "error", message: "Search failed. Please try again." });
        return;
      }

      // 3. Initialize SSE Chunk Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resolvedConversationId = conversationId ?? "";
      let fullAnswer = "";
      let reachedSources = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and accumulate in text buffer
        buffer += decoder.decode(value, { stream: true });

        // A. Extract META event (returns active conversationId)
        const metaMatch = buffer.match(/<META>(.*?)<\/META>/s);
        if (metaMatch && metaMatch[1]) {
          try {
            const meta = JSON.parse(metaMatch[1]);
            resolvedConversationId = meta.conversationId;
            buffer = buffer.replace(/<META>.*?<\/META>\n?/s, "");
          } catch (err) {
            console.error("Failed to parse META stream block:", err);
          }
        }

        // B. Extract SOURCES block (signifies end of streaming, lists references)
        const sourcesMatch = buffer.match(/<SOURCES>(.*?)<\/SOURCES>/s);
        if (sourcesMatch && sourcesMatch[1]) {
          try {
            const sources: Source[] = JSON.parse(sourcesMatch[1]);
            setState({
              status: "complete",
              answer: fullAnswer,
              sources,
              conversationId: resolvedConversationId
            });
            buffer = buffer.replace(/<SOURCES>.*?<\/SOURCES>\n?/s, "");
            reachedSources = true;
          } catch (err) {
            console.error("Failed to parse SOURCES stream block:", err);
          }
          break;
        }

        // C. Trap error blocks injected during server disruptions
        const errorMatch = buffer.match(/<STREAM_ERROR>(.*?)<\/STREAM_ERROR>/s);
        if (errorMatch) {
          setState({ status: "error", message: "Stream interrupted. Please try again." });
          break;
        }

        // D. Accumulate readable answer text without raw special tags
        const displayBuffer = buffer
          .replace(/<META>.*$/s, "")
          .replace(/<SOURCES>.*$/s, "")
          .replace(/<STREAM_ERROR>.*$/s, "");

        fullAnswer = displayBuffer;
        setState({
          status: "streaming",
          answer: displayBuffer,
          conversationId: resolvedConversationId
        });
      }

      // E. Fallback error validation if connection closes before sources are fetched
      if (!reachedSources) {
        setState(current => {
          if (current.status === "streaming") {
            return {
              status: "complete",
              answer: current.answer,
              sources: [],
              conversationId: current.conversationId
            };
          }
          if (current.status !== "complete" && current.status !== "error") {
            return { status: "error", message: "Stream closed unexpectedly" };
          }
          return current;
        });
      }

    } catch (error) {
      console.error("Error executing SSE request:", error);
      setState({ status: "error", message: "Network connection failed. Please try again." });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  function setComplete(answer: string, sources: Source[], convId: string) {
    setState({
      status: "complete",
      answer,
      sources,
      conversationId: convId
    });
  }

  return { state, search, reset, setComplete };
}
