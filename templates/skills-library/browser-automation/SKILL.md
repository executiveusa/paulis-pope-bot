---
name: browser-automation
description: AI browser automation via HyperAgent (natural language tasks) or playwright-cli. Use when the user asks to browse a site, extract data, fill forms, or automate web workflows.
---

# Browser Automation

Two options — prefer HyperAgent for natural-language multi-step tasks; use playwright-cli for precise low-level control.

## Secrets

Add in **Admin → Event Handler → Agent Secrets**:

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` or provider key | LLM used by HyperAgent |
| `HYPERBROWSER_API_KEY` | optional cloud browser sessions |

## HyperAgent (natural language)

Install once in the environment (or ensure the coding-agent image has it):

```bash
npm install -g @hyperbrowser/agent
```

Run a task:

```bash
npx @hyperbrowser/agent -c "Navigate to example.com, search for X, extract the top 5 results"
```

Library-style (Node):

```js
import { HyperAgent } from "@hyperbrowser/agent";
const agent = new HyperAgent({ llm: { provider: "openai", model: "gpt-4o" } });
const result = await agent.executeTask("...");
console.log(result.output);
await agent.closeAgent();
```

## playwright-cli (precise control)

Also available via the bundled `playwright-cli` skill. Example:

```bash
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli click e3
playwright-cli close
```

## When to use which

| Goal | Tool |
|------|------|
| "Go to this site and do X" in plain English | HyperAgent |
| Exact clicks, form fills, test scripts | playwright-cli |
| Stealth / scale cloud browsers | HyperAgent + Hyperbrowser |

## Notes

- Prefer headless unless the user needs to watch the session
- Do not store credentials in the skill — use agent secrets
- For large extracted datasets, write results to a file under the project and summarize
