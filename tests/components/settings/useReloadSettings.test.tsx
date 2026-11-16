// @vitest-environment jsdom
import React from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReloadSettings } from '../../../src/components/settings/hooks/useReloadSettings';
import { CharacterContext, CharacterEditorContext } from '../../../src/context';

afterEach(cleanup);

type SharedValue = React.ComponentProps<typeof CharacterContext.Provider>['value'];
type EditorValue = React.ComponentProps<typeof CharacterEditorContext.Provider>['value'];

function wrapper({
  refreshSettings,
  editorReload,
}: {
  refreshSettings?: () => Promise<void>;
  editorReload?: () => Promise<void>;
}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    let tree = <>{children}</>;
    if (editorReload) {
      tree = (
        <CharacterEditorContext.Provider value={{ reloadSettings: editorReload } as unknown as EditorValue}>
          {tree}
        </CharacterEditorContext.Provider>
      );
    }
    if (refreshSettings) {
      tree = (
        <CharacterContext.Provider value={{ refreshSettings } as unknown as SharedValue}>
          {tree}
        </CharacterContext.Provider>
      );
    }
    return tree;
  };
}

describe('useReloadSettings', () => {
  it('refreshes the shared settings after the character editor reloads', async () => {
    const order: string[] = [];
    const refreshSettings = vi.fn(async () => void order.push('shared'));
    const editorReload = vi.fn(async () => void order.push('editor'));
    const { result } = renderHook(() => useReloadSettings(), {
      wrapper: wrapper({ refreshSettings, editorReload }),
    });
    await result.current();
    expect(order).toEqual(['editor', 'shared']);
  });

  it('refreshes the shared settings after a page-specific reload', async () => {
    const refreshSettings = vi.fn(async () => {});
    const hostReload = vi.fn(async () => {});
    const { result } = renderHook(() => useReloadSettings(hostReload), {
      wrapper: wrapper({ refreshSettings }),
    });
    await result.current();
    expect(hostReload).toHaveBeenCalledTimes(1);
    expect(refreshSettings).toHaveBeenCalledTimes(1);
  });

  it('refreshes the shared settings once when the page passes that same refresh', async () => {
    const refreshSettings = vi.fn(async () => {});
    const { result } = renderHook(() => useReloadSettings(refreshSettings), {
      wrapper: wrapper({ refreshSettings }),
    });
    await result.current();
    expect(refreshSettings).toHaveBeenCalledTimes(1);
  });

  it('refreshes the shared settings from a page with no reload of its own', async () => {
    const refreshSettings = vi.fn(async () => {});
    const { result } = renderHook(() => useReloadSettings(), { wrapper: wrapper({ refreshSettings }) });
    await result.current();
    expect(refreshSettings).toHaveBeenCalledTimes(1);
  });

  it('works outside both providers', async () => {
    const { result } = renderHook(() => useReloadSettings());
    await expect(result.current()).resolves.toBeUndefined();
  });
});
