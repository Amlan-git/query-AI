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
    JSON.stringify({ ...completed, requestId: "two", outcome: "failed", durationMs: 100 }),
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
