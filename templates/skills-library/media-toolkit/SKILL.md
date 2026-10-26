---
name: media-toolkit
description: Heavy media processing via the No-Code Architects Toolkit API — transcribe, caption, trim, concatenate, FFmpeg compose, remote Python. Use for video/audio editing and transcription jobs.
---

# Media Toolkit (No-Code Architects)

Base URL defaults to the local Docker service:

```
NCA_BASE_URL=${NCA_BASE_URL:-http://nca-toolkit:8080}
NCA_API_KEY=${NCA_API_KEY}
```

Set both in **Admin → Event Handler → Agent Secrets**.

Auth header on every request:

```
x-api-key: $NCA_API_KEY
```

## Common endpoints

### Transcribe

```bash
curl -s -X POST "$NCA_BASE_URL/v1/media/media_transcribe" \
  -H "x-api-key: $NCA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"media_url":"https://example.com/audio.mp3"}'
```

### Caption a video

```bash
curl -s -X POST "$NCA_BASE_URL/v1/video/caption_video" \
  -H "x-api-key: $NCA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"video_url":"...","captions":"..."}'
```

### Trim / cut / split / concatenate

```bash
# trim
curl -s -X POST "$NCA_BASE_URL/v1/video/trim" \
  -H "x-api-key: $NCA_API_KEY" -H "Content-Type: application/json" \
  -d '{"video_url":"...","start":0,"end":30}'

# concatenate
curl -s -X POST "$NCA_BASE_URL/v1/video/concatenate" \
  -H "x-api-key: $NCA_API_KEY" -H "Content-Type: application/json" \
  -d '{"video_urls":["...","..."]}'
```

### FFmpeg compose

```bash
curl -s -X POST "$NCA_BASE_URL/v1/ffmpeg/compose" \
  -H "x-api-key: $NCA_API_KEY" -H "Content-Type: application/json" \
  -d '{"inputs":[...],"filters":[...],"output":{...}}'
```

### Job status (async jobs)

```bash
curl -s "$NCA_BASE_URL/v1/toolkit/job_status?job_id=JOB_ID" \
  -H "x-api-key: $NCA_API_KEY"
```

## Workflow for the agent

1. Confirm `NCA_BASE_URL` and `NCA_API_KEY` are set (`skills/agent-job-secrets` if needed)
2. Ensure the source media is a reachable URL (or uploaded to S3 and use that URL)
3. POST the matching endpoint
4. If the response is a job id, poll job status until complete
5. Return the output URL / path to the user

## Docker service

Defined in `docker-compose.custom.yml` as service `nca-toolkit`.
From the host, reach it at `http://localhost:8080` when the port is published.
From other containers on the same compose network, use `http://nca-toolkit:8080`.
