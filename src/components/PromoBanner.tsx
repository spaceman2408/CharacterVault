/**
 * @fileoverview Promo banner component for SillyTavern companion extension.
 * @module components/PromoBanner
 */

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Zap } from 'lucide-react';

const GITHUB_URL = 'https://github.com/spaceman2408/SillyTavern-CharacterVaultExport';

interface PromoBannerProps {
  onDismiss?: () => void;
}

function AnimatedBackground(): React.ReactElement {
  return (
    <>
      <div className="absolute inset-0 big-linear-to-br from-vault-800 via-vault-900 to-black" />

      <div
        className="absolute -top-20 -right-20 w-40 h-40 bg-vault-500/20 rounded-full blur-3xl"
        style={{ animation: 'float-1 8s ease-in-out infinite' }}
      />
      <div
        className="absolute -bottom-20 -left-10 w-32 h-32 bg-vault-400/15 rounded-full blur-3xl"
        style={{ animation: 'float-2 10s ease-in-out infinite' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-vault-600/10 rounded-full blur-3xl"
        style={{ animation: 'pulse-glow 6s ease-in-out infinite' }}
      />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black, transparent)',
        }}
      >
        <div
          className="absolute inset-0 big-linear-to-r from-transparent via-white/[0.07] to-transparent"
          style={{ animation: 'shimmer-sweep 4s ease-in-out infinite' }}
        />
      </div>
    </>
  );
}

export function PromoBanner({ onDismiss }: PromoBannerProps): React.ReactElement {
  const [hasEntered, setHasEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  };

  const handleLinkClick = () => {
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`
        w-full
        transition-all duration-300 ease-out
        ${hasEntered && !isExiting ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
      `}
    >
      <div
        className="relative rounded-2xl p-5 text-white shadow-2xl overflow-hidden isolate"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        <AnimatedBackground />

        <button
          onClick={handleDismiss}
          className="
            absolute top-3 right-3 z-20
            p-1.5 rounded-lg
            text-white/50 hover:text-white
            hover:bg-surface/10
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-white/30
          "
          title="Dismiss"
          aria-label="Dismiss promotional banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/10 border border-white/10"
              style={{ animation: 'badge-pulse 2s ease-in-out infinite' }}
            >
              <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
              <span className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">
                New
              </span>
            </div>
          </div>

          <h3 className="text-xl font-bold mb-2 leading-tight big-linear-to-r from-white to-vault-200 bg-clip-text text-transparent">
            SillyTavern Extension
          </h3>

          <p className="text-sm text-vault-100/70 mb-5 leading-relaxed">
            Import your cards straight from SillyTavern with this companion extension.
          </p>

          <button
            onClick={handleLinkClick}
            className="
              group relative w-full
              flex items-center justify-center gap-2
              px-4 py-3
              bg-surface text-fg
              rounded-xl
              font-semibold text-sm
              overflow-hidden
              transition-transform duration-150 ease-out
              hover:scale-[1.02]
              active:scale-[0.97]
              focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-vault-900
            "
          >
            <span
              className="absolute inset-0 big-linear-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            />

            <span className="relative transition-transform duration-150 ease-out group-hover:translate-x-0.5">Get Extension</span>
            <ExternalLink className="relative w-4 h-4 transition-all duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <p className="mt-4 text-[10px] text-fg-subtle/60 text-center">
            Free & open source
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer-sweep {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }

        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -10px) scale(1.1); }
          66% { transform: translate(-10px, 10px) scale(0.95); }
        }

        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15px, -20px) scale(1.05); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.2); }
        }

        @keyframes badge-pulse {
          0%, 100% { opacity: 0.8; box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.3); }
          50% { opacity: 1; box-shadow: 0 0 0 4px rgba(251, 191, 36, 0); }
        }
      `}</style>
    </div>
  );
}

export default PromoBanner;
