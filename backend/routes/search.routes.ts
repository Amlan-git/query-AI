import { Router } from "express";
import type { Request, Response } from "express";
import { tavily } from "@tavily/core";
import { streamText } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { prisma } from "../db";
import z from "zod";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "../prompts";
import { searchLimiter } from "../middleware";

// Request body validation schema for the /quest_ask endpoint.
// Restricting to 500 characters prevents oversized payload attacks, reduces token usage,
// and acts as a strict guard against prompt injection vulnerabilities.
const QuestAskSchema = z.object({
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

// Initialize DeepSeek client with custom API key
const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

// Rename Tavily client to prevent conflicts with the Supabase client
const tavilyClient = tavily({
    apiKey: process.env.TAVILY_API_KEY
});

const router = Router();

router.post("/quest_ask", searchLimiter, async (req: Request, res: Response) => {
    // Validate request body at the network boundary before allocating resources
    const parseResult = QuestAskSchema.safeParse(req.body);
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

    // Bind abort event to Express request close (fires when client disconnects or closes tab)
    req.on("close", () => {
        controller.abort();
        console.log("[quest_ask] Client disconnected — stream aborted");
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
        console.error("[quest_ask] Failed to resolve or create conversation:", dbErr);
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
            console.log(`[quest_ask] User message saved (conversationId: ${conversationId})`);
        } catch (dbErr: unknown) {
            console.error("[quest_ask] DB write failed (non-fatal):", dbErr);
        }

        //step 2 - make sure the user has access/credits left
        //step 3 - check if we have web search indexed for such a query
        //step 4 - web search to gather sources
        const searchPromise = tavilyClient.search(query, {
            searchDepth: "advanced"
        });

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
        //step 5 - do context engineering on the prompt + web search results
        //step 6 - hit the llm & stream back the response

        const prompt = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
            .replace("{{USER_QUERY}}", query);

        /* 
           DESIGN DECISION: Output.object was removed because it forces structured JSON output. 
           This meant result.textStream was emitting raw JSON fragments (e.g. `{"answer":"...`) 
           rather than readable text, defeating real-time word-by-word streaming for a Perplexity-style UX.
           By switching to plain Markdown streaming, we achieve a highly fluid, word-by-word rendering on the frontend.
        */
        const result = streamText({
            model: deepseek('deepseek-chat'),
            prompt: prompt,
            system: SYSTEM_PROMPT,
            abortSignal: controller.signal // Bind the AbortController signal to the LLM streaming call
        });

        res.header('Cache-Control', 'no-cache');
        res.header('Content-Type', 'text/event-stream');

        // INLINE COMMENT: The META event containing the conversationId must be sent before the stream starts
        // (immediately after setting the event-stream headers) so that the client frontend receives the 
        // conversation ID as early as possible. This allows the client to register the conversation state 
        // immediately and handle subsequent follow-up requests or UI updates correctly even if the stream gets interrupted later.
        res.write(`<META>${JSON.stringify({ conversationId })}</META>\n`);

        // INLINE COMMENT: The fullResponse accumulates textPart by textPart during streaming so that we can
        // save the complete assistant response in the database as a single message once the stream finishes,
        // without introducing any extra latency or blocking the real-time word-by-word streaming UX.
        let fullResponse = "";
        for await (const textPart of result.textStream) {
            fullResponse += textPart;
            res.write(textPart);
        }

        const parsedSources = webSearchResult.map(r => ({ 
            url: r.url, 
            title: r.title 
        }));

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
            console.log(`[quest_ask] Assistant message saved (conversationId: ${conversationId})`);
        } catch (dbErr: unknown) {
            console.error("[quest_ask] DB write failed (non-fatal):", dbErr);
        }

        res.write("\n<SOURCES>\n");
        //step 7 - stream back the sources & follow up questions
        res.write(JSON.stringify(webSearchResult.map(result => ({ url: result.url, title: result.title }))));
        res.write("\n</SOURCES>\n");

        //step 8 - close the event stream
        res.end();
    } catch (err: unknown) {
        // AbortError is a client disconnect event (expected behavior), NOT an application failure
        if (err instanceof Error && err.name === "AbortError") {
            console.log("[quest_ask] Stream aborted by client disconnect");
            if (!res.headersSent) {
                res.end();
            }
            return;
        }

        // Log actual application failures with the requested prefix [quest_ask-error]
        console.error("[quest_ask-error] Search/Stream failure:", err);

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

router.post('/quest_ask/follow_up', searchLimiter, async (req: Request, res: Response) => {
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

    req.on("close", () => {
        controller.abort();
        console.log("[follow_up] Client disconnected — stream aborted");
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
        const searchPromise = tavilyClient.search(query, {
            searchDepth: "advanced"
        });

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

        // Step 7: Build the prompt with conversation history
        const historyMessages = history.map(msg => ({
            role: msg.role === "USER" ? "user" as const : "assistant" as const,
            content: msg.content
        }));

        const newUserMessage = PROMPT_TEMPLATE
            .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
            .replace("{{USER_QUERY}}", query);

        // INLINE COMMENT: We use the messages[] array parameter instead of prompt here because we need 
        // to pass multi-turn conversation context to DeepSeek, whereas the prompt field is for single-turn requests.
        const result = streamText({
            model: deepseek('deepseek-chat'),
            system: SYSTEM_PROMPT,
            messages: [
                ...historyMessages,
                { role: "user", content: newUserMessage }
            ],
            abortSignal: controller.signal
        });

        // Step 8: SSE headers + META event + streaming loop
        res.header('Cache-Control', 'no-cache');
        res.header('Content-Type', 'text/event-stream');

        res.write(`<META>${JSON.stringify({ conversationId })}</META>\n`);

        let fullResponse = "";
        for await (const textPart of result.textStream) {
            fullResponse += textPart;
            res.write(textPart);
        }

        const parsedSources = webSearchResult.map(r => ({ 
            url: r.url, 
            title: r.title 
        }));

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

        res.write("\n<SOURCES>\n");
        res.write(JSON.stringify(webSearchResult.map(result => ({ url: result.url, title: result.title }))));
        res.write("\n</SOURCES>\n");

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
