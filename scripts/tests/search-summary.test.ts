import { expect, test } from "bun:test";

test("summarizes completed latency separately from failures and deduplicates events", () => {
  const completed = {
    event: "search_client", requestId: "one", operation: "new",
    outcome: "complete", firstTextMs: 23, durationMs: 40,
  };
  const records = [
    "unrelated log line",
    JSON.stringify(completed),
    JSON.stringify({ message: JSON.stringify(completed) }),
    JSON.stringify({
      message: "request wrapper",
      logs: [
        { message: JSON.stringify(completed) },
        { message: JSON.stringify({ ...completed, requestId: "two", outcome: "failed", durationMs: 100 }) },
      ],
    }),
    JSON.stringify({ ...completed, requestId: "three", outcome: "cancelled" }),
  ];
  const result = Bun.spawnSync([process.execPath, new URL("../summarize-search.ts", import.meta.url).pathname], {
    stdin: Buffer.from(records.join("\n")),
  });

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout.toString());
  expect(report["search_client.new"]).toEqual({
    outcomes: { complete: 1, degraded: 0, failed: 1, cancelled: 1, rejected: 0 },
    completionRate: 0.5,
    firstTextMs: { samples: 1, p50: 23, p95: 23 },
    completionMs: { samples: 1, p50: 40, p95: 40 },
  });
});

test("stage percentiles omit old events and incomplete searches", () => {
  const event = {
    event: "search_server", operation: "new", outcome: "complete",
    firstTextMs: 120, durationMs: 200,
  };
  const records = [
    { ...event, requestId: "old" },
    { ...event, requestId: "timed", stages: { retrievalMs: 80, modelFirstTextMs: 30, assistantSaveMs: 10 } },
    { ...event, requestId: "failed", outcome: "failed", stages: { retrievalMs: 1000 } },
  ];
  const result = Bun.spawnSync([process.execPath, new URL("../summarize-search.ts", import.meta.url).pathname], {
    stdin: Buffer.from(records.map(record => JSON.stringify(record)).join("\n")),
  });

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString())["search_server.new"].stages).toEqual({
    retrievalMs: { samples: 1, p50: 80, p95: 80 },
    modelFirstTextMs: { samples: 1, p50: 30, p95: 30 },
    assistantSaveMs: { samples: 1, p50: 10, p95: 10 },
  });
});
