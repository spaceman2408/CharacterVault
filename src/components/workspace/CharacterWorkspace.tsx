/**
 * @fileoverview Character workspace for editing character cards with AI integration.
 * Updated with docked side panels for AI Context and Ask AI.
 * @module @components/workspace/CharacterWorkspace
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterContext, CharacterEditorProvider, useCharacterEditorContext } from '../../context';
import type { CharacterSection, SectionMeta } from '../../db/characterTypes';
import { generateThumbnail } from '../../utils/thumbnail';
import { SectionEditor } from '../editor/SectionEditor';
import { ContextPanel } from '../ai/ContextPanel';
import { AIChatPanel } from '../ai/AIChatPanel';
import { CharacterSettingsPanel } from '../settings/CharacterSettingsPanel';
import { CharacterHistoryModal } from '../history/CharacterHistoryModal';
import { characterExportService } from '../../services/CharacterExportService';
import {
  ArrowLeft,
  Check,
  Image,
  Type,
  FileText,
  User,
  Map,
  MessageCircle,
  MessagesSquare,
  Terminal,
  History,
  Eye,
  Puzzle,
  Download,
  Trash2,
  Upload,
  Settings,
  Link,
  NotebookPen,
  UserCircle,
  Tag,
  Tags,
  PanelLeft,
  PanelRight,
  Sparkles,
  MessageSquare,
  ChevronDown,
  Book,
  AlertCircle,
  X,
  FileJson,
  Image as ImageIcon,
} from 'lucide-react';

interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'error';
  title: string;
  message: string;
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastNotification[];
  onRemove: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ring-1 ring-border/40 transition-all duration-300 animate-in slide-in-from-right backdrop-blur-sm ${
            toast.type === 'success'
              ? 'border-success/40 bg-success-soft text-success-soft-fg'
              : toast.type === 'error'
                ? 'border-danger/40 bg-danger-soft text-danger-soft-fg'
                : 'border-warning/40 bg-warning-soft text-warning-soft-fg'
          }`}
        >
          <div className={`mt-0.5 rounded-full p-1 ${
            toast.type === 'success'
              ? 'bg-success-soft text-success-soft-fg'
              : toast.type === 'error'
                ? 'bg-danger-soft text-danger-soft-fg'
                : 'bg-warning-soft text-warning-soft-fg'
          }`}>
            {toast.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="text-sm opacity-90">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(toast.id)}
            className="rounded p-1 hover:bg-hover"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  Image,
  Type,
  FileText,
  User,
  Map,
  MessageCircle,
  MessagesSquare,
  Terminal,
  History,
  Eye,
  Puzzle,
  Link,
  NotebookPen,
  UserCircle,
  Tag,
  Tags,
  Book,
};

/**
 * Horizontal Section Tabs component - Tabs above the editor
 */
interface SectionTabsProps {
  activeSection: CharacterSection;
  onSectionChange: (section: CharacterSection) => void;
  sections: SectionMeta[];
}

