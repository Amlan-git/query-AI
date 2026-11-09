type Event = {
  event: "search_client" | "search_server";
  requestId: string;
  operation: "new" | "follow_up" | "history";
  outcome: "complete" | "degraded" | "failed" | "cancelled" | "rejected";
  firstTextMs: number | null;
  durationMs: number;
  userSaved?: boolean;
  assistantSaved?: boolean;
  issues?: string[];
};

function decode(line: string): Event | null {
  try {
    const log = JSON.parse(line);
    const entry = typeof log?.message === "string" ? JSON.parse(log.message) : log;
    if (
      !["search_client", "search_server"].includes(entry?.event) ||
      !["new", "follow_up", "history"].includes(entry.operation) ||
      !["complete", "degraded", "failed", "cancelled", "rejected"].includes(entry.outcome) ||
      typeof entry.requestId !== "string" ||
      !Number.isFinite(entry.durationMs) ||
      (entry.firstTextMs !== null && !Number.isFinite(entry.firstTextMs))
    ) return null;
    return entry;
  } catch {
    return null;
  }
}

function percentiles(values: number[]) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  return {
    samples: values.length,
    p50: values[Math.ceil(values.length * 0.5) - 1],
    p95: values[Math.ceil(values.length * 0.95) - 1],
  };
}

const groups = new Map<string, Map<string, Event>>();
for await (const line of console) {
  const event = decode(line);
  if (!event) continue;
  const group = `${event.event}.${event.operation}`;
  if (!groups.has(group)) groups.set(group, new Map());
  groups.get(group)!.set(event.requestId, event);
}

const report = Object.fromEntries([...groups].map(([group, events]) => {
  const outcomes = { complete: 0, degraded: 0, failed: 0, cancelled: 0, rejected: 0 };
  const issues: Record<string, number> = Object.create(null);
  const firstText: number[] = [];
  const duration: number[] = [];
  let savedTurns = 0;
  for (const event of events.values()) {
    outcomes[event.outcome]++;
    if (event.outcome === "complete") {
      duration.push(event.durationMs);
      if (event.firstTextMs !== null) firstText.push(event.firstTextMs);
    }
    if (event.userSaved && event.assistantSaved) savedTurns++;
    if (Array.isArray(event.issues)) {
      for (const issue of event.issues) issues[issue] = (issues[issue] ?? 0) + 1;
    }
  }
  const attempted = outcomes.complete + outcomes.degraded + outcomes.failed;
  return [group, {
    outcomes,
    completionRate: attempted ? outcomes.complete / attempted : null,
    firstTextMs: percentiles(firstText),
    completionMs: percentiles(duration),
    ...(group.startsWith("search_server.") ? { savedTurns, issues } : {}),
  }];
}));

console.log(JSON.stringify(report, null, 2));
