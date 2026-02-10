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
    title: 'Zoggy & Export',
    subtitle: 'Chat with your AI assistant — and ship your cards',
    description:
      'Zoggy is CharacterVault\'s built-in chat assistant. Add sections to the AI Context panel so Zoggy can read your card and give tailored advice. When you\'re done, export as PNG with embedded data or raw JSON.',
    features: [
      { icon: MessageCircle, label: 'Ask Zoggy', detail: 'Chat about best practices, get help writing sections, or brainstorm character ideas' },
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
}

export function WelcomeTutorial({ onComplete }: WelcomeTutorialProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

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
      className={`fixed inset-0 z-100 flex items-center justify-center transition-all duration-500
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-vault-950/80 dark:bg-black/85 tutorial-backdrop"
        onClick={handleSkip}
      />

      {/* Content Card */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-4 transition-all duration-500 ease-out
          ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
      >
        {/* Skip button */}
        {!isLast && (
          <button
            onClick={handleSkip}
            className="absolute -top-10 sm:-top-12 right-0 flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium
              text-vault-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <span>Skip tutorial</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Main Card */}
        <div className="bg-white dark:bg-vault-900 rounded-2xl shadow-2xl border border-vault-200 dark:border-vault-800 overflow-hidden tutorial-card-enter">
          
          {/* Header band with accent */}
          <div className="relative px-5 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6 overflow-hidden">
            {/* Decorative accent background */}
            <div className="absolute -top-2 -right-1 w-24 h-24 sm:w-40 sm:h-40 opacity-[0.06] dark:opacity-[0.08] tutorial-float rotate-15 pointer-events-none" style={{ animationDelay: '1.2s' }}>
              <AccentIcon className="w-full h-full" strokeWidth={1.5} />
            </div>

            {/* Shimmer accent */}
            <div className="absolute inset-0 tutorial-shimmer pointer-events-none" />

            {/* Step indicator pills */}
            <div className="flex items-center gap-1.5 mb-6 relative">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full tutorial-dot
                    ${i === currentStep
                      ? 'w-8 bg-vault-900 dark:bg-vault-100'
                      : i < currentStep
                        ? 'w-3 bg-vault-400 dark:bg-vault-500'
                        : 'w-3 bg-vault-200 dark:bg-vault-700'
                    }`}
                />
              ))}
              <span className="ml-auto text-xs font-medium text-vault-400 dark:text-vault-500 tabular-nums">
                {currentStep + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>

            {/* Title area with transition */}
            <div className={`tutorial-step-content ${stepContentClass}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-vault-400 dark:text-vault-500 mb-2">
                {step.subtitle}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-vault-900 dark:text-vault-50 tracking-tight">
                {step.title}
              </h2>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 pb-5 sm:px-8 sm:pb-6">
            <div className={`tutorial-step-content ${stepContentClass}`}>
              <p className="text-vault-600 dark:text-vault-400 text-[15px] leading-relaxed mb-6">
                {step.description}
              </p>

              {/* Feature cards */}
              <div className="grid gap-3">
                {step.features.map((feature, idx) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <div
                      key={`${step.id}-${idx}`}
                      className="tutorial-feature-card group flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl
                        bg-vault-50 dark:bg-vault-800/60
                        border border-vault-100 dark:border-vault-800
                        hover:border-vault-300 dark:hover:border-vault-600"
                      style={{
                        opacity: isAnimating ? 0 : 1,
                        transform: isAnimating ? 'translateY(8px)' : 'translateY(0)',
                      }}
                    >
                      <div className="shrink-0 p-2.5 rounded-lg bg-vault-200/70 dark:bg-vault-700/50
                        group-hover:bg-vault-900 dark:group-hover:bg-vault-100
                        transition-colors duration-200">
                        <FeatureIcon className="w-4 h-4 text-vault-600 dark:text-vault-300
                          group-hover:text-white dark:group-hover:text-vault-900
                          transition-colors duration-200" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-vault-900 dark:text-vault-100 mb-0.5">
                          {feature.label}
                        </h4>
                        <p className="text-xs text-vault-500 dark:text-vault-400 leading-relaxed">
                          {feature.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer / Navigation */}
          <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-vault-100 dark:border-vault-800 bg-vault-50/50 dark:bg-vault-800/30 flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${isFirst
                  ? 'text-vault-300 dark:text-vault-700 cursor-not-allowed'
                  : 'text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 active:scale-95'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={isLast ? handleComplete : handleNext}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg
                bg-vault-900 dark:bg-vault-100 text-white dark:text-vault-900
                hover:opacity-90 active:scale-95
                shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isLast ? (
                <>
                  Get Started
                  <Rocket className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if the tutorial has been completed before.
 */
export function isTutorialCompleted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Reset the tutorial so it shows again.
 */
export function resetTutorial(): void {
  localStorage.removeItem(STORAGE_KEY);
}
