# Search reliability baseline

Search and follow-up requests produce one structured `search_server` event on
response finish or disconnect. It records first non-whitespace model text,
total time, outcome, stage issues, and whether both message writes succeeded.
Recovered model attempts with no text delivered can still complete normally.
A fallback answer, partial model attempt, failed write, or failed suggestion
generation is degraded. Validation and ownership rejections are separate.
Requests rejected before the search handler, such as authentication or rate
limit failures, are outside this server event population.

Authenticated browsers report a best-effort `search_client` event for new
searches, follow-ups, and history loads. Search timing begins at submission.
First text measures the first decoded non-whitespace answer available for
rendering. History measures loading the saved conversation. Search and server
events share a random request ID. A history load has its own ID. Reset,
replacement, and unmount cancel an active browser search. Browser events may
be lost on navigation, network failure, or token expiry, so client and server
counts use separate denominators.

The event payloads omit prompts, answers, source URLs, conversation IDs,
account identifiers, and credentials. The collector requires authentication
and validates a small fixed set of fields. Acknowledged database writes and
successful history loads are separate signals.

## Verify after deploy

1. Run **Production auth check** in GitHub Actions. It includes an anonymous
   request that must be rejected by the new collector.
2. While signed in, run a new search, ask a follow-up, then reload its saved
   conversation. Confirm both answers return. Check that each search produces
   matching client and server records and that history produces a client record.
3. From an authenticated Vercel CLI, collect and summarize a production window.

```sh
set -o pipefail
vercel logs --project query-ai-7ntx --scope amlans-projects-22787d40 \
  --environment production --no-branch --since 1h --limit 500 --json |
  bun scripts/summarize-search.ts
```

The summary separates browser and server outcomes by operation. It reports
completion rate excluding cancellations and rejections, p50/p95 for completed
requests, acknowledged message writes, and issue counts by server stage. Treat
small samples as a smoke test. A meaningful baseline needs enough real requests
and a window within the project's log retention. The CLI limit caps the sample.

Server summaries include retrieval duration, time from the first model attempt
to the first model text (including any retries), and the assistant write
duration. Percentiles use completed requests with the relevant timing field,
so older logs and stages without a measurement do not add zeroes.
