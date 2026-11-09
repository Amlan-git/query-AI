# Legacy hostname redirect

This standalone Vercel deployment serves `queryaisearch.vercel.app` on the
`querysearch-app` project. It sends GET and HEAD requests to
`query-ai-search.vercel.app` with HTTP 307 and preserves the path and query.
Stale OAuth callbacks restart at `/auth` without their query parameters.
Other methods receive HTTP 405.

Stage from the repo root without assigning the live domains.

```sh
vercel deploy --cwd deploy/legacy-redirect --project prj_lY63YsFU8C4qX59pPb0rHoTayY3q --scope amlans-projects-22787d40 --prod --skip-domain --yes
```

Record the current production deployment ID before promoting. Use authenticated
`vercel curl` against the staged deployment to check the homepage, a conversation
path with a query, both stale callback forms, and a POST request. Promote the
tested deployment ID with `vercel promote`, then run **Production auth check**
in GitHub Actions to verify the public hostname.

If public checks fail after promotion, run `vercel rollback <previous-deployment-id>
--scope amlans-projects-22787d40` and verify the legacy hostname points to the
recorded deployment. The deployment before the original redirect cutover was
`dpl_3ZqeyrKp5CRZxKzk9VwDVYCiBTty`.
