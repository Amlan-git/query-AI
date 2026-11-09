import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { startSearchMeasurement } from "@/lib/search-telemetry";

export type Source = {
  url: string;
  title: string;
  snippet?: string;
};

export type SearchTurn = {
  query: string;
  answer: string;
  sources: Source[];
  images: string[];
  followUps: string[];
};

export type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string; questions: string[]; turns: SearchTurn[] }
  | { status: "streaming"; query: string; questions: string[]; turns: SearchTurn[]; answer: string; sources: Source[]; images: string[]; followUps: string[]; conversationId: string }
  | { status: "complete"; query: string; questions: string[]; turns: SearchTurn[]; answer: string; sources: Source[]; images: string[]; followUps: string[]; conversationId: string }
  | { status: "error"; message: string };

async function getResponseErrorMessage(response: Response) {
  const fallback = `Search failed. Please try again. (HTTP ${response.status})`;

  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json();
      if (typeof body?.error === "string" && body.error.trim()) {
        return body.requestId ? `${body.error} (${body.requestId})` : body.error;
      }
    }

    const text = await response.text();
    if (contentType.includes("text/html")) {
      return fallback;
    }

    if (text.trim()) {
      return text.trim();
    }
  } catch (err) {
    console.error("Failed to parse error response:", err);
  }

  return fallback;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const activeSearch = useRef<AbortController | null>(null);
  useEffect(() => () => activeSearch.current?.abort(), []);

  async function search(query: string, conversationId?: string): Promise<void> {
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    const measurement = startSearchMeasurement(conversationId ? "follow_up" : "new");
    let token: string | undefined;
    let outcome: "complete" | "failed" | "cancelled" = "failed";
    const previousTurns =
      conversationId && "turns" in state
        ? state.turns
        : conversationId && "query" in state && state.query
          ? [{
              query: state.query,
              answer: "answer" in state ? state.answer : "",
              sources: "sources" in state ? state.sources : [],
              images: "images" in state ? state.images : [],
              followUps: "followUps" in state ? state.followUps : []
            }]
          : [];
    let turns: SearchTurn[] = [
      ...previousTurns,
      { query, answer: "", sources: [], images: [], followUps: [] }
    ];
    const currentTurnIndex = turns.length - 1;
    const previousQuestions = previousTurns.map((turn) => turn.query).filter(Boolean);
    const questions = [...previousQuestions, query];

    const updateCurrentTurn = (patch: Partial<SearchTurn>) => {
      turns = turns.map((turn, index) =>
        index === currentTurnIndex ? { ...turn, ...patch } : turn
      );
      return turns;
    };

    setState({ status: "loading", query, questions, turns });

    try {
      // 1. Get Supabase session to secure request with JWT token
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
      controller.signal.throwIfAborted();
      if (!session) {
        setState({ status: "error", message: "Not authenticated" });
        return;
      }

      // 2. Open HTTP connection for the raw text stream.
      const endpoint = conversationId ? "/query_ask/follow_up" : "/query_ask";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          ...(measurement.requestId ? { "X-Search-Request-Id": measurement.requestId } : {})
        },
        signal: controller.signal,
        body: JSON.stringify(conversationId ? { query, conversationId } : { query })
      });

      controller.signal.throwIfAborted();
      if (!response.ok || !response.body) {
        const message = await getResponseErrorMessage(response);
        controller.signal.throwIfAborted();
        setState({ status: "error", message });
        return;
      }

      // 3. Initialize SSE Chunk Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resolvedConversationId = conversationId ?? "";
      let fullAnswer = "";
      let parsedSources: Source[] = [];
      let parsedImages: string[] = [];
      let followUps: string[] = [];
      let sawCompletion = false;
      let sawImagesBlock = false;

      while (true) {
        const { done, value } = await reader.read();
        controller.signal.throwIfAborted();
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

        // B. Extract SOURCES block. The backend sends this before answer text
        // so links can render above the generated response.
        const sourcesMatch = buffer.match(/<SOURCES>(.*?)<\/SOURCES>/s);
        if (sourcesMatch && sourcesMatch[1]) {
          try {
            parsedSources = JSON.parse(sourcesMatch[1]);
            buffer = buffer.replace(/<SOURCES>.*?<\/SOURCES>\n?/s, "");
            setState({
              status: "streaming",
              query,
              questions,
              turns: updateCurrentTurn({ sources: parsedSources }),
              answer: fullAnswer,
              sources: parsedSources,
              images: parsedImages,
              followUps,
              conversationId: resolvedConversationId
            });
          } catch (err) {
            console.error("Failed to parse SOURCES stream block:", err);
          }
        }

        // C. Extract images block when the backend includes image search results.
        const imagesMatch = buffer.match(/<IMAGES>(.*?)<\/IMAGES>/s);
        if (imagesMatch && imagesMatch[1]) {
          try {
            parsedImages = JSON.parse(imagesMatch[1]);
            sawImagesBlock = true;
            buffer = buffer.replace(/<IMAGES>.*?<\/IMAGES>\n?/s, "");
            setState({
              status: "streaming",
              query,
              questions,
              turns: updateCurrentTurn({ images: parsedImages }),
              answer: fullAnswer,
              sources: parsedSources,
              images: parsedImages,
              followUps,
              conversationId: resolvedConversationId
            });
          } catch (err) {
            console.error("Failed to parse IMAGES stream block:", err);
          }
        }

        // C. Trap error blocks injected during server disruptions
        const errorMatch = buffer.match(/<STREAM_ERROR>(.*?)<\/STREAM_ERROR>/s);
        if (errorMatch) {
          const requestId = response.headers.get("X-Search-Request-Id");
          setState({
            status: "error",
            message: `Stream interrupted. Please try again.${requestId ? ` (${requestId})` : ""}`,
          });
          await reader.cancel().catch(() => {});
          return;
        }

        // D. Extract follow-up suggestions sent after answer generation completes.
        const followUpsMatch = buffer.match(/<FOLLOW_UPS>(.*?)<\/FOLLOW_UPS>/s);
        if (followUpsMatch && followUpsMatch[1]) {
          try {
            fullAnswer = buffer
              .slice(0, followUpsMatch.index ?? buffer.length)
              .replace(/<META>.*$/s, "")
              .replace(/<SOURCES>.*$/s, "")
              .replace(/<IMAGES>.*$/s, "")
              .trimEnd();
            followUps = JSON.parse(followUpsMatch[1]);
            sawCompletion = Array.isArray(followUps);
            buffer = buffer.replace(/<FOLLOW_UPS>.*?<\/FOLLOW_UPS>\n?/s, "");
            setState({
              status: "streaming",
              query,
              questions,
              turns: updateCurrentTurn({ answer: fullAnswer, followUps }),
              answer: fullAnswer,
              sources: parsedSources,
              images: parsedImages,
              followUps,
              conversationId: resolvedConversationId
            });
          } catch (err) {
            console.error("Failed to parse FOLLOW_UPS stream block:", err);
          }
        }

        // E. Accumulate readable answer text without raw special tags
        const displayBuffer = buffer
          .replace(/<META>.*$/s, "")
          .replace(/<SOURCES>.*$/s, "")
          .replace(/<IMAGES>.*$/s, "")
          .replace(/<FOLLOW_UPS>.*$/s, "")
          .replace(/<STREAM_ERROR>.*$/s, "");

        fullAnswer = displayBuffer.trimEnd();
        if (sawImagesBlock && fullAnswer.trim()) measurement.firstText();
        setState({
          status: "streaming",
          query,
          questions,
          turns: updateCurrentTurn({
            answer: fullAnswer,
            sources: parsedSources,
            images: parsedImages,
            followUps
          }),
          answer: fullAnswer,
          sources: parsedSources,
          images: parsedImages,
          followUps,
          conversationId: resolvedConversationId
        });
      }

      // A clean EOF can still be a truncated stream. Suggestions are sent
      // after the answer and the persistence attempts on both search routes.
      if (!sawCompletion || !fullAnswer.trim() || !resolvedConversationId) {
        const requestId = response.headers.get("X-Search-Request-Id");
        setState({
          status: "error",
          message: `Stream closed unexpectedly.${requestId ? ` (${requestId})` : ""}`,
        });
        return;
      }
      outcome = "complete";
      setState(current => {
        if (current.status === "streaming") {
          return {
            status: "complete",
            query,
            questions: current.questions,
            turns: current.turns,
            answer: current.answer,
            sources: current.sources,
            images: current.images,
            followUps: current.followUps.length > 0 ? current.followUps : followUps,
            conversationId: current.conversationId
          };
        }
        return current;
      });

    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        outcome = "cancelled";
      } else {
        setState({ status: "error", message: "Network connection failed. Please try again." });
      }
    } finally {
      if (activeSearch.current === controller) activeSearch.current = null;
      if (token) measurement.report(token, outcome);
    }
  }

  function reset() {
    activeSearch.current?.abort();
    setState({ status: "idle" });
  }

  function setComplete(
    answer: string,
    sources: Source[],
    convId: string,
    query = "",
    followUps: string[] = [],
    images: string[] = [],
    questions: string[] = [],
    turns: SearchTurn[] = []
  ) {
    const resolvedTurns = turns.length > 0
      ? turns
      : query
        ? [{ query, answer, sources, images, followUps }]
        : [];

    setState({
      status: "complete",
      query,
      questions: questions.length > 0 ? questions : resolvedTurns.map((turn) => turn.query).filter(Boolean),
      turns: resolvedTurns,
      answer,
      sources,
      images,
      followUps,
      conversationId: convId
    });
  }

  return { state, search, reset, setComplete };
}
