'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '../utils.js';

/**
 * Mercury-style diffusion / crystallize effect.
 * While streaming, new text briefly appears as noisy glyphs then settles
 * into the real content. Once streaming ends, falls through to clean Streamdown.
 */
const NOISE = '░▒▓█▄▀■□▪▫∙•◦○●¤⌂╬╫╪┼├┤┬┴┌┐└┘│─';

function pickNoise(seed) {
  return NOISE[Math.abs(seed * 2654435761) % NOISE.length];
}

export function CrystallizeText({
  text = '',
  isStreaming = false,
  className,
  linkSafety,
  /** How long (ms) each new character stays noisy before resolving */
  settleMs = 220,
  /** Max characters that can still be noisy at once */
  maxNoiseWindow = 36,
  /** 0–1: fraction of noisy chars that stay real (higher = more readable) */
  keepRealRatio = 0.28,
}) {
  const prevLenRef = useRef(0);
  const [resolvedUpTo, setResolvedUpTo] = useState(0);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!isStreaming) {
      setResolvedUpTo(text.length);
      prevLenRef.current = text.length;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [isStreaming, text.length]);

  useEffect(() => {
    if (!isStreaming) return;

    const prev = prevLenRef.current;
    const next = text.length;

    if (next <= prev) {
      prevLenRef.current = next;
      setResolvedUpTo(next);
      return;
    }

    const startNoise = Math.max(prev, next - maxNoiseWindow);
    setResolvedUpTo((r) => Math.max(r, startNoise));

    const timer = setTimeout(() => {
      setResolvedUpTo((r) => Math.max(r, next));
    }, settleMs);

    timersRef.current.push(timer);
    prevLenRef.current = next;
  }, [text, isStreaming, settleMs, maxNoiseWindow]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

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

  const resolved = text.slice(0, resolvedUpTo);
  const noisy = text.slice(resolvedUpTo);

  const noisyDisplay = useMemo(() => {
    return noisy
      .split('')
      .map((ch, i) => {
        if (ch === ' ' || ch === '\n' || ch === '\t') return ch;
        // Keep a portion of real characters so the line stays legible while settling
        const seed = resolvedUpTo + i + ch.charCodeAt(0);
        if ((seed % 100) / 100 < keepRealRatio) return ch;
        return pickNoise(seed);
      })
      .join('');
  }, [noisy, resolvedUpTo, keepRealRatio]);

  return (
    <div className={cn('crystallize-root', className)}>
      <style>{`
        @keyframes crystallize-settle {
          0%   { opacity: 0.25; filter: blur(3px);  letter-spacing: 0.06em; }
          40%  { opacity: 0.7;  filter: blur(1px);  letter-spacing: 0.02em; }
          100% { opacity: 1;    filter: blur(0);    letter-spacing: 0; }
        }
        .crystallize-noise {
          animation: crystallize-settle ${settleMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          color: var(--muted-foreground, #a3a3a3);
          font-variant-ligatures: none;
        }
      `}</style>
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
