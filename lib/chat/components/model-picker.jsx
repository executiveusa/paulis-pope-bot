'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getChatSettings, setActiveLlm, updateProviderCredential } from '../actions.js';
import { cn } from '../utils.js';
import { ChevronDownIcon } from './icons.js';

/**
 * In-chat model picker. Lists providers that have API keys configured
 * (OpenRouter, Mercury, Anthropic, …) and lets the user switch the active
 * Helper LLM (LLM_PROVIDER / LLM_MODEL). Keys can be pasted inline or loaded
 * via Infisical on the server (INFISICAL_SYNC=1).
 */
export function ModelPicker({ className }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState([]);
  const [active, setActive] = useState({ provider: '', model: '' });
  const [keyDraft, setKeyDraft] = useState('');
  const [keyFor, setKeyFor] = useState(null);
  const ref = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getChatSettings();
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const list = [];
      const statuses = result.credentialStatuses || {};

      if (result.builtinProviders) {
        for (const [slug, prov] of Object.entries(result.builtinProviders)) {
          const credKey = prov.credentials?.[0]?.key;
          const hasKey = credKey ? !!statuses[credKey] : false;
          list.push({
            slug,
            name: prov.name,
            models: prov.models || [],
            credKey,
            hasKey,
            freeform: !prov.models?.length,
          });
        }
      }
      if (result.customProviders) {
        for (const cp of result.customProviders) {
          list.push({
            slug: cp.key || cp.id,
            name: cp.name,
            models: (cp.models || []).map((m) =>
              typeof m === 'string' ? { id: m, name: m } : m
            ),
            hasKey: true,
            freeform: false,
          });
        }
      }

      list.sort((a, b) => {
        if (a.hasKey !== b.hasKey) return a.hasKey ? -1 : 1;
        const score = (s) => (s === 'openrouter' ? 0 : s === 'mercury' ? 1 : 2);
        return score(a.slug) - score(b.slug);
      });

      setProviders(list);
      setActive({
        provider: result.active?.provider || '',
        model: result.active?.model || '',
      });
    } catch (e) {
      setError(e.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const label = (() => {
    if (loading) return 'Model…';
    if (!active.provider) return 'Select model';
    const prov = providers.find((p) => p.slug === active.provider);
    const modelName =
      prov?.models?.find((m) => m.id === active.model)?.name || active.model;
    return modelName || prov?.name || active.provider;
  })();

  const select = async (provider, model) => {
    setSaving(true);
    setError('');
    try {
      const result = await setActiveLlm(provider, model);
      if (result?.error) {
        setError(result.error);
      } else {
        setActive({ provider, model });
        setOpen(false);
      }
    } catch (e) {
      setError(e.message || 'Failed to set model');
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async () => {
    if (!keyFor || !keyDraft.trim()) return;
    const prov = providers.find((p) => p.slug === keyFor);
    if (!prov?.credKey) return;
    setSaving(true);
    setError('');
    try {
      const result = await updateProviderCredential(prov.credKey, keyDraft.trim());
      if (result?.error) {
        setError(result.error);
      } else {
        setKeyDraft('');
        setKeyFor(null);
        await load();
      }
    } catch (e) {
      setError(e.message || 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex max-w-[200px] items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted',
          saving && 'opacity-60'
        )}
        disabled={saving}
        title="Chat / Helper LLM model"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon size={12} className="shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-[280px] overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Model (OpenRouter / any)
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Keys: Settings → Providers, or Infisical (INFISICAL_SYNC=1)
            </p>
          </div>

          {error && (
            <div className="mx-2 mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
          ) : (
            providers.map((prov) => (
              <div key={prov.slug} className="border-b border-border/60 last:border-0">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs font-medium text-foreground">{prov.name}</span>
                  {!prov.hasKey && prov.credKey && (
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => setKeyFor(keyFor === prov.slug ? null : prov.slug)}
                    >
                      {keyFor === prov.slug ? 'Cancel' : 'Add API key'}
                    </button>
                  )}
                  {prov.hasKey && (
                    <span className="text-[10px] text-green-600">key set</span>
                  )}
                </div>

                {keyFor === prov.slug && (
                  <div className="space-y-1.5 px-3 pb-2">
                    <input
                      type="password"
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      placeholder={`${prov.credKey}`}
                      className="w-full rounded-md border border-border bg-muted px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={saveKey}
                      disabled={saving || !keyDraft.trim()}
                      className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
                    >
                      Save key
                    </button>
                  </div>
                )}

                {prov.hasKey &&
                  (prov.models.length > 0 ? (
                    prov.models.map((m) => {
                      const id = m.id || m;
                      const name = m.name || id;
                      const selected =
                        active.provider === prov.slug && active.model === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => select(prov.slug, id)}
                          className={cn(
                            'flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-muted',
                            selected && 'bg-muted font-medium text-primary'
                          )}
                        >
                          {name}
                        </button>
                      );
                    })
                  ) : (
                    <FreeformModel
                      provider={prov.slug}
                      current={active.provider === prov.slug ? active.model : ''}
                      onSelect={select}
                    />
                  ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FreeformModel({ provider, current, onSelect }) {
  const [value, setValue] = useState(current || '');
  return (
    <div className="flex gap-1 px-3 pb-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="provider/model-id"
        className="min-w-0 flex-1 rounded-md border border-border bg-muted px-2 py-1 text-xs"
      />
      <button
        type="button"
        disabled={!value.trim()}
        onClick={() => onSelect(provider, value.trim())}
        className="rounded-md bg-foreground px-2 py-1 text-[11px] text-background disabled:opacity-40"
      >
        Use
      </button>
    </div>
  );
}
