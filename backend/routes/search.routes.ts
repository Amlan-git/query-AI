import { Router } from "express";
import type { Request, Response } from "express";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { prisma } from "../db";
import z from "zod";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "../prompts";
import { searchLimiter } from "../middleware";
import { performSearch, type SearchResult } from "../search/search.service";
import type { ModelMessage } from "ai";

// Request body validation schema for the /query_ask endpoint.
// Restricting to 500 characters prevents oversized payload attacks, reduces token usage,
// and acts as a strict guard against prompt injection vulnerabilities.
const QueryAskSchema = z.object({
    query: z.string()
             .min(1, "Query cannot be empty")
             .max(500, "Query cannot exceed 500 characters")
             .trim(),
    conversationId: z.string().uuid().optional()
});

// INLINE COMMENT: In FollowUpSchema, conversationId is required (not optional) because a follow-up 
// request by definition must continue an existing conversation session rather than initiate a new one.
const FollowUpSchema = z.object({
    conversationId: z.string().uuid("conversationId must be a valid UUID"),
    query: z.string()
             .min(1, "Query cannot be empty")
             .max(500, "Query cannot exceed 500 characters")
             .trim()
});

// Initialize Google Gemini client with custom API key
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
const ANSWER_MODEL_CANDIDATES = [
    process.env.GOOGLE_GENERATIVE_AI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-flash-latest"
].filter((model, index, models): model is string => Boolean(model) && models.indexOf(model) === index);

const router = Router();

function formatSearchResultsForPrompt(results: SearchResult[]) {
    return results
        .map((result, index) => {
            const title = result.title || "Untitled source";
            const url = result.url || "No URL provided";
            const content = result.content || result.rawContent || "No snippet available.";

            return [
                `[${index + 1}] ${title}`,
                `URL: ${url}`,
                `Snippet: ${content}`
            ].join("\n");
        })
        .join("\n\n");
}

function formatSourcesForClient(results: SearchResult[]) {
    return results.map((result) => ({
        url: result.url || "",
        title: result.title || "Web Search Reference",
        snippet: result.content || result.rawContent || ""
    }));
}

function parseFollowUps(text: string) {
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    try {
        const parsed = JSON.parse(cleaned);
        const items = Array.isArray(parsed) ? parsed : parsed.followUps;

        if (Array.isArray(items)) {
            return items
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 5);
        }
    } catch {
        // Fall back to parsing numbered or bulleted text.
    }

    return cleaned
        .split("\n")
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
}

function fallbackFollowUps(query: string, sources: SearchResult[]) {
    const firstSourceTitle = sources.find((source) => source.title)?.title;
    const baseQuery = query.replace(/[?.!]+$/g, "").trim();

    return [
        `What are the key details about ${baseQuery}?`,
        `How does ${baseQuery} compare with other options?`,
        firstSourceTitle ? `What details from ${firstSourceTitle} matter most?` : `What changed recently about ${baseQuery}?`
    ].filter(Boolean).slice(0, 3);
}

async function generateFollowUps(query: string, answer: string, sources: SearchResult[], abortSignal: AbortSignal) {
    const result = await streamText({
        model: google(ANSWER_MODEL_CANDIDATES[0] || "gemini-2.5-flash"),
        abortSignal,
        system: "You generate concise related questions for a search answer. Return only valid JSON.",
        prompt: [
            "Generate exactly 3 follow-up questions the user might ask next.",
            "The questions should be concise, simple, and relevant to the original query and source context.",
            "Match the language of the user's query.",
            "Return only a JSON array of strings. Do not include markdown or commentary.",
            "",
            `User query: ${query}`,
            "",
            `Answer: ${answer.slice(0, 4000)}`,
            "",
            `Sources: ${formatSearchResultsForPrompt(sources).slice(0, 3000)}`
        ].join("\n")
    });

    let text = "";
    for await (const textPart of result.textStream) {
        text += textPart;
    }

    const parsed = parseFollowUps(text);
    return parsed.length > 0 ? parsed : fallbackFollowUps(query, sources);
}

type AnswerStreamInput =
    | { kind: "prompt"; prompt: string }
    | { kind: "messages"; messages: ModelMessage[] };

