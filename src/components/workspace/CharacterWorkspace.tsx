/**
 * @fileoverview Character workspace for editing character cards with AI integration.
 * Updated with docked side panels for AI Context and Ask AI.
 * @module @components/workspace/CharacterWorkspace
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterContext, CharacterEditorProvider, useCharacterEditorContext } from '../../context';
import type { CharacterSection } from '../../db/characterTypes';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';
import { SectionEditor } from '../editor/SectionEditor';
import { ContextPanel } from '../ai/ContextPanel';
import { AIChatPanel } from '../ai/AIChatPanel';
import { CharacterSettingsPanel } from '../settings/CharacterSettingsPanel';
import { characterExportService } from '../../services/CharacterExportService';
import {
  ArrowLeft,
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
  Save,
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
} from 'lucide-react';

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
}

function SectionTabs({ activeSection, onSectionChange }: SectionTabsProps): React.ReactElement {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);
  const desktopTabsRef = React.useRef<HTMLDivElement>(null);

  const handleDesktopTabsWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = desktopTabsRef.current;
    if (!container) return;

    if (container.scrollWidth <= container.clientWidth) return;

    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (horizontalDelta === 0) return;

    event.preventDefault();
    container.scrollLeft += horizontalDelta;
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

  const activeSectionData = CHARACTER_SECTIONS.find(s => s.id === activeSection);
  const ActiveIcon = activeSectionData ? iconMap[activeSectionData.icon] || FileText : FileText;

  return (
    <div className="border-b border-vault-200 dark:border-vault-800 bg-white/60 dark:bg-vault-900/60 backdrop-blur-xl shrink-0">
      {/* Desktop: Horizontal tabs */}
      <div
        ref={desktopTabsRef}
        onWheel={handleDesktopTabsWheel}
        className="hidden md:flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-thin"
      >
        {CHARACTER_SECTIONS.map((section) => {
          const Icon = iconMap[section.icon] || FileText;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${isActive 
                  ? 'bg-vault-600 text-white shadow-sm' 
                  : 'text-vault-600 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800/50'
                }`}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Mobile: Dropdown */}
      <div className="md:hidden relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-vault-50 dark:hover:bg-vault-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-vault-600 dark:text-vault-400" />
            <span className="font-medium text-vault-900 dark:text-vault-100">
              {activeSectionData?.label || 'Select Section'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-vault-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && createPortal(
          <div 
            ref={portalRef}
            className="fixed inset-x-0 top-26.25 z-9999 bg-white dark:bg-vault-900 border-b border-vault-200 dark:border-vault-800 shadow-lg max-h-[50vh] overflow-y-auto md:hidden"
          >
            {CHARACTER_SECTIONS.map((section) => {
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
                      ? 'bg-vault-100 dark:bg-vault-800 text-vault-900 dark:text-vault-100 font-medium' 
                      : 'text-vault-600 dark:text-vault-400 hover:bg-vault-50 dark:hover:bg-vault-800/50'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-vault-600 dark:text-vault-400' : ''}`} />
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
  const { currentCharacter, updateCharacter } = useCharacterContext();
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (currentCharacter && result) {
        void updateCharacter(currentCharacter.id, { imageData: result });
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
      <h2 className="text-xl font-bold text-vault-900 dark:text-vault-50">Character Image</h2>
      
      {/* Image Preview */}
      <div className="flex justify-center">
        {currentCharacter?.imageData ? (
          <div className="relative group">
            <img
              src={currentCharacter.imageData}
              alt={currentCharacter.name}
              className="w-96 h-96 max-w-full max-h-[60vh] object-contain rounded-2xl border-2 border-vault-200 dark:border-vault-700 shadow-lg"
            />
            <button
              onClick={() => currentCharacter && void updateCharacter(currentCharacter.id, { imageData: '' })}
              className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg
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
                ? 'border-vault-500 bg-vault-100 dark:bg-vault-800/50' 
                : 'border-vault-300 dark:border-vault-700 bg-vault-50 dark:bg-vault-900/30'
              }
              flex flex-col items-center justify-center gap-3 transition-colors duration-200`}
          >
            <Image className="w-16 h-16 text-vault-400 dark:text-vault-600" />
            <p className="text-sm text-vault-500 dark:text-vault-400 text-center px-4">
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
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-vault-600 hover:bg-vault-700 
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
  isContextOpen: boolean;
  isChatOpen: boolean;
  onToggleContext: () => void;
  onToggleChat: () => void;
  isMobile: boolean;
}

function CharacterHeader({ 
  onOpenSettings, 
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
      bg-white/60 dark:bg-vault-900/60 backdrop-blur-xl
      border-b border-vault-200/60 dark:border-vault-800/50 shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={closeCharacter}
          className="p-2 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200
            hover:bg-vault-100 dark:hover:bg-vault-800/50 rounded-xl transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-vault-500 active:scale-95 shrink-0"
          title="Back to characters"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {currentCharacter.imageData ? (
            <img
              src={currentCharacter.imageData}
              alt={currentCharacter.name}
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover border border-vault-200 dark:border-vault-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-vault-200 dark:bg-vault-800 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 md:w-5 md:h-5 text-vault-500 dark:text-vault-400" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-vault-900 dark:text-vault-50 text-sm md:text-base truncate">
              {currentCharacter.name}
            </h1>
            <p className="text-xs text-vault-500 dark:text-vault-400 hidden sm:block">
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
                  ? 'bg-vault-600 text-white' 
                  : 'text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800/50'
              }`}
              title="Toggle AI Context Panel"
            >
              <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={onToggleChat}
              className={`p-2 rounded-lg transition-colors ${
                isChatOpen 
                  ? 'bg-vault-600 text-white' 
                  : 'text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800/50'
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
                  ? 'bg-vault-200 dark:bg-vault-700 text-vault-700 dark:text-vault-200' 
                  : 'text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800/50'
              }`}
              title={isContextOpen ? 'Hide AI Context Panel' : 'Show AI Context Panel'}
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onToggleChat}
              className={`hidden lg:flex p-2 rounded-lg transition-colors ${
                isChatOpen 
                  ? 'bg-vault-200 dark:bg-vault-700 text-vault-700 dark:text-vault-200' 
                  : 'text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800/50'
              }`}
              title={isChatOpen ? 'Hide Ask AI Panel' : 'Show Ask AI Panel'}
            >
              <PanelRight className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="h-6 w-px bg-vault-200 dark:bg-vault-800 mx-1 hidden sm:block" />

        <button
          onClick={onOpenSettings}
          className="p-2 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200
            hover:bg-vault-100 dark:hover:bg-vault-800/50 rounded-xl transition-colors"
          title="AI Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        
        <button
          onClick={handleExportJSON}
          className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium
            text-vault-700 dark:text-vault-300
            hover:bg-vault-100 dark:hover:bg-vault-800/50 rounded-xl
            transition-colors duration-200"
        >
          <Save className="w-4 h-4" />
          <span className="hidden md:inline">Export JSON</span>
        </button>
        
        <button
          onClick={handleExportPNG}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium
            bg-vault-600 hover:bg-vault-700 text-white rounded-xl
            transition-colors duration-200"
        >
          <Download className="w-4 h-4" />
          <span className="hidden md:inline">Export PNG</span>
        </button>
      </div>
    </header>
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
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
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-vault-500">No character selected</p>
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
    handleAIOperation,
    getContextContent,
  } = useCharacterEditorContext();

  const toggleContext = () => setIsContextOpen(!isContextOpen);
  const toggleChat = () => setIsChatOpen(!isChatOpen);
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

  return (
    <div className="h-screen w-full flex flex-col bg-linear-to-br from-vault-50 via-vault-50 to-vault-100/50 
      dark:from-vault-950 dark:via-vault-950 dark:to-vault-900/50 overflow-hidden">
      
      <CharacterHeader 
        onOpenSettings={() => setIsSettingsOpen(true)}
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
      />
      
      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: AI Context */}
        <aside 
          className={`
            ${isContextOpen && isMobile ? 'fixed inset-y-0 left-0 z-40 w-80 shadow-2xl translate-x-0' : ''}
            ${!isContextOpen && isMobile ? 'fixed inset-y-0 left-0 z-40 w-80 shadow-2xl -translate-x-full' : ''}
            ${isContextOpen && !isMobile ? 'lg:w-72 xl:w-80 translate-x-0' : ''}
            ${!isContextOpen && !isMobile ? 'lg:w-0 lg:opacity-0 lg:overflow-hidden' : ''}
            transition-all duration-300 ease-in-out
            bg-vault-50 dark:bg-vault-900
            border-r border-vault-200 dark:border-vault-800
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
          <div className={`flex-1 min-h-0 ${isTightLayout || isEdgeToEdgeLayout ? 'p-0' : 'p-3 md:p-4 lg:p-6'}`}>
            <div className={`h-full w-full bg-white/60 dark:bg-vault-900/60 backdrop-blur-xl
              border border-vault-200/60 dark:border-vault-800/50 shadow-lg overflow-hidden
              ${
                isTightLayout
                  ? 'rounded-none p-2 md:p-3 border-l-0 border-r-0'
                  : isEdgeToEdgeLayout
                  ? `rounded-none p-3 md:p-4 ${!isContextOpen ? 'border-l-0' : ''} ${!isChatOpen ? 'border-r-0' : ''}`
                  : 'rounded-2xl p-4 md:p-6'
              }`}>
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
            ${isChatOpen && isMobile ? 'fixed inset-y-0 right-0 z-40 w-80 shadow-2xl translate-x-0' : ''}
            ${!isChatOpen && isMobile ? 'fixed inset-y-0 right-0 z-40 w-80 shadow-2xl translate-x-full' : ''}
            ${isChatOpen && !isMobile ? 'lg:w-80 xl:w-96 translate-x-0' : ''}
            ${!isChatOpen && !isMobile ? 'lg:w-0 lg:opacity-0 lg:overflow-hidden' : ''}
            transition-all duration-300 ease-in-out
            bg-vault-50 dark:bg-vault-900
            border-l border-vault-200 dark:border-vault-800
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
            getContextContent={async (ids) => getContextContent(ids as CharacterSection[])}
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
