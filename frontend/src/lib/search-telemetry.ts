type Operation = "new" | "follow_up" | "history";
type Outcome = "complete" | "failed" | "cancelled";

export function startSearchMeasurement(operation: Operation) {
  const requestId = globalThis.crypto?.randomUUID?.();
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let firstTextMs: number | null = null;

  return {
    requestId,
    firstText() { firstTextMs ??= elapsed(); },
    report(token: string, outcome: Outcome) {
      if (!requestId) return;
      void fetch("/query_ask/telemetry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        keepalive: true,
        body: JSON.stringify({ requestId, operation, outcome, firstTextMs, durationMs: elapsed() }),
      }).catch(() => {
        // Telemetry is best effort and must never interrupt search.
      });
    },
  };
}
