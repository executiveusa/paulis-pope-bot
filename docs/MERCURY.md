# Using Mercury (Inception Labs) with thepopebot

Mercury is a **diffusion language model**. It is OpenAI-compatible, so thepopebot can use it through a **custom provider** — no code changes required.

## 1. Get an API key

1. Sign up at [inceptionlabs.ai](https://www.inceptionlabs.ai)
2. Create an API key in the dashboard

## 2. Add Mercury as a custom provider

In thepopebot:

**Admin → Event Handler → LLMs → Add OpenAI Compatible API**

| Field | Value |
|-------|-------|
| **Name** | `Mercury` (or `Inception`) |
| **Base URL** | `https://api.inceptionlabs.ai/v1` |
| **API Key** | your Inception API key |
| **Models** | `mercury-3` (chat) — also `mercury-2`, `mercury-edit-2` |

Save.

## 3. Use it

### As Helper LLM (titles / summaries)

**Admin → Event Handler → Helper LLM** → pick the Mercury custom provider + model.

### As coding / live-chat model

Mercury works best as a **fast chat / planning** model. For heavy coding agents (Claude Code, Codex, etc.) keep those as the coding agent and use Mercury for quick conversational turns if you wire a custom OpenAI-compatible agent path, or call it from skills/tools.

thepopebot’s coding agents are specialized CLIs; Mercury is ideal when you want the crystallize visual effect paired with a real diffusion model on the chat side.

## Models reference

| Model | Use |
|-------|-----|
| `mercury-3` | Main chat (recommended) |
| `mercury-2` | Previous generation |
| `mercury-edit-2` | Code edit / FIM oriented |

## Notes

- Base URL must end with `/v1`
- Mercury is **text-only** (no vision) as of the current API
- Streaming works; the crystallize UI effect in `message.jsx` pairs well with it
- Tool calling is supported via the OpenAI function-calling schema

## Official docs

- Integrations: https://docs.inceptionlabs.ai/integrations/overview
- Models: https://docs.inceptionlabs.ai/get-started/models
