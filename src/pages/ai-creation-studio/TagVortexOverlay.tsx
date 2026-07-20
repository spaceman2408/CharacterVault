/**
 * @fileoverview Vortex animation overlay for "I'm Feeling Lucky" tag selection.
 * @module @pages/ai-creation-studio/TagVortexOverlay
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { formatTag, getAllTags } from './tags/tagData';

interface TagVortexOverlayProps {
  selectedTags: string[];
  isVisible: boolean;
  onComplete: () => void;
  onAnimationStart?: () => void;
}

interface VortexTag {
  id: number;
  label: string;
  isSelected: boolean;
  startAngle: number;
  orbitRadius: number;
  startDelay: number;
  fontSize: number;
  opacity: number;
  duration: number;
}

const MODAL_FADE_MS = 250;
const SWIRL_MS = 2200;
const SETTLE_MS = 900;
const REVEAL_MS = 2400;
const FADE_OUT_MS = 500;

const DESKTOP_TAG_COUNT = 24;
const MOBILE_TAG_COUNT = 16;

type Phase = 'waiting' | 'swirl' | 'settle' | 'reveal';

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function sampleTags(
  pool: readonly string[],
  count: number,
  exclude: readonly string[],
  rand: () => number
): string[] {
  const filtered = pool.filter(t => !exclude.includes(t));
  const shuffled = [...filtered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function chipClass(isSelected: boolean, size: 'orbit' | 'reveal' = 'orbit'): string {
  const base =
    size === 'reveal'
      ? 'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold sm:px-4 sm:py-2 sm:text-base'
      : 'whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium sm:px-3 sm:py-1.5';

  if (isSelected) {
    return `${base} border border-accent bg-accent-soft text-accent shadow-sm`;
  }
  return `${base} border border-border bg-muted/90 text-fg-muted`;
}

export const TagVortexOverlay: React.FC<TagVortexOverlayProps> = ({
  selectedTags,
  isVisible,
  onComplete,
  onAnimationStart,
}) => {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [fadeOut, setFadeOut] = useState(false);
  const [swirlExiting, setSwirlExiting] = useState(false);

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const maxTags = useMemo(() => {
    if (typeof window === 'undefined') return DESKTOP_TAG_COUNT;
    return window.innerWidth < 640 ? MOBILE_TAG_COUNT : DESKTOP_TAG_COUNT;
  }, []);

  const tags = useMemo((): VortexTag[] => {
    const rand = seededRandom(hashString(selectedTags.join(',')));
    const all = getAllTags();
    const fillerCount = Math.max(0, maxTags - selectedTags.length);
    const filler = sampleTags(all, fillerCount, selectedTags, rand);
    const items: VortexTag[] = [];

    selectedTags.forEach((label, i) => {
      items.push({
        id: i,
        label,
        isSelected: true,
        startAngle: rand() * 360,
        orbitRadius: 100 + rand() * 140,
        startDelay: rand() * 0.35,
        fontSize: 0.85 + rand() * 0.3,
        opacity: 0.75 + rand() * 0.25,
        duration: 2 + rand() * 0.6,
      });
    });

    filler.forEach((label, i) => {
      items.push({
        id: selectedTags.length + i,
        label,
        isSelected: false,
        startAngle: rand() * 360,
        orbitRadius: 90 + rand() * 160,
        startDelay: rand() * 0.5,
        fontSize: 0.75 + rand() * 0.25,
        opacity: 0.45 + rand() * 0.35,
        duration: 2 + rand() * 0.7,
      });
    });

    return items;
  }, [selectedTags, maxTags]);

  useEffect(() => {
    if (!isVisible) {
      const timer = setTimeout(() => {
        setPhase('waiting');
        setFadeOut(false);
        setSwirlExiting(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    onAnimationStart?.();

    const timers: ReturnType<typeof setTimeout>[] = [];

    queueMicrotask(() => {
      setPhase('waiting');
      setFadeOut(false);
      setSwirlExiting(false);
    });

    if (reducedMotion) {
      timers.push(setTimeout(() => setPhase('reveal'), MODAL_FADE_MS));
      timers.push(setTimeout(() => setFadeOut(true), MODAL_FADE_MS + REVEAL_MS));
      timers.push(setTimeout(onComplete, MODAL_FADE_MS + REVEAL_MS + FADE_OUT_MS));
      return () => timers.forEach(clearTimeout);
    }

    const tSwirl = MODAL_FADE_MS;
    const tSettle = tSwirl + SWIRL_MS;
    const tReveal = tSettle + SETTLE_MS;
    const tFade = tReveal + REVEAL_MS;
    const tDone = tFade + FADE_OUT_MS;

    timers.push(setTimeout(() => setPhase('swirl'), tSwirl));
    timers.push(
      setTimeout(() => {
        setPhase('settle');
        setSwirlExiting(true);
      }, tSettle)
    );
    timers.push(
      setTimeout(() => {
        setPhase('reveal');
        setSwirlExiting(false);
      }, tReveal)
    );
    timers.push(setTimeout(() => setFadeOut(true), tFade));
    timers.push(setTimeout(onComplete, tDone));

    return () => timers.forEach(clearTimeout);
  }, [isVisible, onComplete, onAnimationStart, reducedMotion]);

  if (!isVisible) return null;

  const showOrbit = (phase === 'swirl' || phase === 'settle' || swirlExiting) && !reducedMotion;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy={phase !== 'reveal'}
      aria-label="Choosing random tags"
      className={`fixed inset-0 z-9999 flex items-center justify-center bg-overlay backdrop-blur-md transition-opacity duration-500 ease-out ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 animate-vortex-pulse-slow"
        style={{
          background:
            'radial-gradient(circle at center, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 68%)',
        }}
      />

      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        {showOrbit && (
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-out"
            style={{ opacity: swirlExiting ? 0 : 1 }}
          >
            {tags.map(tag => (
              <div
                key={tag.id}
                className="pointer-events-none absolute select-none"
                style={{
                  opacity: 0,
                  animation: `vortexOrbit ${tag.duration}s cubic-bezier(0.33, 0, 0.2, 1) forwards`,
                  animationDelay: `${tag.startDelay}s`,
                }}
              >
                <div
                  className={chipClass(tag.isSelected)}
                  style={{
                    fontSize: `${tag.fontSize}rem`,
                    opacity: tag.opacity,
                    transform: `rotate(${tag.startAngle}deg) translateX(${tag.orbitRadius}px)`,
                    boxShadow: tag.isSelected
                      ? '0 0 18px color-mix(in srgb, var(--accent) 30%, transparent)'
                      : undefined,
                  }}
                >
                  {formatTag(tag.label)}
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === 'reveal' && (
          <div className="z-10 flex max-w-2xl flex-col items-center justify-center px-5 text-center sm:px-6">
            <div
              className="pointer-events-none absolute h-72 w-72 rounded-full animate-vortex-pulse-glow sm:h-96 sm:w-96"
              style={{
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--accent) 32%, transparent) 0%, color-mix(in srgb, var(--accent) 10%, transparent) 42%, transparent 70%)',
                filter: 'blur(36px)',
              }}
            />

            <div className="relative mb-6 flex max-w-xl flex-wrap justify-center gap-2 sm:mb-8 sm:gap-2.5">
              {selectedTags.map((tag, i) => (
                <div
                  key={`reveal-${i}-${tag}`}
                  className={`${chipClass(true, 'reveal')} animate-revealScale`}
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    boxShadow: '0 0 22px color-mix(in srgb, var(--accent) 35%, transparent)',
                  }}
                >
                  {formatTag(tag)}
                </div>
              ))}
            </div>

            <div className="relative flex flex-col items-center gap-2.5 animate-revealText">
              <div className="relative">
                <Dices className="h-7 w-7 text-accent animate-vortex-dice-spin sm:h-8 sm:w-8" />
                <div
                  className="absolute inset-0 animate-vortex-ping-slow"
                  style={{
                    background:
                      'radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                  }}
                />
              </div>
              <span className="text-xl font-semibold tracking-wide text-fg sm:text-2xl">
                Good luck…
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagVortexOverlay;
