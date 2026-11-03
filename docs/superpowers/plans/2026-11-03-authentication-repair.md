# Authentication repair implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Correct the confirmed authentication error paths and prepare a checkable deployment repair.

**Architecture:** Keep Supabase authentication and Express routes. Extract frontend authentication decisions into testable functions, preserving non-fatal profile synchronization. Distinguish service outages from rejected credentials.

**Tech Stack:** TypeScript, React, Supabase JS, Express, Bun tests.

**Spec:** Workspace AUTHENTICATION_FINDINGS.md.

## Constraints and review focus

- Do not print credentials or storage values.
- Do not replace a failed new OAuth login with an unrelated old identity.
- Keep true invalid-token responses at 401 and transient failures at 503.
- Preserve the original non-fatal profile synchronization behavior.
- Production recovery requires checking the actual functions and Supabase project; local tests alone cannot establish it.

## Tasks

- [x] Test and correct OAuth callback ordering, failed exchanges, provider-denial callbacks and missing-code recovery in a frontend auth-flow helper; wire AuthCallback to it and remove storage diagnostics.
- [x] Test and correct protected-route outage decisions; show retryable errors and guard against late state updates.
- [x] Test and correct sign-in/sign-up API outage classification using the same semantics as protected requests.
- [x] Add a read-only deployment probe that verifies JSON API responses and public auth health without exposing keys.
- [x] Run tests, type checks, production build and code review. Record outstanding deployment access or configuration work.

## Verification and release handoff

- Frontend and API regression tests exposed the original failures; all 19 tests now pass. Both TypeScript checks and the frontend production build pass.
- Review found a one-time-code replay window on reload/Back. The callback now removes the redeemed code before profile synchronization and replaces its history entry when opening search.
- Run `bun scripts/check-deployment.ts https://query-ai-search.vercel.app` after a deployment. On the current site, sign-in/sign-up/search return 405, health/history return HTML, and the configured Supabase service cannot be reached.
- Confirm the intended Vercel project/domain and the status of the referenced Supabase project before deploying. The connected Vercel scope did not return the production project, and Supabase is not connected. No changes were published.
