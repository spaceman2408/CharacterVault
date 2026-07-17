export type VaultSortMode = 'name' | 'recent';
export type CardExportFormat = 'png' | 'json';

export const VAULT_SORT_STORAGE_KEY = 'characterVaultSort';

export interface ConfirmTarget {
  id: string;
  name: string;
}
