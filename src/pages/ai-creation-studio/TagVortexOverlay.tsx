/**
 * @fileoverview Vortex animation overlay for "I'm Feeling Lucky" tag selection
 * @module @pages/ai-creation-studio/TagVortexOverlay
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { formatTag, getAllTags } from './tags/tagData';

interface TagVortexOverlayProps {
  selectedTags: string[];
  isVisible: boolean;
  onComplete: () => void;
}

interface VortexTag {
  id: number;
  label: string;
  isSelected: boolean;
  startAngle: number;
  orbitRadius: number;
  spinDegrees: number;
  startDelay: number;
  fontSize: number;
  opacity: number;
  duration: number;
}

const TOTAL_VORTEX_TAGS = 36;

/** Simple string hash for deterministic seeding */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

/** Seeded pseudo-random generator (LCG) — deterministic per seed */
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
  const filtered = pool.filter((t) => !exclude.includes(t));
  // Fisher-Yates shuffle using seeded RNG
  const shuffled = [...filtered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export const TagVortexOverlay: React.FC<TagVortexOverlayProps> = ({
  selectedTags,
  isVisible,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'swirl' | 'converge' | 'reveal' | 'done'>('swirl');
  const [fadeOut, setFadeOut] = useState(false);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const tags = useMemo((): VortexTag[] => {
    const rand = seededRandom(hashString(selectedTags.join(',')));
    const all = getAllTags();
    const fillerCount = Math.max(0, TOTAL_VORTEX_TAGS - selectedTags.length);
    const filler = sampleTags(all, fillerCount, selectedTags, rand);

    const items: VortexTag[] = [];

    selectedTags.forEach((label, i) => {
      items.push({
        id: i,
        label,
        isSelected: true,
        startAngle: rand() * 360,
        orbitRadius: 120 + rand() * 180,
        spinDegrees: 360 + rand() * 720,
        startDelay: rand() * 0.5,
        fontSize: 0.9 + rand() * 0.4,
        opacity: 0.6 + rand() * 0.4,
        duration: 2.5 + rand() * 1,
      });
    });

    filler.forEach((label, i) => {
      items.push({
        id: selectedTags.length + i,
        label,
        isSelected: false,
        startAngle: rand() * 360,
        orbitRadius: 100 + rand() * 220,
        spinDegrees: 360 + rand() * 1080,
        startDelay: rand() * 0.8,
        fontSize: 0.75 + rand() * 0.35,
        opacity: 0.4 + rand() * 0.4,
        duration: 2.5 + rand() * 1,
      });
    });

    return items;
  }, [selectedTags]);

  useEffect(() => {
    if (!isVisible) return;

    // Use microtask to avoid synchronous setState during effect execution
    queueMicrotask(() => {
      setPhase('swirl');
      setFadeOut(false);
    });

    if (reducedMotion) {
      // Delay the phase change slightly to allow the reset above to settle
      setTimeout(() => setPhase('reveal'), 50);
      
      const t1 = setTimeout(() => {
        setFadeOut(true);
      }, 800);
      const t2 = setTimeout(onComplete, 1300);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    // Normal animation timing
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 2: converge (after 3.5s)
    timers.push(setTimeout(() => setPhase('converge'), 3500));

    // Phase 3: reveal (after 5s)
    timers.push(setTimeout(() => setPhase('reveal'), 5000));

    // Phase 4: fade out (after 7s)
    timers.push(setTimeout(() => setFadeOut(true), 7000));

    // Complete (after 7.5s)
    timers.push(setTimeout(onComplete, 7500));

    return () => timers.forEach(clearTimeout);
  }, [isVisible, onComplete, reducedMotion]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      {/* Vortex container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Swirling tags */}
        {phase === 'swirl' &&
          tags.map((tag) => (
            <div
              key={tag.id}
              className="absolute pointer-events-none select-none"
              style={{
                animation: `vortexOrbit ${tag.duration}s ease-out forwards`,
                animationDelay: `${tag.startDelay}s`,
              }}
            >
              <div
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  transform: `rotate(${tag.startAngle}deg) translateX(${tag.orbitRadius}px)`,
                  fontSize: `${tag.fontSize}rem`,
                  opacity: tag.opacity,
                  backgroundColor: tag.isSelected
                    ? 'rgba(139,92,246,0.25)'
                    : 'rgba(120,113,108,0.15)',
                  color: tag.isSelected ? '#c4b5fd' : '#a8a29e',
                  border: `1px solid ${tag.isSelected ? 'rgba(139,92,246,0.4)' : 'rgba(120,113,108,0.3)'}`,
                }}
              >
                {formatTag(tag.label)}
              </div>
            </div>
          ))}

        {/* Converge phase: selected tags drift to center */}
        {phase === 'converge' && (
          <>
            {tags
              .filter((t) => !t.isSelected)
              .map((tag) => (
                <div
                  key={tag.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    animation: `vortexReject 1s ease-in forwards`,
                    transform: `rotate(${tag.startAngle}deg) translateX(${tag.orbitRadius}px)`,
                  }}
                >
                  <div
                    className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      fontSize: `${tag.fontSize}rem`,
                      opacity: tag.opacity,
                      backgroundColor: 'rgba(120,113,108,0.15)',
                      color: '#a8a29e',
                      border: '1px solid rgba(120,113,108,0.3)',
                    }}
                  >
                    {formatTag(tag.label)}
                  </div>
                </div>
              ))}
            {tags
              .filter((t) => t.isSelected)
              .map((tag, idx) => (
                <div
                  key={tag.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    animation: `vortexConverge 1.2s ease-out ${idx * 0.08}s forwards`,
                    transform: `rotate(${tag.startAngle}deg) translateX(${tag.orbitRadius}px)`,
                  }}
                >
                  <div
                    className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      fontSize: `${tag.fontSize}rem`,
                      backgroundColor: 'rgba(139,92,246,0.3)',
                      color: '#ddd6fe',
                      border: '1px solid rgba(139,92,246,0.5)',
                    }}
                  >
                    {formatTag(tag.label)}
                  </div>
                </div>
              ))}
          </>
        )}

        {/* Reveal phase: selected tags settled + Good luck text */}
        {(phase === 'reveal' || phase === 'done') && (
          <div className="z-10 flex flex-col items-center justify-center text-center px-6">
            <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-lg">
              {selectedTags.map((tag, i) => (
                <div
                  key={tag}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold animate-revealScale"
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    backgroundColor: 'rgba(139,92,246,0.35)',
                    color: '#ddd6fe',
                    border: '1px solid rgba(139,92,246,0.55)',
                  }}
                >
                  {formatTag(tag)}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 animate-revealText">
              <Dices className="w-5 h-5 text-violet-300" />
              <span className="text-lg font-medium text-violet-200">
                Good luck...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes vortexOrbit {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          15% {
            opacity: 1;
          }
          80% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: scale(0.6);
          }
        }
        @keyframes vortexReject {
          0% {
            opacity: 0.6;
          }
          100% {
            opacity: 0;
            transform: translateX(600px) translateY(300px) rotate(720deg) scale(0.2);
          }
        }
        @keyframes vortexConverge {
          0% {
            opacity: 0.8;
          }
          100% {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }
        @keyframes revealScale {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          60% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes revealText {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-revealScale {
          animation: revealScale 0.5s ease-out forwards;
          opacity: 0;
        }
        .animate-revealText {
          animation: revealText 0.6s ease-out 0.3s forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};
