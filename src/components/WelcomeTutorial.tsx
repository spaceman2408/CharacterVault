/**
 * @fileoverview Welcome tutorial overlay for first-time users.
 * Multi-step animated walkthrough explaining CharacterVault's features.
 * @module @components/WelcomeTutorial
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Users,
  Upload,
  Plus,
  Type,
  Image,
  MessageCircle,
  Download,
  Sparkles,
  Rocket,
  ChevronRight,
  ChevronLeft,
  X,
  BookOpen,
  PenTool,
  Book,
  Zap,
  ExternalLink,
  History,
  Bot,
  Link,
  Map,
  Archive,
} from 'lucide-react';
import './tutorial.css';

interface TutorialStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  features: { icon: React.ElementType; label: string; detail: string }[];
  accentIcon: React.ElementType;
  showSillyTavernCallout?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 0,
    title: 'Welcome to CharacterVault',
    subtitle: 'Character cards and lorebooks, in the browser',
    description:
      'CharacterVault is your workspace for SillyTavern-compatible V2 and V3 character cards and World Info lorebooks. Cards and books are stored locally in your browser. No account is required for core use.',
    features: [
      { icon: Users, label: 'Your vault', detail: 'Two libraries on the home screen (Characters and Lorebooks) with search by name or tags' },
      { icon: PenTool, label: 'Tabbed editor', detail: 'Dedicated tabs for every card field, with auto-save as you type' },
      { icon: Sparkles, label: 'AI when you want it', detail: 'Toolbar, Orion chat, and an Agent that can write the open card or book, after you add a provider in Settings' },
    ],
    accentIcon: BookOpen,
  },
  {
    id: 1,
    title: 'Your vault',
    subtitle: 'Characters, lorebooks, and ways to start',
    description:
      'The home screen has a Characters tab and a Lorebooks tab. Search, import existing files, create a blank item, or generate a card with AI Create. You can also drag and drop files onto the vault.',
    features: [
      { icon: Upload, label: 'Import', detail: 'PNG cards with embedded data, character JSON, or lorebook JSON. Multiple files and drag-and-drop are supported' },
      { icon: Plus, label: 'New / AI Create', detail: 'Start from a blank template, or open AI Creation Studio from the header to generate a card from a concept or tags' },
      { icon: Download, label: 'Backup', detail: 'Download a ZIP of your characters and lorebooks from the vault header' },
      { icon: ExternalLink, label: 'SillyTavern extension', detail: 'Install the companion extension and export choosing "CharacterVault" to send cards here' },
    ],
    accentIcon: Upload,
    showSillyTavernCallout: true,
  },
  {
    id: 2,
    title: 'Edit in sections',
    subtitle: 'Every field has its own tab',
    description:
      'Open a character to enter the workspace. Tabs cover name, description, personality, scenario, greetings, examples, system prompt, lorebook, and more. Changes save automatically. Each text section uses a focused editor with search and replace.',
    features: [
      { icon: Type, label: 'Core fields', detail: 'Name, Description, Personality, Scenario, First Message, Greetings, Examples, System Prompt, and the rest of the spec' },
      { icon: Image, label: 'Image', detail: 'Upload or replace the portrait on the Image tab' },
      { icon: Book, label: 'Card lorebook', detail: 'Manage World Info entries on the card (keys, priority, position, and content) with the same editor used for vault books' },
    ],
    accentIcon: PenTool,
  },
  {
    id: 3,
    title: 'Three AI tools',
    subtitle: 'Configure a provider, then pick the tool',
    description:
      'Open Settings (gear in the workspace) and add a provider under AI Config. After that you have three tools: an inline toolbar, Orion for chat, and an Agent that can edit the open character or lorebook.',
    features: [
      { icon: Zap, label: 'Toolbar', detail: 'Select text in the editor to enhance, rephrase, shorten, lengthen, fix grammar, or run a custom instruction. Streamed results can be accepted or rejected' },
      { icon: MessageCircle, label: 'Orion', detail: 'Open the Ask AI panel to brainstorm and draft in chat. Pin card sections in AI Context. Orion does not change the card unless you copy from it' },
      { icon: Bot, label: 'Agent', detail: 'Toggle Agent in the Ask AI header. It reads and writes the open character or lorebook. Changes land when the run finishes; a snapshot is taken first' },
    ],
    accentIcon: Sparkles,
  },
  {
    id: 4,
    title: 'Lorebook vault',
    subtitle: 'Standalone World Info, linked if you want',
    description:
      'The Lorebooks tab is a second library for standalone World Info books, each with its own workspace. You can link one book to many characters so edits stay in sync. Card export still uses the lorebook stored on the card.',
    features: [
      { icon: Book, label: 'Library', detail: 'Create, import, export, and duplicate standalone lorebooks from the Lorebooks tab' },
      { icon: Link, label: 'Link to characters', detail: 'Open in vault from a character to attach a library book. Edits in the lorebook workspace update every linked character' },
      { icon: Map, label: 'Recursion map', detail: 'Open Map in the lorebook editor to see unlock paths between entries' },
    ],
    accentIcon: Book,
  },
  {
    id: 5,
    title: 'Snapshots and export',
    subtitle: 'Roll back, then ship',
    description:
      'Use History in the workspace to save snapshots and restore a full card, individual sections, or a standalone lorebook. When you are ready, export a single card or back up the whole vault.',
    features: [
      { icon: History, label: 'Snapshots', detail: 'Save a point in time and roll back later: full card, selected sections, or the open lorebook' },
      { icon: Download, label: 'Export', detail: 'Save a PNG with embedded card data, or the raw JSON. Lorebooks export as JSON' },
      { icon: Archive, label: 'Backup', detail: 'From the vault header, download a ZIP of characters and lorebooks' },
    ],
    accentIcon: History,
  },
  {
    id: 6,
    title: 'You\'re all set!',
    subtitle: 'Start building',
    description:
      'That\'s the orientation. Replay this walkthrough anytime with the help icon in the header, or open the docs from the book icon. Cards and lorebooks stay in your browser. Optional AI calls go to the provider you configure.',
    features: [
      { icon: Rocket, label: 'Get started', detail: 'Create a character, import a card, or use AI Create' },
      { icon: BookOpen, label: 'Replay tutorial', detail: 'Click the help icon (?) in the header bar anytime' },
      { icon: Users, label: 'Your data', detail: 'Cards and lorebooks stay local. No sign-up for core use. AI is optional and uses your provider' },
    ],
    accentIcon: Rocket,
  },
];

const STORAGE_KEY = 'charactervault-tutorial-completed';

// --- Component ---

interface WelcomeTutorialProps {
  onComplete: () => void;
  skipEntranceAnimation?: boolean;
}

export function WelcomeTutorial({ onComplete, skipEntranceAnimation = false }: WelcomeTutorialProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(skipEntranceAnimation);

  // Entrance animation (skipped on initial page load to prevent flash)
  useEffect(() => {
    if (skipEntranceAnimation) return;
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, [skipEntranceAnimation]);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  const animateTransition = useCallback((newStep: number, dir: 'next' | 'prev') => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(dir);

    setTimeout(() => {
      setCurrentStep(newStep);
      setIsAnimating(false);
    }, 250);
  }, [isAnimating]);

  const handleNext = useCallback(() => {
    if (!isLast) animateTransition(currentStep + 1, 'next');
  }, [currentStep, isLast, animateTransition]);

  const handlePrev = useCallback(() => {
    if (!isFirst) animateTransition(currentStep - 1, 'prev');
  }, [currentStep, isFirst, animateTransition]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    setTimeout(onComplete, 400);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) handleComplete();
        else handleNext();
      }
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNext, handlePrev, handleComplete, handleSkip, isLast]);

  const AccentIcon = step.accentIcon;

  // Compute animation classes for step content
  const stepContentClass = isAnimating
    ? direction === 'next'
      ? 'tutorial-step-exiting-next'
      : 'tutorial-step-exiting-prev'
    : 'tutorial-step-entering';

  return (
    <div
      className={`fixed inset-0 z-100 flex items-start sm:items-center justify-center transition-all duration-500 overflow-y-auto
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay tutorial-backdrop"
        onClick={handleSkip}
      />

      {/* Content Card Container - handles scrolling */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-4 my-2 sm:my-8 transition-all duration-500 ease-out
          ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
      >
        {/* Main Card - max height with scroll on mobile */}
        <div className="bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden tutorial-card-enter max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col">
          
          {/* Header band with accent */}
          <div className="relative px-4 pt-3 pb-3 sm:px-8 sm:pt-8 sm:pb-6 overflow-hidden shrink-0">
            {/* Skip button - inside card header on mobile */}
            {!isLast && (
              <button
                onClick={handleSkip}
                className="absolute top-2 right-10 sm:top-4 sm:right-16 z-20 flex items-center gap-1 px-2 py-1 text-xs font-medium text-fg-subtle hover:text-fg transition-colors rounded-lg hover:bg-hover"
              >
                <span>Skip</span>
                <X className="w-3 h-3" />
              </button>
            )}
            {/* Decorative accent background */}
            <div className="absolute -top-2 -right-1 w-24 h-24 sm:w-40 sm:h-40 opacity-[0.06] dark:opacity-[0.08] tutorial-float rotate-15 pointer-events-none z-0" style={{ animationDelay: '1.2s' }}>
              <AccentIcon className="w-full h-full" strokeWidth={1.5} />
            </div>

            {/* Shimmer accent */}
            <div className="absolute inset-0 tutorial-shimmer pointer-events-none" />

            {/* Step indicator pills */}
            <div className="flex items-center gap-1.5 mb-4 sm:mb-6 relative">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full tutorial-dot
                    ${i === currentStep
                      ? 'w-8 bg-accent'
                      : i < currentStep
                        ? 'w-3 bg-fg-subtle'
                        : 'w-3 bg-hover'
                    }`}
                />
              ))}
              <span className="ml-auto text-xs font-medium text-fg-subtle tabular-nums">
                {currentStep + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>

            {/* Title area with transition */}
            <div className={`tutorial-step-content ${stepContentClass}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-fg-subtle mb-2">
                {step.subtitle}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight">
                {step.title}
              </h2>
            </div>
          </div>

          {/* Body - scrollable on mobile */}
          <div className="px-4 pb-4 sm:px-8 sm:pb-6 overflow-y-auto">
            <div className={`tutorial-step-content ${stepContentClass}`}>
              <p className="text-fg-muted text-sm sm:text-[15px] leading-relaxed mb-4 sm:mb-6">
                {step.description}
              </p>

              {/* Feature cards */}
              <div className="grid gap-2 sm:gap-3">
                {step.features.map((feature, idx) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <div
                      key={`${step.id}-${idx}`}
                      className="tutorial-feature-card group flex items-start gap-2.5 sm:gap-4 p-2.5 sm:p-4 rounded-lg sm:rounded-xl bg-muted border border-border hover:border-border-strong"
                      style={{
                        opacity: isAnimating ? 0 : 1,
                        transform: isAnimating ? 'translateY(8px)' : 'translateY(0)',
                      }}
                    >
                      <div className="shrink-0 p-2 sm:p-2.5 rounded-md sm:rounded-lg bg-hover group-hover:bg-accent transition-colors duration-200">
                        <FeatureIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fg-muted group-hover:text-accent-fg transition-colors duration-200" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-fg mb-0.5">
                          {feature.label}
                        </h4>
                        <p className="text-xs text-fg-muted leading-relaxed">
                          {feature.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {step.showSillyTavernCallout && (
                <div className="mt-3 sm:mt-4 relative flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl overflow-hidden bg-linear-to-r from-amber-900/80 via-yellow-800/80 to-amber-900/80 dark:from-amber-900/60 dark:via-yellow-700/50 dark:to-amber-900/60 border border-amber-500/30 shadow-[0_0_24px_-4px_rgba(251,191,36,0.3)]">
                  {/* Golden shimmer sweep */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 big-linear-to-r from-transparent via-amber-200/30 to-transparent animate-[golden-shimmer_2s_linear_infinite]" />
                  </div>
                  {/* Glow dots */}
                  <div className="absolute -top-3 -right-3 w-12 h-12 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />
                  <div className="absolute -bottom-3 -left-3 w-8 h-8 bg-yellow-300/15 rounded-full blur-md pointer-events-none" />

                  <Zap className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 fill-amber-300 shrink-0 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                  <span className="relative text-xs sm:text-sm text-amber-50 font-semibold leading-tight">
                    SillyTavern integration! Import cards directly!
                  </span>
                  <a
                    href="https://github.com/spaceman2408/SillyTavern-CharacterVaultExport"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative shrink-0 ml-auto p-1.5 text-amber-300 hover:text-white hover:bg-surface/10 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <style>{`
                    @keyframes golden-shimmer {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(200%); }
                    }
                  `}</style>
                </div>
              )}
            </div>
          </div>

          {/* Footer / Navigation */}
          <div className="px-4 py-3 sm:px-8 sm:py-5 border-t border-border bg-muted flex items-center justify-between shrink-0">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className={`flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200
                ${isFirst
                  ? 'text-fg-subtle cursor-not-allowed'
                  : 'text-fg-muted hover:bg-hover active:scale-95'
                }`}
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <button
              onClick={isLast ? handleComplete : handleNext}
              className="flex items-center gap-1.5 sm:gap-2 px-4 py-1.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-accent text-accent-fg hover:opacity-90 active:scale-95 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isLast ? (
                <>
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Start</span>
                  <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tutorial utility functions are attached to the component
// to avoid breaking React Fast Refresh (no non-component exports allowed)
WelcomeTutorial.isCompleted = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) === 'true';
};

WelcomeTutorial.reset = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
