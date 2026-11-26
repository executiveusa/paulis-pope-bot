# TELAR private assistant

Status: source integration only; do not claim live until verified. No changes to the existing Pope Bot chat or job execution path.

- Source: executiveusa/telar commit ce67281167484cca8f34a17900b278d6e7a86355 (independently written preview).
- Authenticated UI: GET /telar; model endpoint POST /api/telar. Both require an existing admin session and TELAR_PRIVATE_ENABLED=true. POST additionally checks exact TELAR_PRIVATE_ORIGIN and bounds requests and model output. No cross-origin access, no arbitrary shell, repository writes, background jobs, generation or credential endpoints.
- Reuses configured helper LLM (LLM_PROVIDER, LLM_MODEL and existing provider settings). Credentials remain server-side. It does not use the full coding-agent chatStream because that may inject secrets and auto-run Git operations.

## Install only on the verified existing Pope Bot runtime
1. Identify the running service, source revision, deployment method, configured HTTPS origin, DB and backup. Do not create another service. Take a reversible backup. Do not print secrets.
2. Review this branch. Run node --test lib/telar/contract.test.js and syntax checks. Build a private package/image using this fork's source, not the public npm package. Existing docker/event-handler/Dockerfile installs the public thepopebot npm version; it will NOT automatically include these custom exports. Adapt the build in an isolated staging environment and verify npm package includes lib/telar and the Next app includes both routes. Do not publish an npm package or replace production before this is verified.
3. Configure TELAR_PRIVATE_ORIGIN to the actual existing HTTPS origin (not a Vercel URL); set TELAR_PRIVATE_ENABLED=true only for the test instance. Use existing model configuration; never copy provider tokens to TELAR or the browser.
4. Verify unauthenticated and non-admin requests fail; wrong origin POST fails; valid admin requests with malformed body fail; valid Spanish request returns bounded JSON. Open /telar in same authenticated browser, ask for a brief, confirm adding it to the canvas. Reload and verify persistence. Verify no unexpected Git/Docker jobs or paid media operations.
5. Promote only after review. Vercel preview stays separate and local-only; link to verified private /telar URL after runtime is confirmed. Do not disable Vercel protection.

Rollback: disable TELAR_PRIVATE_ENABLED, then restore previous tested package/image. No database migrations. Existing browser-local projects can be exported before switching origins.

Limitations: model calls can incur existing provider charges; 850 output token cap, one request at a time per process and cooldown, not a distributed quota. Current scope is local canvas notes, brief, storyboard and conversation; no live Jaaz, MCP or media generation. 
