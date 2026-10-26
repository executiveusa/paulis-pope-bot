# Full stack setup (crystallize + Mercury + media + browser)

After pulling the latest `paulis-pope-bot` changes:

## 1. Pull & rebuild UI components

```bash
git pull origin main
# If you consume thepopebot as a package, reinstall / rebuild so lib/chat changes apply
npm run build   # inside the package, if developing the package itself
```

## 2. Mercury (diffusion model)

Admin → Event Handler → LLMs → **Add OpenAI Compatible API**

| Field | Value |
|-------|-------|
| Name | Mercury |
| Base URL | `https://api.inceptionlabs.ai/v1` |
| API Key | your Inception key |
| Models | `mercury-3` |

Then set Helper LLM (or coding path) to use it. Crystallize UI works with any streaming model.

## 3. Activate skills

In your **project** root (scaffolded thepopebot instance):

```bash
mkdir -p skills-library skills
# Copy from this repo templates if not already present:
# templates/skills-library/browser-automation → skills-library/browser-automation
# templates/skills-library/media-toolkit → skills-library/media-toolkit
ln -sfn ../skills-library/browser-automation skills/browser-automation
ln -sfn ../skills-library/media-toolkit skills/media-toolkit
```

## 4. Media toolkit sidecar

Place the No-Code Architects Toolkit source at:

```
vendor/nca-toolkit/   # extract no-code-architects-toolkit-main here
```

Set in `.env`:

```
NCA_API_KEY=some-long-secret
NCA_PORT=8080
```

Also add `NCA_API_KEY` and `NCA_BASE_URL=http://nca-toolkit:8080` as **Agent Secrets**.

Start with the media profile:

```bash
docker compose -f docker-compose.custom.yml --profile media up -d nca-toolkit
```

## 5. HyperAgent

```bash
npm install -g @hyperbrowser/agent
```

Add LLM keys used by HyperAgent to Agent Secrets.

## 6. Verify

- Chat: stream a reply → text should crystallize from noise
- Attach image + video → previews and players render
- Ask agent to "transcribe this audio URL" → media-toolkit skill
- Ask agent to "open example.com and extract the title" → browser-automation / playwright-cli
