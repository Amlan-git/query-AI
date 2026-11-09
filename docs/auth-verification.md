# Automated authentication checks

Run the callback and deployment configuration tests from the repo root.

```sh
bun test backend/tests frontend/tests scripts/tests
```

Run the production smoke check after a deployment or a Supabase Auth
configuration change.

```sh
bun scripts/check-deployment.ts https://query-ai-search.vercel.app
```

Provide `SUPABASE_ACCESS_TOKEN` through your shell or CI secret store.
Use a Supabase Management API token scoped to the production project with
`auth_config_read`. Keep it out of frontend and application deployment
environment variables. The check uses the [Auth config read endpoint](https://supabase.com/docs/reference/api/v1-get-auth-service-config)
and reports failures without printing the returned config.

The production smoke check exits with an error if the token is missing,
the Site URL differs from the production root, or the redirect allowlist
lacks the exact production `/auth/callback` URL. Preview URLs run only the
public smoke checks. No Google or GitHub account is needed.

To run from GitHub, add `SUPABASE_ACCESS_TOKEN` under the repository's
**Settings → Secrets and variables → Actions**. Once the workflow is on
the default branch, open **Actions → Production auth check → Run workflow**.
Run it after changing production Auth settings or promoting a deployment.
