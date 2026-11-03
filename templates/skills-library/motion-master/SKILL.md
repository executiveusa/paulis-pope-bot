---
name: motion-master
description: Control the owner's private Motion Master video projects, editable revisions, HyperFrames render jobs, and MP4/source exports through an authenticated API. Use for making and editing motion videos from PopeBot chat/Telegram; never claim a render succeeded before the job is ready.
---

# Motion Master — PopeBot controller

PopeBot is the **conversation/orchestration** layer. Motion Master is the **system of record** for projects, immutable revisions, render jobs and artifacts. Use the existing private Motion Master API; do not duplicate it in PopeBot or modify render files directly.

The script `motion-master.mjs` uses **Node 18+ with no new dependencies**. It never logs secrets or prompts. Its API allowlist prevents arbitrary URLs or shell execution. Do not expose the private Motion Master server to the Internet to make this integration work.

## Before calling

An owner-controlled Motion Master API and HyperFrames worker must already be running. The protected Vercel **static preview is not an API/worker**. On the PopeBot owner host, configure secrets using the PopeBot Admin > Event Handler > Agent Jobs secret store:

- `MOTION_MASTER_API_URL`: exact authenticated **private HTTPS origin** (or local `http://127.0.0.1:<port>` when the API is in the same network namespace as the caller). Do not put a URL path, query, or credentials in it.
- `MOTION_MASTER_API_KEY`: at least 32 characters, matching the existing Motion Master server's bearer secret. Pass via the environment only; never paste it into a chat, CLI argument, source code, or screenshots.

**Docker caveat:** `127.0.0.1` inside a PopeBot agent container refers to that container, not the host. Prefer a private HTTPS origin with restricted routing and a verified TLS certificate. Do not expose an unauthenticated API as a workaround.

### Activate on an installed PopeBot instance

This repository contains the **thepopebot package/template**, not proof of a running owner instance. The skill is shipped under `templates/skills-library/motion-master/` for provisioning, but activation is **opt-in** and remains an owner action:

```sh
# In a real installed PopeBot instance (not this package source):
cp -R /path/to/paulis-pope-bot/templates/skills-library/motion-master skills-library/motion-master
ln -s ../skills-library/motion-master skills/motion-master
node --test skills-library/motion-master/motion-master.test.mjs
```

PopeBot discovers only activated `skills/<name>` symlinks. Existing instance upgrades may add new skills as **inactive**. Confirm the symlink and host networking before claiming integration is live. Never edit managed `docker-compose.yml` or `.env` automatically.

## Commands (project-root paths)

```sh
node skills/motion-master/motion-master.mjs health
node skills/motion-master/motion-master.mjs list
node skills/motion-master/motion-master.mjs blocks lt-neon-border
node skills/motion-master/motion-master.mjs create "ACME launch" "A 15-second brand intro" "ACME" 15
node skills/motion-master/motion-master.mjs open PROJECT_ID
node skills/motion-master/motion-master.mjs render PROJECT_ID
node skills/motion-master/motion-master.mjs job PROJECT_ID JOB_ID
node skills/motion-master/motion-master.mjs wait PROJECT_ID JOB_ID 30
node skills/motion-master/motion-master.mjs edit PROJECT_ID ACME NOVA
node skills/motion-master/motion-master.mjs render PROJECT_ID
node skills/motion-master/motion-master.mjs download PROJECT_ID JOB_ID /owner/artifacts/nova.mp4
node skills/motion-master/motion-master.mjs export PROJECT_ID JOB_ID /owner/artifacts/nova.json.gz
node skills/motion-master/motion-master.mjs import /owner/artifacts/nova.json.gz
node skills/motion-master/motion-master.mjs cancel PROJECT_ID JOB_ID
```

The **create** operation uses Motion Master's existing **verified** `lt-neon-border` lower-third template, not arbitrary generated composition code. A request for a richer, multi-shot 15s film must be specified and proven separately; don't claim that merely changing a template's duration produces a polished 15s cinematic film.

## Operating rules

1. **Inspect before changing.** Use `open` to read the current revision. Do not guess `projectId`, `jobId`, block IDs or variable IDs.
2. **Explicit writes.** Creating a project, changing text, queuing renders, canceling jobs and importing archives require a specific user request. No auto-publish, auto-merge, GitHub write, deployment or sale switch.
3. **Safe revisions.** `edit ID OLD NEW` replaces matching text in brief, titles, and saved shot values, then saves a new immutable revision with the current `expectedRevision`. The previous revision remains. If text is absent or the version changed, fail rather than fabricate success.
4. **Real rendering.** `render` queues a job. `wait` or `job` reads the authoritative worker status. Only `status=ready` plus an actual downloaded MP4 establishes delivery. Report `queued`, `rendering`, `failed` and `cancelled` literally.
5. **Artifacts.** `download` and `export` require explicit local filenames and refuse to overwrite an existing one. Export editable source separately from MP4. Preserve file paths only on owner-controlled storage; never send files to public URLs.
6. **Security.** No credential output. HTTPS or explicit loopback only, no redirects, bounded body/download sizes, strict ID validation. If the secret or private route is unavailable, stop instead of disabling authentication.
7. **No Hunyuan auto-enable.** Optional Hunyuan in Motion Master PR #9 is separate, unmerged unless independently verified; this skill does not install/activate models.
8. **Sale lock.** Keep `licence.json.status.onSale=false`; PopeBot has no sale/deploy endpoints.
9. **Agent containment.** PopeBot coding agent/job workflows may auto-merge *their own* PRs, but this video-controller skill makes no GitHub changes. Disable automatic merges and require owner approval for broader system modifications.

## One verifiable acceptance path

On the actual private host with authenticated owner access:

1. `health` succeeds; `list` responds.
2. `create "ACME launch" "A 15-second brand intro" "ACME" 15` returns actual project and revision 1.
3. `render PROJECT_ID` creates a job. Wait for **ready**, then `download` the first MP4.
4. `edit PROJECT_ID ACME NOVA` creates immutable revision 2. Reopen revision and verify the old still exists server-side.
5. `render PROJECT_ID` queues revised version; wait for **ready**; download revised MP4 and editable source.
6. Re-import source and verify the resulting project in `list` and `open`; check MP4 playback with FFprobe.
7. Request the same actions through PopeBot web chat (or verified Telegram), capture real tool logs **without secrets**, and have a second reviewer validate results.

**Pass requires all stages on a real persistent private host.** Unit tests/mock HTTP do not prove live execution. If no authorized host is configured, status is `BLOCKED — private backend`, not `done`.

## Rollback

Deactivate without deleting source: `rm skills/motion-master` **inside the installed PopeBot instance only**. This does not change Motion Master data. For reverting the feature branch source, revert the feature commits after independent review; do not force-reset shared `main`.
