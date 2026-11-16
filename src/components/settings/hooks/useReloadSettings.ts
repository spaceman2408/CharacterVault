import { useCallback, useContext } from 'react';
import { CharacterContext, CharacterEditorContext } from '../../../context';

/**
 * Reloads the page that opened the panel, then the shared app settings. The lorebook workspace and
 * the vault read the shared copy, so it must refresh whichever page saved.
 */
export function useReloadSettings(hostReload?: () => Promise<void>): () => Promise<void> {
  const editorReload = useContext(CharacterEditorContext)?.reloadSettings;
  const refreshShared = useContext(CharacterContext)?.refreshSettings;
  const reloadHost = hostReload ?? editorReload;
  return useCallback(async () => {
    await reloadHost?.();
    if (refreshShared && refreshShared !== reloadHost) await refreshShared();
  }, [reloadHost, refreshShared]);
}
