import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import z from "zod";

const requestIdSchema = z.uuid();
const duration = z.number().int().min(0).max(15 * 60 * 1000);

export const searchClientEvent = z.strictObject({
    requestId: requestIdSchema,
    operation: z.enum(["new", "follow_up", "history"]),
    outcome: z.enum(["complete", "failed", "cancelled"]),
    firstTextMs: duration.nullable(),
    durationMs: duration,
}).refine(event => event.firstTextMs === null ||
    (event.operation !== "history" && event.firstTextMs <= event.durationMs));

type Stage = "initialize" | "retrieval" | "generation" | "user_save" | "assistant_save" | "suggestions";

export function logSearchEvent(event: object) {
    console.log(JSON.stringify(event));
}

export function trackSearch(
    req: Request,
    res: Response,
    operation: "new" | "follow_up",
    emit = logSearchEvent,
    now = () => performance.now(),
) {
    const started = now();
    const candidate = requestIdSchema.safeParse(req.get("x-search-request-id"));
    const requestId = candidate.success ? candidate.data : randomUUID();
    const issues = new Set<Stage>();
    const stages: Partial<Record<"retrievalMs" | "modelFirstTextMs" | "assistantSaveMs", number>> = {};
    let modelStartedAt: number | undefined;
    let firstTextMs: number | null = null;
    let userSaved = false;
    let assistantSaved = false;
    let failed = false;
    let reported = false;

    res.setHeader("X-Search-Request-Id", requestId);

    function report(cancelled: boolean) {
        if (reported) return;
        reported = true;
        const status = res.statusCode;
        const outcome = cancelled ? "cancelled"
            : failed || status >= 500 ? "failed"
            : status >= 400 ? "rejected"
            : issues.size ? "degraded"
            : "complete";

        emit({
            event: "search_server", requestId, operation, status, outcome,
            firstTextMs, durationMs: Math.round(now() - started),
            userSaved, assistantSaved, issues: [...issues], stages,
        });
    }

    res.once("finish", () => report(false));
    res.once("close", () => report(!res.writableFinished));

    return {
        requestId,
        time(stage: "retrievalMs" | "assistantSaveMs") {
            const start = now();
            return () => { stages[stage] = Math.round(now() - start); };
        },
        modelStarted() { modelStartedAt ??= now(); },
        firstText() {
            if (firstTextMs !== null) return;
            const first = now();
            firstTextMs = Math.round(first - started);
            if (modelStartedAt !== undefined) stages.modelFirstTextMs = Math.round(first - modelStartedAt);
        },
        saved(role: "user" | "assistant") {
            if (role === "user") userSaved = true;
            else assistantSaved = true;
        },
        degrade(stage: Stage) { issues.add(stage); },
        fail(stage: Stage) {
            failed = true;
            issues.add(stage);
        },
    };
}
