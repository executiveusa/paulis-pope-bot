# Integrating HyperAgent (browser automation)

[HyperAgent](https://github.com/hyperbrowserai/hyperagent) is Playwright supercharged with LLMs — natural language browser control, extraction, stealth, and optional Hyperbrowser cloud sessions.

## Goal

Expose HyperAgent as tools the coding agent (or a skill) can call:

- `browse_and_act(task)` — multi-step browser task
- `extract_from_page(url, schema)` — structured extraction
- `perform_action(url, action)` — single granular action

## Recommended approach

### Option A — Skill that shells out to HyperAgent CLI

1. Install in the coding-agent Docker image or on the host:

```bash
npm install -g @hyperbrowser/agent
# or add to docker/coding-agent Dockerfile
```

2. Add a skill under `skills/` or `skills-library/` that documents:

```
When you need to browse the web or interact with a site, run:
npx @hyperbrowser/agent -c "<task description>"
```

3. Set `OPENAI_API_KEY` / provider env (or HyperAgent’s own LLM config) in agent-job secrets.

### Option B — Thin HTTP tool server

Run a small Node service that wraps HyperAgent and exposes HTTP endpoints. Register those as tools the agent can call via curl/fetch from Bash.

```ts
// example sketch
import { HyperAgent } from "@hyperbrowser/agent";

const agent = new HyperAgent({ llm: { provider: "openai", model: "gpt-4o" } });

app.post("/browse", async (req, res) => {
  const result = await agent.executeTask(req.body.task);
  res.json(result);
});
```

Point agent secrets / skills at that service URL.

### Option C — MCP (if you use MCP-capable agents)

HyperAgent supports MCP client connections. Wire it as an MCP server the coding agent can attach to.

## Env vars to put in Agent Job Secrets

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` or provider key | LLM for HyperAgent decisions |
| `HYPERBROWSER_API_KEY` | optional cloud browser sessions |

## Files in this monorepo

You uploaded `HyperAgent-main.zip`. Keep a copy under something like:

```
vendor/hyperagent/   # or tools/hyperagent/
```

and reference it from skills so agents know the local path.

## Next implementation step

1. Add `skills/browser-automation/SKILL.md` describing when and how to call HyperAgent
2. Extend the coding-agent Dockerfile to include `@hyperbrowser/agent`
3. Add secrets for the LLM key used by HyperAgent
