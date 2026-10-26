# Integrating No-Code Architects Toolkit (media processing)

The [No-Code Architects Toolkit](https://github.com/stephengpope/no-code-architects-toolkit) is a Flask API for heavy media work: transcription, captions, FFmpeg compose, video cut/trim/split, audio concat, S3/GCS uploads, remote Python execution, etc.

## Goal

Run it as a **sidecar service** (Docker) on your Hostinger VPS and let the agent call its HTTP endpoints as tools.

## Deploy the toolkit

```bash
# from the extracted zip
cd no-code-architects-toolkit-main
docker build -t nca-toolkit .

docker run -d --name nca-toolkit \
  -p 8080:8080 \
  -e API_KEY=your-secret-key \
  -e S3_ENDPOINT_URL=... \
  -e S3_ACCESS_KEY=... \
  -e S3_SECRET_KEY=... \
  -e S3_BUCKET_NAME=... \
  -e S3_REGION=... \
  nca-toolkit
```

Or add it to your thepopebot `docker-compose.custom.yml` so it starts with the stack.

## Useful endpoints (examples)

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/media/media_transcribe` | Transcribe audio/video |
| `POST /v1/video/caption_video` | Burn captions |
| `POST /v1/video/concatenate` | Join clips |
| `POST /v1/video/trim` / `cut` / `split` | Edit timeline |
| `POST /v1/audio/concatenate` | Merge audio |
| `POST /v1/ffmpeg/compose` | Arbitrary FFmpeg graph |
| `POST /v1/code/execute/python` | Run Python remotely |
| `POST /v1/s3/upload` | Store results |

Full docs live in the toolkit’s `docs/` folder.

## Skill pattern for the agent

Create `skills/media-toolkit/SKILL.md`:

```markdown
# Media Toolkit

Base URL: http://nca-toolkit:8080   # or host.docker.internal:8080
Auth: header x-api-key: $NCA_API_KEY

When the user asks to transcribe, caption, trim, or process video/audio:
1. Ensure the source file is reachable (URL or local path mounted in the container)
2. POST to the matching /v1/... endpoint with JSON body
3. Poll job status if async
4. Return the result URL or path to the user
```

Add `NCA_API_KEY` and `NCA_BASE_URL` to **Admin → Event Handler → Agent Secrets** so every agent job inherits them.

## Why this stays off the chat frontend

Media jobs are CPU/GPU heavy. Keep them on the VPS sidecar so Vercel / the Next.js chat UI stays light — matching your earlier goal of not bogging down the main server.

## Next implementation step

1. Add nca-toolkit service to `docker-compose.custom.yml`
2. Add agent secrets `NCA_API_KEY`, `NCA_BASE_URL`
3. Author `skills/media-toolkit/SKILL.md` with the main endpoints you care about
4. Test: "transcribe this video" from chat → agent hits the toolkit
