'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '../utils.js';

/**
 * Mercury-style diffusion / crystallize effect.
 * While streaming, new text briefly appears as noisy characters then settles
 * into the real content. Once streaming ends, falls through to clean Streamdown.
 */
const NOISE = '░▒▓█▄▀■□▪▫∙•◦◘○●¤⌂çñøæßþđħłŧ';

function pickNoise(seed) {
  return NOISE[Math.abs(seed) % NOISE.length];
}

export function CrystallizeText({
  text = '',
  isStreaming = false,
  className,
  linkSafety,
  /** How long (ms) each new character stays noisy before resolving */
  settleMs = 180,
  /** Max characters that can still be noisy at once (keeps it readable) */
  maxNoiseWindow = 28,
}) {
  const prevLenRef = useRef(0);
  const [resolvedUpTo, setResolvedUpTo] = useState(0);
  const timersRef = useRef([]);

  // When streaming stops, resolve everything immediately and let Streamdown take over
  useEffect(() => {
    if (!isStreaming) {
      setResolvedUpTo(text.length);
      prevLenRef.current = text.length;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [isStreaming, text.length]);

  // As new characters arrive, schedule them to settle
  useEffect(() => {
    if (!isStreaming) return;

    const prev = prevLenRef.current;
    const next = text.length;

    if (next <= prev) {
      // text shrunk (rare) — reset
      prevLenRef.current = next;
      setResolvedUpTo(next);
      return;
    }

    // New characters: keep a sliding noise window
    const startNoise = Math.max(prev, next - maxNoiseWindow);

    // Immediately mark older characters as resolved
    setResolvedUpTo((r) => Math.max(r, startNoise));

    // Schedule the newest chunk to resolve after settleMs
    const timer = setTimeout(() => {
      setResolvedUpTo((r) => Math.max(r, next));
    }, settleMs);

    timersRef.current.push(timer);
    prevLenRef.current = next;

    return () => {
      // don't clear — we want the settle to finish even if effect re-runs
    };
  }, [text, isStreaming, settleMs, maxNoiseWindow]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Once fully settled (or not streaming), render clean markdown
  if (!isStreaming || resolvedUpTo >= text.length) {
    return (
      <Streamdown
        className={className}
        mode={isStreaming ? 'streaming' : 'static'}
        linkSafety={linkSafety}
      >
        {text}
      </Streamdown>
    );
  }

  // Streaming + still settling → show mixed resolved + noisy tail
  const resolved = text.slice(0, resolvedUpTo);
  const noisy = text.slice(resolvedUpTo);

  const noisyDisplay = useMemo(() => {
    return noisy
      .split('')
      .map((ch, i) => {
        if (ch === ' ' || ch === '\n' || ch === '\t') return ch;
        // Keep some real characters mixed in so it stays legible
        if (i % 3 === 0) return ch;
        return pickNoise(resolvedUpTo + i + ch.charCodeAt(0));
      })
      .join('');
  }, [noisy, resolvedUpTo]);

  return (
    <div className={cn('crystallize-root', className)}>
      <style>{`
        @keyframes crystallize-settle {
          0% { opacity: 0.35; filter: blur(2.5px); letter-spacing: 0.04em; }
          60% { opacity: 0.85; filter: blur(0.5px); }
          100% { opacity: 1; filter: blur(0); letter-spacing: 0; }
        }
        .crystallize-noise {
          animation: crystallize-settle ${settleMs}ms ease-out forwards;
          color: var(--muted-foreground, #a3a3a3);
          font-variant-ligatures: none;
        }
        .crystallize-resolved {
          color: inherit;
        }
      `}</style>
      {/* Resolved portion — still use Streamdown so markdown keeps working */}
      {resolved ? (
        <Streamdown mode="streaming" linkSafety={linkSafety}>
          {resolved}
        </Streamdown>
      ) : null}
      {noisy ? (
        <span className="crystallize-noise whitespace-pre-wrap break-words">
          {noisyDisplay}
        </span>
      ) : null}
    </div>
  );
}