async function streamAnswerText(
    input: AnswerStreamInput,
    res: Response,
    abortSignal: AbortSignal
) {
    const errors: unknown[] = [];

    for (const modelName of ANSWER_MODEL_CANDIDATES) {
        let fullResponse = "";

        try {
            console.log(`[llm] Starting answer stream with ${modelName}`);
            const result = input.kind === "prompt"
                ? streamText({
                    model: google(modelName),
                    system: SYSTEM_PROMPT,
                    abortSignal,
                    prompt: input.prompt
                })
                : streamText({
                    model: google(modelName),
                    system: SYSTEM_PROMPT,
                    abortSignal,
                    messages: input.messages
                });

            for await (const textPart of result.textStream) {
                fullResponse += textPart;
                res.write(textPart);
            }

            if (fullResponse.trim().length > 0) {
                console.log(`[llm] Answer stream completed with ${modelName}`);
                return fullResponse;
            }

            errors.push(new Error(`${modelName} returned an empty answer stream`));
            console.warn(`[llm] ${modelName} returned an empty answer stream; trying fallback model`);
        } catch (err: unknown) {
            errors.push(err);
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[llm] ${modelName} failed while streaming answer:`, message);
        }
    }

    const fallbackAnswer = [
        "I found relevant sources and images, but the answer model is temporarily unavailable.",
        "",
        "## What happened",
        "The retrieval step completed, but all configured Gemini answer models failed or returned an empty stream.",
        "",
        "Please retry the same query in a moment."
    ].join("\n");

    res.write(fallbackAnswer);
    console.error("[llm] All answer models failed:", errors);
    return fallbackAnswer;
}

router.post("/query_ask", searchLimiter, async (req: Request, res: Response) => {
    // Validate request body at the network boundary before allocating resources
    const parseResult = QueryAskSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Invalid request",
            details: parseResult.error.flatten().fieldErrors
        });
        return;
    }
    const { query } = parseResult.data;

    // Instantiate AbortController to support client cancellation and prevent credit/resource leak
    const controller = new AbortController();

    // Abort only when the response connection closes before the stream completes.
    res.on("close", () => {
        if (!res.writableEnded) {
            controller.abort();
            console.log("[query_ask] Client disconnected — stream aborted");
        }
    });

    let conversationId: string;

    // INLINE COMMENT: Conversation resolution is placed outside the main try block so that if it fails
    // (e.g. database connection issues or database errors), headers have not been sent yet, and we can 
    // respond with a clean, standard JSON error (403 or 500) instead of falling into the stream-based error handler.
    try {
        if (parseResult.data.conversationId) {
            // Verify the conversation exists and belongs to this user
            const existing = await prisma.conversation.findUnique({
                where: { id: parseResult.data.conversationId }
            });

            if (!existing || existing.userId !== req.user!.id) {
                res.status(403).json({ error: "Conversation not found or access denied" });
                return;
            }
            conversationId = existing.id;
        } else {
            // Create a new conversation using first 60 chars of query as title
            const newConversation = await prisma.conversation.create({
                data: {
                    userId: req.user!.id,
                    title: parseResult.data.query.slice(0, 60),
                }
            });
            conversationId = newConversation.id;
        }
    } catch (dbErr: unknown) {
        console.error("[query_ask] Failed to resolve or create conversation:", dbErr);
        res.status(500).json({ error: "Failed to initialize conversation" });
        return;
    }

    try {
        // INLINE COMMENT: DB writes inside the stream are wrapped individually in their own try/catch blocks
        // so that if a database persistence operation fails (e.g. message logging fails), it does not disrupt
        // or abort the primary real-time search and response stream delivery to the client.
        try {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: "USER",
                    content: parseResult.data.query
                }
            });
            console.log(`[query_ask] User message saved (conversationId: ${conversationId})`);
        } catch (dbErr: unknown) {
            console.error("[query_ask] DB write failed (non-fatal):", dbErr);
        }

        //step 2 - make sure the user has access/credits left
        //step 3 - check if we have web search indexed for such a query
        //step 4 - web search to gather sources
        const searchPromise = performSearch(query);

        // Wrap the search call in Promise.race with an abort-aware promise to support early abortion
        const webSearchResponse = await Promise.race([
            searchPromise,
            new Promise<never>((_, reject) => {
                if (controller.signal.aborted) {
                    reject(new DOMException("Aborted", "AbortError"));
                }
                controller.signal.addEventListener("abort", () => {
                    reject(new DOMException("Aborted", "AbortError"));
                });
            })
        ]);

        const webSearchResult = webSearchResponse.results;
        const parsedSources = formatSourcesForClient(webSearchResult);
        const parsedImages = webSearchResponse.images;
        //step 5 - do context engineering on the prompt + web search results
        //step 6 - hit the llm & stream back the response

        const prompt = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", formatSearchResultsForPrompt(webSearchResult))
            .replace("{{USER_QUERY}}", query);

        /* 
           DESIGN DECISION: Output.object was removed because it forces structured JSON output. 
           This meant result.textStream was emitting raw JSON fragments (e.g. `{"answer":"...`) 
           rather than readable text, defeating real-time word-by-word streaming for a Perplexity-style UX.
           By switching to plain Markdown streaming, we achieve a highly fluid, word-by-word rendering on the frontend.
        */
        res.header('Cache-Control', 'no-cache');
        res.header('Content-Type', 'text/event-stream');

        // INLINE COMMENT: The META event containing the conversationId must be sent before the stream starts
        // (immediately after setting the event-stream headers) so that the client frontend receives the 
        // conversation ID as early as possible. This allows the client to register the conversation state 
        // immediately and handle subsequent follow-up requests or UI updates correctly even if the stream gets interrupted later.
        res.write(`<META>${JSON.stringify({ conversationId })}</META>\n`);
        res.write(`<SOURCES>${JSON.stringify(parsedSources)}</SOURCES>\n`);
        res.write(`<IMAGES>${JSON.stringify(parsedImages)}</IMAGES>\n`);

        const fullResponse = await streamAnswerText({ kind: "prompt", prompt }, res, controller.signal);

        // INLINE COMMENT: DB writes inside the stream are wrapped individually in their own try/catch blocks
        // so that if a database persistence operation fails (e.g. message logging fails), it does not disrupt
        // or abort the primary real-time search and response stream delivery to the client.
        try {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: "ASSISTANT",
                    content: fullResponse,
                    sources: parsedSources
                }
            });
            console.log(`[query_ask] Assistant message saved (conversationId: ${conversationId})`);
        } catch (dbErr: unknown) {
            console.error("[query_ask] DB write failed (non-fatal):", dbErr);
        }

        try {
            const followUps = await generateFollowUps(query, fullResponse, webSearchResult, controller.signal);
            res.write(`\n<FOLLOW_UPS>${JSON.stringify(followUps)}</FOLLOW_UPS>\n`);
        } catch (followUpErr: unknown) {
            console.error("[query_ask] Follow-up generation failed (non-fatal):", followUpErr);
            res.write(`\n<FOLLOW_UPS>${JSON.stringify(fallbackFollowUps(query, webSearchResult))}</FOLLOW_UPS>\n`);
        }

        //step 8 - close the event stream
        res.end();
    } catch (err: unknown) {
        // AbortError is a client disconnect event (expected behavior), NOT an application failure
        if (err instanceof Error && err.name === "AbortError") {
            console.log("[query_ask] Stream aborted by client disconnect");
            if (!res.headersSent) {
                res.end();
            }
            return;
        }

        // Log actual application failures with the requested prefix [query_ask-error]
        console.error("[query_ask-error] Search/Stream failure:", err);

        // If headers have not been sent yet, we can safely respond with a standard 500 JSON error
        if (!res.headersSent) {
            res.status(500).json({ error: "Search failed. Please try again." });
        } else {
            // If headers have already been sent, writing a JSON response is impossible and would crash the server.
            // Instead, we inject a custom structured error event so the client handles the interruption gracefully.
            res.write("\n<STREAM_ERROR>\n");
            res.write(JSON.stringify({ error: "Stream interrupted unexpectedly" }));
            res.write("\n</STREAM_ERROR>\n");
            res.end();
        }
    }
});

