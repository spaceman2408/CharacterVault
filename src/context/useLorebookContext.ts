import { useContext } from 'react';
import { LorebookContext } from './LorebookContext';

export function useLorebookContext() {
  const ctx = useContext(LorebookContext);
  if (!ctx) {
    throw new Error('useLorebookContext must be used within a LorebookProvider');
  }
  return ctx;
}
