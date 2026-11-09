import { EventEmitter } from "node:events";
import { expect, test } from "bun:test";
import type { Request, Response } from "express";
import { trackSearch, searchClientEvent } from "../search/telemetry";

const requestId = "dbf9e48a-6f87-4d72-b84d-01c1d6932752";

function fixture(operation: "new" | "follow_up") {
    let now = 100;
    const events: unknown[] = [];
    const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        setHeader: () => {},
    });
    const req = { get: () => requestId } as unknown as Request;
    const trace = trackSearch(req, res as unknown as Response, operation, event => events.push(event), () => now);
    return { trace, res, events, advance: (ms: number) => { now += ms; } };
}

test("records first answer once and acknowledges both writes on completion", () => {
    const { trace, res, events, advance } = fixture("new");
    advance(25);
    trace.firstText();
    advance(30);
    trace.firstText();
    trace.saved("user");
    trace.saved("assistant");
    res.emit("finish");
    res.emit("close");
    expect(events).toEqual([{
        event: "search_server", requestId, operation: "new", status: 200,
        outcome: "complete", firstTextMs: 25, durationMs: 55,
        userSaved: true, assistantSaved: true, issues: [],
    }]);
});

test.each(["initialize", "retrieval", "generation"] as const)("attributes a failed request to %s", stage => {
    const { trace, res, events } = fixture("follow_up");
    trace.fail(stage);
    res.emit("finish");
    expect(events).toEqual([expect.objectContaining({ outcome: "failed", issues: [stage], operation: "follow_up" })]);
});

test.each(["generation", "user_save", "assistant_save", "suggestions"] as const)("records a degraded completion for %s", stage => {
    const { trace, res, events } = fixture("follow_up");
    trace.degrade(stage);
    res.emit("finish");
    expect(events).toEqual([expect.objectContaining({ outcome: "degraded", issues: [stage] })]);
});

test("disconnect emits cancellation once even if a later stage throws", () => {
    const { trace, res, events } = fixture("new");
    res.emit("close");
    trace.fail("retrieval");
    res.emit("finish");
    expect(events).toEqual([expect.objectContaining({ outcome: "cancelled", issues: [] })]);
});

test("rejects client payloads with unbounded values or private fields", () => {
    const event = { requestId, operation: "history", outcome: "complete", firstTextMs: null, durationMs: 42 };
    expect(searchClientEvent.safeParse(event).success).toBe(true);
    expect(searchClientEvent.safeParse({ ...event, query: "private" }).success).toBe(false);
    expect(searchClientEvent.safeParse({ ...event, durationMs: Infinity }).success).toBe(false);
    expect(searchClientEvent.safeParse({ ...event, firstTextMs: 100 }).success).toBe(false);
});
