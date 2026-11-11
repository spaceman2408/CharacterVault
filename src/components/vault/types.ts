export type VaultSortMode = 'name' | 'recent' | 'created';
export type CardExportFormat = 'png' | 'json';
export type VaultTab = 'characters' | 'lorebooks';

export const VAULT_SORT_STORAGE_KEY = 'characterVaultSort';

export interface ConfirmTarget {
  id: string;
  name: string;
}
