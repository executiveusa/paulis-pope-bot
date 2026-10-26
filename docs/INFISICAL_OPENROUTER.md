# OpenRouter + Infisical + in-chat model picker

## What you get

1. **OpenRouter** is a first-class built-in provider with popular models pre-listed.
2. **Mercury (Inception)** is built-in (`MERCURY_API_KEY`).
3. **In-chat Model picker** in the chat header — switch provider/model; paste API keys when missing.
4. **Infisical** (optional) loads `OPENROUTER_API_KEY`, `MERCURY_API_KEY`, and other LLM keys at boot.

## 1. OpenRouter key (no Infisical)

**Admin → Event Handler → LLMs (Providers)** → OpenRouter → paste `OPENROUTER_API_KEY`  
or use the **Add API key** link inside the chat model picker.

Set active model to e.g. `openrouter/auto` or `anthropic/claude-sonnet-4`.

## 2. Infisical (recommended for production)

In Infisical project, create secrets:

| Secret name | Value |
|-------------|-------|
| `OPENROUTER_API_KEY` | sk-or-... |
| `MERCURY_API_KEY` | (optional) |
| other provider keys | optional |

In thepopebot `.env`:

```bash
INFISICAL_SYNC=1
INFISICAL_TOKEN=st.xxxx          # or INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET
INFISICAL_PROJECT_ID=your-project-uuid
INFISICAL_ENV=prod
# INFISICAL_API_URL=https://app.infisical.com
# INFISICAL_SECRET_PATH=/
```

Wire startup (event-handler entry or server boot):

```js
import { syncInfisicalSecrets } from './lib/infisical.js';
await syncInfisicalSecrets();
```

If keys should also land in the DB so the Admin UI shows “key set”:

```js
import { setConfigSecret } from './lib/db/config.js';
await syncInfisicalSecrets({
  setConfigSecret: (key, value) => setConfigSecret(key, value, 'system'),
});
```

## 3. Mercury via OpenRouter vs direct

- **Direct:** provider `mercury`, model `mercury-3`, key `MERCURY_API_KEY`.
- **Via OpenRouter:** if Inception is listed on OpenRouter, use that model id with `OPENROUTER_API_KEY` only.

## 4. What the model picker controls

It sets **Helper LLM** (`LLM_PROVIDER` / `LLM_MODEL`) — titles, summaries, and any path that uses `callHelperLlm`. Coding agents still use their own backend settings under **Settings → Coding Agents**.

## 5. Verify

1. `git pull`
2. Set OpenRouter key (UI or Infisical)
3. Open chat → header model picker → choose OpenRouter model
4. Send a message; titles should use that model
