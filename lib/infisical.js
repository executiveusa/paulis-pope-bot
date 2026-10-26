/**
 * Optional Infisical integration — pull LLM API keys into the process at boot.
 *
 * Env (any of these auth modes):
 *   INFISICAL_TOKEN                 — service token (simplest)
 *   INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET — universal auth
 *   INFISICAL_PROJECT_ID (or INFISICAL_PROJECT_SLUG)
 *   INFISICAL_ENV=dev|staging|prod  (default: prod)
 *   INFISICAL_API_URL               — default https://app.infisical.com
 *   INFISICAL_SECRET_PATH=/         — folder path
 *   INFISICAL_SYNC=1                — must be set to enable
 *
 * Maps these secret names (when present in Infisical) into process.env
 * if the env var is not already set:
 *   OPENROUTER_API_KEY, MERCURY_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY,
 *   GOOGLE_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY, MISTRAL_API_KEY, ...
 *
 * Call `await syncInfisicalSecrets()` once during server startup.
 */

const DEFAULT_KEYS = [
  'OPENROUTER_API_KEY',
  'MERCURY_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'XAI_API_KEY',
  'DEEPSEEK_API_KEY',
  'MISTRAL_API_KEY',
  'MOONSHOT_API_KEY',
  'NVIDIA_API_KEY',
  'GROQ_API_KEY',
  'HYPERBROWSER_API_KEY',
  'NCA_API_KEY',
];

function enabled() {
  return process.env.INFISICAL_SYNC === '1' || process.env.INFISICAL_SYNC === 'true';
}

async function getAccessToken(apiUrl) {
  if (process.env.INFISICAL_TOKEN) return process.env.INFISICAL_TOKEN;

  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Infisical: set INFISICAL_TOKEN or INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET');
  }

  const res = await fetch(`${apiUrl}/api/v1/auth/universal-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Infisical auth failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.accessToken || data.token;
}

/**
 * Fetch secrets from Infisical and write missing ones into process.env.
 * Also optionally mirrors into thepopebot config secrets when setConfigSecret is provided.
 *
 * @param {{ setConfigSecret?: (key: string, value: string) => void }} [opts]
 * @returns {Promise<{ loaded: string[], skipped: string[] }>
 */
export async function syncInfisicalSecrets(opts = {}) {
  if (!enabled()) {
    return { loaded: [], skipped: [], disabled: true };
  }

  const apiUrl = (process.env.INFISICAL_API_URL || 'https://app.infisical.com').replace(/\/$/, '');
  const envSlug = process.env.INFISICAL_ENV || 'prod';
  const secretPath = process.env.INFISICAL_SECRET_PATH || '/';
  const projectId = process.env.INFISICAL_PROJECT_ID;
  const projectSlug = process.env.INFISICAL_PROJECT_SLUG;

  if (!projectId && !projectSlug) {
    throw new Error('Infisical: set INFISICAL_PROJECT_ID or INFISICAL_PROJECT_SLUG');
  }

  const token = await getAccessToken(apiUrl);
  const params = new URLSearchParams({
    environment: envSlug,
    secretPath,
    viewSecretValue: 'true',
  });
  if (projectId) params.set('workspaceId', projectId);
  if (projectSlug) params.set('workspaceSlug', projectSlug);

  const res = await fetch(`${apiUrl}/api/v3/secrets/raw?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Infisical list secrets failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const body = await res.json();
  const secrets = body.secrets || body || [];
  const byName = new Map();
  for (const s of secrets) {
    const name = s.secretKey || s.key || s.name;
    const value = s.secretValue || s.value;
    if (name && value != null) byName.set(name, String(value));
  }

  const loaded = [];
  const skipped = [];
  for (const key of DEFAULT_KEYS) {
    if (!byName.has(key)) continue;
    if (process.env[key]) {
      skipped.push(key);
      continue;
    }
    const value = byName.get(key);
    process.env[key] = value;
    if (typeof opts.setConfigSecret === 'function') {
      try { opts.setConfigSecret(key, value); } catch {}
    }
    loaded.push(key);
  }

  for (const [name, value] of byName) {
    if (process.env[name]) continue;
    if (/^(OPENROUTER|MERCURY|LLM)_/i.test(name) && !DEFAULT_KEYS.includes(name)) {
      process.env[name] = value;
      loaded.push(name);
    }
  }

  console.log(`[infisical] loaded ${loaded.length} secrets, skipped existing ${skipped.length}`);
  return { loaded, skipped };
}