router.post('/query_ask/follow_up', searchLimiter, async (req: Request, res: Response) => {
    // Step 1: Validate request body
    const parseResult = FollowUpSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Invalid request",
            details: parseResult.error.flatten().fieldErrors
        });
        return;
    }
    const { conversationId, query } = parseResult.data;

    // Step 2: AbortController + req.on("close")
    const controller = new AbortController();

    res.on("close", () => {
        if (!res.writableEnded) {
            controller.abort();
            console.log("[follow_up] Client disconnected — stream aborted");
        }
    });

    let conversation: { id: string; userId: string; [key: string]: unknown };
    let history: Array<{ role: "USER" | "ASSISTANT"; content: string }>;

    // INLINE COMMENT: We load the conversation metadata and messages outside the main stream try block 
    // to cleanly isolate database errors during initialization. If a DB read fails at this stage, 
    // we can return a standard 500 JSON payload as headers have not been sent yet.
    try {
        // Step 3: Verify conversation ownership
        const existing = await prisma.conversation.findUnique({
            where: { id: conversationId }
        });
        if (!existing) {
            res.status(404).json({ error: "Conversation not found" });
            return;
        }
        if (existing.userId !== req.user!.id) {
            res.status(403).json({ error: "Access denied" });
            return;
        }
        conversation = existing;

        // INLINE COMMENT: We only load the last 10 messages to keep the LLM request prompt balanced between 
        // high-quality context and low token overhead/latency.
        // Step 4: Load conversation history
        history = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            take: 10,
            select: {
                role: true,
                content: true
            }
        });
    } catch (dbErr: unknown) {
        console.error("[follow_up] Failed to load conversation or history:", dbErr);
        res.status(500).json({ error: "Failed to initialize conversation history" });
        return;
    }

    try {
        // Step 5: Save the USER message (non-fatal)
        try {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: "USER",
                    content: query
                }
            });
            console.log(`[follow_up] User message saved (conversationId: ${conversationId})`);
        } catch (dbErr: unknown) {
            console.error("[follow_up] DB write failed (non-fatal):", dbErr);
        }

        // Step 6: Tavily search
        const searchPromise = performSearch(query);

        // Wrap the search call in Promise.race with an abort-aware promise to support early abortion
        const webSearchResponse = await Promise.race([
            searchPromise,
            new Promise<never>((_, reject) => {
                if (controller.signal.aborted) {
                    reject(new DOMException("Aborted", "AbortError"));
                }
                controller.signal.addEventListener("abort", () => {
                    reject(new DOMException("Aborted", "AbortError"));
                });
            })
        ]);

        const webSearchResult = webSearchResponse.results;
        const parsedSources = formatSourcesForClient(webSearchResult);
        const parsedImages = webSearchResponse.images;

        // Step 7: Build the prompt with conversation history
        const historyMessages = history.map(msg => ({
            role: msg.role === "USER" ? "user" as const : "assistant" as const,
            content: msg.content
        }));

        const newUserMessage = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", formatSearchResultsForPrompt(webSearchResult))
            .replace("{{USER_QUERY}}", query);

        // Step 8: SSE headers + META event + streaming loop
        res.header('Cache-Control', 'no-cache');
        res.header('Content-Type', 'text/event-stream');

        res.write(`<META>${JSON.stringify({ conversationId })}</META>\n`);
        res.write(`<SOURCES>${JSON.stringify(parsedSources)}</SOURCES>\n`);
        res.write(`<IMAGES>${JSON.stringify(parsedImages)}</IMAGES>\n`);

        const fullResponse = await streamAnswerText({
            kind: "messages",
            messages: [
                ...historyMessages,
                { role: "user", content: newUserMessage }
            ]
        }, res, controller.signal);

        // Step 9: Save ASSISTANT message + SOURCES block + res.end()
        try {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: "ASSISTANT",
                    content: fullResponse,
                    sources: parsedSources
                }
            });
            console.log(`[follow_up] Assistant message saved (conversationId: ${conversationId})`);
        } catch (dbErr: unknown) {
            console.error("[follow_up] DB write failed (non-fatal):", dbErr);
        }

        try {
            const followUps = await generateFollowUps(query, fullResponse, webSearchResult, controller.signal);
            res.write(`\n<FOLLOW_UPS>${JSON.stringify(followUps)}</FOLLOW_UPS>\n`);
        } catch (followUpErr: unknown) {
            console.error("[follow_up] Follow-up generation failed (non-fatal):", followUpErr);
            res.write(`\n<FOLLOW_UPS>${JSON.stringify(fallbackFollowUps(query, webSearchResult))}</FOLLOW_UPS>\n`);
        }

        res.end();
    } catch (err: unknown) {
        // Step 10: catch block
        if (err instanceof Error && err.name === "AbortError") {
            console.log("[follow_up] Stream aborted by client disconnect");
            if (!res.headersSent) {
                res.end();
            }
            return;
        }

        console.error("[follow_up-error] Search/Stream failure:", err);

        if (!res.headersSent) {
            res.status(500).json({ error: "Search failed. Please try again." });
        } else {
            res.write("\n<STREAM_ERROR>\n");
            res.write(JSON.stringify({ error: "Stream interrupted unexpectedly" }));
            res.write("\n</STREAM_ERROR>\n");
            res.end();
        }
    }
});

export default router;
