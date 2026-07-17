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
  FileText,
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
  Wand2,
  PenTool,
  Book,
  Zap,
  Palette,
  ScrollText,
  ExternalLink,
} from 'lucide-react';
import './tutorial.css';

// --- Tutorial Step Data ---

interface TutorialStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  features: { icon: React.ElementType; label: string; detail: string }[];
  accentIcon: React.ElementType;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 0,
    title: 'Welcome to CharacterVault',
    subtitle: 'Your distraction-free character card workshop',
    description:
      'CharacterVault is your all-in-one workspace for creating, editing, and managing character spec cards. Built for SillyTavern and compatible platforms — supporting both V2 and V3 card formats out of the box.',
    features: [
      { icon: Users, label: 'Your Library', detail: 'Manage your entire character collection in one place, stored locally in your browser' },
      { icon: PenTool, label: 'Full-Featured Editor', detail: 'Section-based editing with dedicated tabs for every card field' },
      { icon: Sparkles, label: 'AI-Powered Tools', detail: 'Built-in AI toolbar and chat assistant to help craft your characters' },
    ],
    accentIcon: BookOpen,
  },
  {
    id: 1,
    title: 'Import or Create',
    subtitle: 'Start with what you have — or from scratch',
    description:
      'Bring in your existing character cards or start fresh. CharacterVault reads V2 and V3 PNG cards with embedded metadata, as well as raw JSON files. Click "Import" in the header or the "+ New" button to get started.',
    features: [
      { icon: Upload, label: 'Import Cards', detail: 'Import PNG cards with embedded data or raw JSON character files' },
      { icon: Plus, label: 'Create New', detail: 'Start fresh with a blank character template and build from scratch' },
      { icon: FileText, label: 'V2 & V3 Support', detail: 'Full compatibility with both character card specifications' },
      { icon: ExternalLink, label: 'SillyTavern Extension', detail: 'Import straight from SillyTavern with the companion extension. Install the extension, export choosing "CharacterVault"' },
    ],
    accentIcon: Upload,
  },
  {
    id: 2,
    title: 'Edit Your Character',
    subtitle: 'Every field organized in dedicated sections',
    description:
      'Navigate through tabs for each part of your character card. Every section has a focused CodeMirror editor with search & replace so you can work without distractions.',
    features: [
      { icon: Type, label: 'Core Sections', detail: 'Name, Description, Personality, Scenario, First Message, Example Messages, System Prompt, and more' },
      { icon: Image, label: 'Image', detail: 'Upload or drag & drop your character\'s portrait image directly' },
      { icon: Book, label: 'Lorebook', detail: 'Built-in lorebook editor — manage entries with trigger keys, priority, position, and AI-assisted content' },
    ],
    accentIcon: PenTool,
  },
  {
    id: 3,
    title: 'AI Writing Tools',
    subtitle: 'Your editing suite, supercharged',
    description:
      'Select any text in the editor to reveal the AI toolbar. Use one-click operations to transform your writing, or give custom instructions. All AI results stream in real-time and can be accepted or rejected.',
    features: [
      { icon: Zap, label: 'Enhance & Rephrase', detail: 'Expand your text with more depth, or rephrase for better clarity and flow' },
      { icon: Palette, label: 'Style Polish', detail: 'Make text more Vivid, add Emotion, Shorten, Lengthen, or Fix Grammar — all one click' },
      { icon: Wand2, label: 'Custom Instructions', detail: 'Type any instruction and the AI applies it to your selected text' },
    ],
    accentIcon: Sparkles,
  },
  {
    id: 4,
    title: 'Orion & Export',
    subtitle: 'Chat with your AI assistant — and ship your cards',
    description:
      'Orion is CharacterVault\'s built-in chat assistant. Add sections to the AI Context panel so Orion can read your card and give tailored advice. When you\'re done, export as PNG with embedded data or raw JSON.',
    features: [
      { icon: MessageCircle, label: 'Ask Orion', detail: 'Chat about best practices, get help writing sections, or brainstorm character ideas' },
      { icon: ScrollText, label: 'AI Context', detail: 'Pin card sections to context so the AI has full awareness of your character' },
      { icon: Download, label: 'Export', detail: 'Save as a PNG with embedded card data, or export the raw JSON file' },
    ],
    accentIcon: MessageCircle,
  },
  {
    id: 5,
    title: 'You\'re All Set!',
    subtitle: 'Start building your characters',
    description:
      'That\'s everything you need to know. Your characters are stored locally in your browser — private and always available. You can replay this tutorial anytime by clicking the help icon in the header bar.',
    features: [
      { icon: Rocket, label: 'Get Started', detail: 'Create your first character or import an existing card' },
      { icon: BookOpen, label: 'Replay Tutorial', detail: 'Click the help icon (?) in the header bar anytime' },
      { icon: Users, label: 'Your Data, Your Control', detail: 'Everything stays local in your browser — no servers, no sign-up required' },
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
                className="absolute top-2 right-10 sm:top-4 sm:right-16 z-20 flex items-center gap-1 px-2 py-1 text-xs font-medium
                  text-fg-subtle hover:text-fg transition-colors rounded-lg hover:bg-hover"
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
                      className="tutorial-feature-card group flex items-start gap-2.5 sm:gap-4 p-2.5 sm:p-4 rounded-lg sm:rounded-xl
                        bg-muted
                        border border-border
                        hover:border-border-strong"
                      style={{
                        opacity: isAnimating ? 0 : 1,
                        transform: isAnimating ? 'translateY(8px)' : 'translateY(0)',
                      }}
                    >
                      <div className="shrink-0 p-2 sm:p-2.5 rounded-md sm:rounded-lg bg-hover
                        group-hover:bg-accent
                        transition-colors duration-200">
                        <FeatureIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fg-muted
                          group-hover:text-accent-fg
                          transition-colors duration-200" />
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

              {/* SillyTavern integration callout - step 0 only */}
              {step.id === 0 && (
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
          <div className="px-4 py-3 sm:px-8 sm:py-5 border-t border-border bg-muted/50 bg-muted flex items-center justify-between shrink-0">
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
              className="flex items-center gap-1.5 sm:gap-2 px-4 py-1.5 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg
                bg-accent text-accent-fg
                hover:opacity-90 active:scale-95
                shadow-sm hover:shadow-md transition-all duration-200"
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
