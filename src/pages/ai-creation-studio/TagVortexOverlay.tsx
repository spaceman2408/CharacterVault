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
  onAnimationStart?: () => void;
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
  onAnimationStart,
}) => {
  const [phase, setPhase] = useState<'waiting' | 'swirl' | 'converge' | 'reveal' | 'done'>('waiting');
  const [fadeOut, setFadeOut] = useState(false);
  const [isSwirlExiting, setIsSwirlExiting] = useState(false);
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
    if (!isVisible) {
      // When becoming invisible, schedule a reset for next render
      const timer = setTimeout(() => { setPhase('waiting'); setIsSwirlExiting(false); }, 0);
      return () => clearTimeout(timer);
    }

    // Notify parent to start fading out the input modal immediately
    onAnimationStart?.();

    // Wait for modal to fade out before starting animation
    const MODAL_FADE_DELAY = 250; // Give modal time to fade out (reduced for faster transition)

    // Use microtask to avoid synchronous setState during effect execution
    queueMicrotask(() => {
      setPhase('waiting'); // Ensure we start from waiting state
      setFadeOut(false);
    });

    if (reducedMotion) {
      // Delay the phase change slightly to allow the reset above to settle
      const t0 = setTimeout(() => setPhase('reveal'), MODAL_FADE_DELAY + 50);
      const t1 = setTimeout(() => {
        setFadeOut(true);
      }, MODAL_FADE_DELAY + 800);
      const t2 = setTimeout(onComplete, MODAL_FADE_DELAY + 1300);
      return () => { 
        clearTimeout(t0);
        clearTimeout(t1); 
        clearTimeout(t2); 
      };
    }

    // Normal animation timing - extended for more grandiose effect
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: start swirl (after modal fades)
    timers.push(setTimeout(() => setPhase('swirl'), MODAL_FADE_DELAY));

    // Phase 2: converge (after modal fade + 4s swirl)
    timers.push(setTimeout(() => {
      setPhase('converge');
      setIsSwirlExiting(true);
      // Clear swirl exit flag after fade-out completes
      timers.push(setTimeout(() => setIsSwirlExiting(false), 700));
    }, MODAL_FADE_DELAY + 4000));

    // Phase 3: reveal (after modal fade + 5.8s)
    timers.push(setTimeout(() => setPhase('reveal'), MODAL_FADE_DELAY + 5800));

    // Phase 4: fade out (after modal fade + 8.5s)
    timers.push(setTimeout(() => setFadeOut(true), MODAL_FADE_DELAY + 8500));

    // Complete (after modal fade + 9s)
    timers.push(setTimeout(onComplete, MODAL_FADE_DELAY + 9000));

    return () => timers.forEach(clearTimeout);
  }, [isVisible, onComplete, onAnimationStart, reducedMotion]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ 
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 700ms ease-in-out',
      }}
    >
      {/* Radial gradient background pulse */}
      <div 
        className="absolute inset-0 animate-pulse-slow"
        style={{
          background: 'radial-gradient(circle at center, rgba(139,92,246,0.15) 0%, transparent 70%)',
        }}
      />
      
      {/* Vortex container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Swirling tags */}
        {(phase === 'swirl' || isSwirlExiting) && !reducedMotion && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={isSwirlExiting ? { transition: 'opacity 600ms ease-out', opacity: 0 } : undefined}
          >
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="absolute pointer-events-none select-none"
                style={{
                  opacity: 0,
                  animation: `vortexOrbit ${tag.duration}s cubic-bezier(0.33, 0, 0.2, 1) forwards`,
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
                      ? 'rgba(139,92,246,0.35)'
                      : 'rgba(120,113,108,0.2)',
                    color: tag.isSelected ? '#e9d5ff' : '#a8a29e',
                    border: `2px solid ${tag.isSelected ? 'rgba(139,92,246,0.6)' : 'rgba(120,113,108,0.3)'}`,
                    boxShadow: tag.isSelected 
                      ? '0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.2)' 
                      : 'none',
                  }}
                >
                  {formatTag(tag.label)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Converge phase: selected tags drift to center */}
        {phase === 'converge' && !reducedMotion && (
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
                      backgroundColor: 'rgba(139,92,246,0.4)',
                      color: '#e9d5ff',
                      border: '2px solid rgba(139,92,246,0.7)',
                      boxShadow: '0 0 25px rgba(139,92,246,0.5), 0 0 50px rgba(139,92,246,0.3)',
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
            {/* Glowing orb behind tags */}
            <div 
              className="absolute w-96 h-96 rounded-full animate-pulse-glow"
              style={{
                background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            
            <div className="relative flex flex-wrap justify-center gap-2.5 mb-8 max-w-2xl">
              {selectedTags.map((tag, i) => (
                <div
                  key={`reveal-${i}-${tag}`}
                  className="px-4 py-2 rounded-full text-base font-bold animate-revealScale"
                  style={{
                    animationDelay: `${i * 0.06}s`,
                    backgroundColor: 'rgba(139,92,246,0.45)',
                    color: '#f3e8ff',
                    border: '2px solid rgba(139,92,246,0.7)',
                    boxShadow: '0 0 30px rgba(139,92,246,0.6), 0 0 60px rgba(139,92,246,0.3), inset 0 0 20px rgba(139,92,246,0.2)',
                  }}
                >
                  {formatTag(tag)}
                </div>
              ))}
            </div>
            
            <div className="relative flex flex-col items-center gap-3 animate-revealText">
              <div className="relative">
                <Dices className="w-8 h-8 text-violet-200 animate-dice-spin" />
                <div 
                  className="absolute inset-0 animate-ping-slow"
                  style={{
                    background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)',
                    filter: 'blur(10px)',
                  }}
                />
              </div>
              <span className="text-2xl font-bold text-violet-100 tracking-wide" style={{
                textShadow: '0 0 20px rgba(139,92,246,0.8), 0 0 40px rgba(139,92,246,0.4)',
              }}>
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
            transform: scale(0.05) rotate(0deg);
            filter: blur(8px);
          }
          15% {
            opacity: 0.4;
            filter: blur(3px);
          }
          30% {
            opacity: 1;
            transform: scale(1) rotate(360deg);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(1080deg);
            filter: blur(0px);
          }
        }
        @keyframes vortexReject {
          0% {
            opacity: 0.6;
            filter: blur(0px);
          }
          50% {
            opacity: 0.3;
            filter: blur(2px);
          }
          100% {
            opacity: 0;
            transform: translateX(800px) translateY(400px) rotate(1080deg) scale(0.1);
            filter: blur(4px);
          }
        }
        @keyframes vortexConverge {
          0% {
            opacity: 0.8;
            filter: blur(0px);
          }
          50% {
            opacity: 0.9;
            transform: translateX(0) translateY(0) scale(1.15);
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        @keyframes revealScale {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-10deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) rotate(2deg);
          }
          70% {
            transform: scale(0.95) rotate(-1deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes revealText {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.9);
          }
          60% {
            opacity: 1;
            transform: translateY(-5px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2);
          }
        }
        @keyframes ping-slow {
          0% {
            opacity: 0.8;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(2.5);
          }
        }
        @keyframes dice-spin {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(90deg) scale(1.1);
          }
          50% {
            transform: rotate(180deg);
          }
          75% {
            transform: rotate(270deg) scale(1.1);
          }
        }
        .animate-revealScale {
          animation: revealScale 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        .animate-revealText {
          animation: revealText 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards;
          opacity: 0;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 2s ease-out infinite;
        }
        .animate-dice-spin {
          animation: dice-spin 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
