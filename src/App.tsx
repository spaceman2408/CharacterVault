/**
 * @fileoverview Root component with routing and tutorial gate.
 * @module App
 */

import { useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { CharacterProvider, useCharacterContext } from './context';
import { CharacterWorkspace } from './components/workspace';
import { WelcomeTutorial } from './components/WelcomeTutorial';
import { CharacterSelectionView } from './components/vault';
import { ImportPage } from './pages/ImportPage';
import { AICreationStudio } from './pages/ai-creation-studio/AICreationStudio';

function AppContent(): React.ReactNode {
  const { isCharacterOpen, openCharacter } = useCharacterContext();
  const [isReady, setIsReady] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isInitialTutorial, setIsInitialTutorial] = useState(false);

  useEffect(() => {
    const completed = WelcomeTutorial.isCompleted?.() ?? false;
    const shouldShow = !completed;
    requestAnimationFrame(() => {
      setShowTutorial(shouldShow);
      setIsInitialTutorial(shouldShow);
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return;

    const queryString = hash.slice(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    const charId = params.get('char');
    if (charId) {
      openCharacter(charId);
      const newHash = hash.slice(0, queryIndex);
      window.history.replaceState({}, document.title, window.location.pathname + newHash);
    }
  }, [openCharacter]);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const handleReplayTutorial = useCallback(() => {
    WelcomeTutorial.reset?.();
    setIsInitialTutorial(false);
    setShowTutorial(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <>
      {showTutorial && (
        <WelcomeTutorial
          onComplete={handleTutorialComplete}
          skipEntranceAnimation={isInitialTutorial}
        />
      )}
      {isCharacterOpen ? (
        <CharacterWorkspace />
      ) : (
        <CharacterSelectionView onReplayTutorial={handleReplayTutorial} />
      )}
    </>
  );
}

function App(): React.ReactElement {
  return (
    <CharacterProvider>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/ai-create" element={<AICreationStudio />} />
      </Routes>
    </CharacterProvider>
  );
}

export default App;