function SectionTabs({ activeSection, onSectionChange, sections }: SectionTabsProps): React.ReactElement {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);
  const desktopTabsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = desktopTabsRef.current;
    if (!container) return;

    const handleDesktopTabsWheel = (event: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) return;

      const horizontalDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (horizontalDelta === 0) return;

      event.preventDefault();
      container.scrollLeft += horizontalDelta;
    };

    // React's wheel event can be passive depending on runtime/build; attach native listener so preventDefault is legal.
    container.addEventListener('wheel', handleDesktopTabsWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleDesktopTabsWheel);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking inside the dropdown button or the portal content
      const isInsideDropdown = dropdownRef.current?.contains(target);
      const isInsidePortal = portalRef.current?.contains(target);
      
      if (!isInsideDropdown && !isInsidePortal) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDropdownOpen]);

  const activeSectionData = sections.find(s => s.id === activeSection);
  const ActiveIcon = activeSectionData ? iconMap[activeSectionData.icon] || FileText : FileText;

  return (
    <div className="border-b border-border bg-surface/60 backdrop-blur-xl shrink-0">
      {/* Desktop: Horizontal tabs */}
      <div
        ref={desktopTabsRef}
        className="hidden md:block overflow-x-auto scrollbar-thin"
      >
        <div className="flex items-center gap-1 px-4 py-2 w-max mx-auto">
          {sections.map((section) => {
            const Icon = iconMap[section.icon] || FileText;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-accent text-accent-fg shadow-sm' 
                    : 'text-fg-muted hover:bg-accent-soft hover:text-accent'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: Dropdown */}
      <div className="md:hidden relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-accent-soft transition-colors"
        >
          <div className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-accent" />
            <span className="font-medium text-fg">
              {activeSectionData?.label || 'Select Section'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && createPortal(
          <div 
            ref={portalRef}
            className="fixed inset-x-0 top-26.25 z-9999 bg-surface border-b border-border shadow-lg max-h-[50vh] overflow-y-auto md:hidden"
          >
            {sections.map((section) => {
              const Icon = iconMap[section.icon] || FileText;
              const isActive = activeSection === section.id;
              
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSectionChange(section.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors
                    ${isActive 
                      ? 'bg-accent-soft text-accent font-medium' 
                      : 'text-fg-muted hover:bg-accent-soft hover:text-accent'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : ''}`} />
                  {section.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

/**
 * ImageEditor component - For image section
 */
function ImageEditor(): React.ReactElement {
  const { currentCharacter, updateCharacter } = useCharacterEditorContext();
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (currentCharacter && result) {
        const thumbnailData = await generateThumbnail(result);
        void updateCharacter({ imageData: result, thumbnailData });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-fg">Character Image</h2>
      
      {/* Image Preview */}
      <div className="flex justify-center">
        {currentCharacter?.imageData ? (
          <div className="relative group">
            <img
              src={currentCharacter.imageData}
              alt={currentCharacter.name}
              className="w-96 h-96 max-w-full max-h-[60vh] object-contain rounded-2xl border-2 border-border shadow-lg"
            />
            <button
              onClick={() => currentCharacter && void updateCharacter({ imageData: '', thumbnailData: '' })}
              className="absolute top-2 right-2 p-2 bg-danger hover:opacity-90 text-white rounded-lg
                opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`w-96 h-96 max-w-full max-h-[60vh] rounded-2xl border-2 border-dashed 
              ${isDragging 
                ? 'border-accent bg-muted/50' 
                : 'border-border-strong bg-bg/30'
              }
              flex flex-col items-center justify-center gap-3 transition-colors duration-200`}
          >
            <Image className="w-16 h-16 text-fg-subtle" />
            <p className="text-sm text-fg-muted text-center px-4">
              Drag and drop an image here<br />or click to browse
            </p>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div className="flex justify-center">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-fg hover:opacity-90 
            text-white rounded-xl font-medium transition-colors duration-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            {currentCharacter?.imageData ? 'Change Image' : 'Upload Image'}
          </span>
        </label>
      </div>
    </div>
  );
}

/**
 * CharacterHeader component - Header with character info and actions
 */
interface CharacterHeaderProps {
  onOpenSettings: () => void;
  onOpenRevisions: () => void;
  isContextOpen: boolean;
  isChatOpen: boolean;
  onToggleContext: () => void;
  onToggleChat: () => void;
  isMobile: boolean;
}

function CharacterHeader({ 
  onOpenSettings, 
  onOpenRevisions,
  isContextOpen, 
  isChatOpen, 
  onToggleContext, 
  onToggleChat,
  isMobile 
}: CharacterHeaderProps): React.ReactElement {
  const { currentCharacter, closeCharacter } = useCharacterContext();

  if (!currentCharacter) return <></>;

  const handleExportJSON = async () => {
    if (!currentCharacter) return;
    
    const result = await characterExportService.exportAsJSON(currentCharacter);
    if (result.success && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `${currentCharacter.name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert(result.error || 'Failed to export character');
    }
  };

  const handleExportPNG = async () => {
    if (!currentCharacter) return;
    
    const result = await characterExportService.exportAsPNG(currentCharacter);
    if (result.success && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `${currentCharacter.name}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert(result.error || 'Failed to export character');
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6
      bg-surface/60 backdrop-blur-xl
      border-b border-border/60 shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={closeCharacter}
          className="p-2 text-fg-muted hover:text-accent
            hover:bg-accent-soft rounded-xl transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-accent active:scale-95 shrink-0"
          title="Back to characters"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {currentCharacter.imageData ? (
            <img
              src={currentCharacter.imageData}
              alt={currentCharacter.name}
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-hover flex items-center justify-center shrink-0">
              <User className="w-4 h-4 md:w-5 md:h-5 text-fg-muted" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-fg text-sm md:text-base truncate">
              {currentCharacter.name}
            </h1>
            <p className="text-xs text-fg-muted hidden sm:block">
              Editing character
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        {/* Mobile panel toggle buttons */}
        {isMobile && (
          <>
            <button
              onClick={onToggleContext}
              className={`p-2 rounded-lg transition-colors ${
                isContextOpen 
                  ? 'bg-accent text-accent-fg' 
                  : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
              }`}
              title="Toggle AI Context Panel"
            >
              <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={onToggleChat}
              className={`p-2 rounded-lg transition-colors ${
                isChatOpen 
                  ? 'bg-accent text-accent-fg' 
                  : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
              }`}
              title="Toggle Ask AI Panel"
            >
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </>
        )}

        {/* Desktop panel toggle buttons */}
        {!isMobile && (
          <>
            <button
              onClick={onToggleContext}
              className={`hidden lg:flex p-2 rounded-lg transition-colors ${
                isContextOpen 
                  ? 'bg-accent text-accent-fg' 
                  : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
              }`}
              title={isContextOpen ? 'Hide AI Context Panel' : 'Show AI Context Panel'}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleChat}
              className={`hidden lg:flex p-2 rounded-lg transition-colors ${
                isChatOpen 
                  ? 'bg-accent text-accent-fg' 
                  : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
              }`}
              title={isChatOpen ? 'Hide Ask AI Panel' : 'Show Ask AI Panel'}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="h-6 w-px bg-hover mx-1 hidden sm:block" />

        <button
          onClick={onOpenRevisions}
          className="flex items-center gap-2 px-2 md:px-3 py-2 text-sm font-medium
            text-fg-muted
            hover:bg-accent-soft hover:text-accent rounded-xl
            transition-colors duration-200"
          title="Open revisions"
        >
          <History className="w-4 h-4" />
          <span className="hidden md:inline">Snapshots</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-2 md:px-3 py-2 text-sm font-medium
            text-fg-muted
            hover:bg-accent-soft hover:text-accent rounded-xl
            transition-colors duration-200"
          title="AI Settings"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden md:inline">Settings</span>
        </button>
        
        {/* Export Dropdown */}
        <ExportDropdown 
          onExportJSON={handleExportJSON}
          onExportPNG={handleExportPNG}
        />
      </div>
    </header>
  );
}

/**
 * Export Dropdown component - Combines JSON and PNG export options
 */
interface ExportDropdownProps {
  onExportJSON: () => void;
  onExportPNG: () => void;
}

function ExportDropdown({ onExportJSON, onExportPNG }: ExportDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Calculate menu position synchronously when opening
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExportJSON = () => {
    onExportJSON();
    setIsOpen(false);
  };

  const handleExportPNG = () => {
    onExportPNG();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-2 px-2 md:px-3 py-2 text-sm font-medium
          text-fg-muted
          hover:bg-accent-soft hover:text-accent rounded-xl
          transition-colors duration-200"
        title="Export character"
      >
        <Download className="w-4 h-4" />
        <span className="hidden md:inline">Export</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed w-40 bg-surface rounded-xl border border-border shadow-lg py-1 z-9999"
          style={{ top: menuPosition.top, right: menuPosition.right }}
        >
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-fg-muted hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <FileJson className="w-4 h-4" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-fg-muted hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Export PNG</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Backdrop component for mobile panels
 */
interface BackdropProps {
  isOpen: boolean;
  onClick: () => void;
}

function Backdrop({ isOpen, onClick }: BackdropProps): React.ReactElement {
  if (!isOpen) return <></>;
  
  return (
    <div 
      className="fixed inset-0 bg-overlay backdrop-blur-sm z-30 lg:hidden"
      onClick={onClick}
    />
  );
}

/**
 * Main CharacterWorkspaceContent component
 */
function CharacterWorkspaceContent(): React.ReactElement {
  const { currentCharacter } = useCharacterContext();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Panel visibility states
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 1024;
      setIsMobile(isMobileView);
      
      // On mobile, panels are closed by default
      if (isMobileView) {
        setIsContextOpen(false);
        setIsChatOpen(false);
      } else {
        // On desktop, panels are open by default
        setIsContextOpen(true);
        setIsChatOpen(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!currentCharacter) {
    return (
      <div className="h-dvh w-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-fg-muted">No character selected</p>
        </div>
      </div>
    );
  }

  return (
    <CharacterEditorProvider>
      <CharacterWorkspaceInner 
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isContextOpen={isContextOpen}
        isChatOpen={isChatOpen}
        setIsContextOpen={setIsContextOpen}
        setIsChatOpen={setIsChatOpen}
        isMobile={isMobile}
      />
    </CharacterEditorProvider>
  );
}

/**
 * Inner workspace component with access to CharacterEditorContext
 */
interface CharacterWorkspaceInnerProps {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isContextOpen: boolean;
  isChatOpen: boolean;
  setIsContextOpen: (open: boolean) => void;
  setIsChatOpen: (open: boolean) => void;
  isMobile: boolean;
}

function CharacterWorkspaceInner({
  isSettingsOpen,
  setIsSettingsOpen,
  isContextOpen,
  isChatOpen,
  setIsContextOpen,
  setIsChatOpen,
  isMobile,
}: CharacterWorkspaceInnerProps): React.ReactElement {
  const { 
    activeSection,
    setActiveSection,
    selectedText,
    contextSectionIds,
    aiConfig,
    samplerSettings,
    promptSettings,
    isHistoryOpen,
    setIsHistoryOpen,
    handleAIOperation,
    getContextContent,
    visibleSections,
  } = useCharacterEditorContext();

  const stableGetContextContent = useCallback(
    async (ids: string[]) => getContextContent(ids as CharacterSection[]),
    [getContextContent]
  );

  // If the active section is hidden, switch to the first visible section
  useEffect(() => {
    if (visibleSections.length > 0 && !visibleSections.some(s => s.id === activeSection)) {
      setActiveSection(visibleSections[0].id);
    }
  }, [visibleSections, activeSection, setActiveSection]);

  const toggleContext = () => setIsContextOpen(!isContextOpen);
  const toggleChat = () => setIsChatOpen(!isChatOpen);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const toastTimeoutsRef = React.useRef<number[]>([]);
  const isDesktop = !isMobile;
  const isTightLayout = isDesktop && isContextOpen && isChatOpen;
  const isEdgeToEdgeLayout = isDesktop && (!isContextOpen || !isChatOpen);
  
  // Close panels when clicking backdrop on mobile
  const closePanels = () => {
    if (isMobile) {
      setIsContextOpen(false);
      setIsChatOpen(false);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const addToast = (type: ToastNotification['type'], title: string, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
    const timeoutId = window.setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3500);
    toastTimeoutsRef.current.push(timeoutId);
  };

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current = [];
    };
  }, []);

  return (
    <div className="h-dvh w-full flex flex-col bg-bg overflow-hidden">
      
      <CharacterHeader 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRevisions={() => setIsHistoryOpen(true)}
        isContextOpen={isContextOpen}
        isChatOpen={isChatOpen}
        onToggleContext={toggleContext}
        onToggleChat={toggleChat}
        isMobile={isMobile}
      />
      
      {/* Mobile Backdrop */}
      <Backdrop 
        isOpen={isMobile && (isContextOpen || isChatOpen)} 
        onClick={closePanels} 
      />
      
      {/* Section Tabs - Full Width */}
      <SectionTabs 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
        sections={visibleSections}
      />
      
      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: AI Context */}
        <aside 
          className={`
            ${isContextOpen && isMobile ? 'fixed top-0 left-0 right-auto z-40 w-80 shadow-2xl translate-x-0 h-dvh safe-area-bottom' : ''}
            ${!isContextOpen && isMobile ? 'fixed top-0 left-0 right-auto z-40 w-80 shadow-2xl -translate-x-full h-dvh safe-area-bottom' : ''}
            ${isContextOpen && !isMobile ? 'lg:w-72 xl:w-80 translate-x-0' : ''}
            ${!isContextOpen && !isMobile ? 'lg:w-0 lg:opacity-0 lg:overflow-hidden' : ''}
            transition-all duration-300 ease-in-out
            bg-bg
            border-r border-border
            flex flex-col
            shrink-0
          `}
        >
          <ContextPanel 
            onClose={() => setIsContextOpen(false)}
            isMobile={isMobile}
          />
        </aside>

        {/* Center: Main Editor - Always visible, spans available space */}
        <main className="flex-1 flex flex-col min-w-0 relative z-0 overflow-hidden">
          <div className={`flex-1 min-h-0 ${isTightLayout || isEdgeToEdgeLayout ? 'p-0' : 'p-3 md:p-4 lg:p-6'} pb-[max(env(safe-area-inset-bottom),0px)]`}>
            <div className={`h-full w-full bg-surface/60 backdrop-blur-xl
              border border-border/60 shadow-lg overflow-hidden relative
              ${
                isTightLayout
                  ? 'rounded-none p-2 md:p-3 border-l-0 border-r-0'
                  : isEdgeToEdgeLayout
                  ? `rounded-none p-3 md:p-4 ${!isContextOpen ? 'border-l-0' : ''} ${!isChatOpen ? 'border-r-0' : ''}`
                  : 'rounded-2xl p-4 md:p-6'
              }`}
              data-section-editor-container>
              {activeSection === 'image' ? (
                <ImageEditor />
              ) : (
                <SectionEditor section={activeSection} />
              )}
            </div>
          </div>
        </main>

        {/* Right Panel: Ask AI */}
        <aside 
          className={`
            ${isChatOpen && isMobile ? 'fixed top-0 right-0 left-auto z-40 w-80 shadow-2xl translate-x-0 h-dvh safe-area-bottom' : ''}
            ${!isChatOpen && isMobile ? 'fixed top-0 right-0 left-auto z-40 w-80 shadow-2xl translate-x-full h-dvh safe-area-bottom' : ''}
            ${isChatOpen && !isMobile ? 'lg:w-80 xl:w-96 translate-x-0' : ''}
            ${!isChatOpen && !isMobile ? 'lg:w-0 lg:opacity-0 lg:overflow-hidden' : ''}
            transition-all duration-300 ease-in-out
            bg-bg
            border-l border-border
            flex flex-col
            shrink-0
          `}
        >
          <AIChatPanel
            selectedText={selectedText}
            contextEntryIds={contextSectionIds}
            aiConfig={aiConfig}
            samplerSettings={samplerSettings}
            promptSettings={promptSettings}
            onComplete={(result) => handleAIOperation(result, 'ask', selectedText)}
            getContextContent={stableGetContextContent}
            activeSection={activeSection}
            onClose={() => setIsChatOpen(false)}
            isMobile={isMobile}
          />
        </aside>
      </div>

      {/* Settings Panel */}
      <CharacterSettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <CharacterHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onToast={(type, title, message) => addToast(type, title, message)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

/**
 * Main CharacterWorkspace component
 */
export function CharacterWorkspace(): React.ReactElement {
  return <CharacterWorkspaceContent />;
}

export default CharacterWorkspace;
