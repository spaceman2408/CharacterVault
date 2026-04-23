/**
 * @fileoverview Barrel export for AI provider adapters.
 * @module @services/providers
 */

export { NanoGPTProvider } from './NanoGPTProvider';
export { OpenAICompatProvider } from './OpenAICompatProvider';
export type {
  IProviderAdapter,
  ModelProvider,
  ModelProviderInfo,
  ExtendedAIModelInfo,
  FetchModelsOptions,
} from './types';

import { NanoGPTProvider } from './NanoGPTProvider';
import { OpenAICompatProvider } from './OpenAICompatProvider';
import type { IProviderAdapter } from './types';

// Ordered list: more specific providers first, fallback last
const providers: IProviderAdapter[] = [
  new NanoGPTProvider(),
  new OpenAICompatProvider(), // fallback — must be last
];

/**
 * Resolve the appropriate provider adapter for the given base URL.
 * Returns the first adapter whose matches() returns true.
 */
export function resolveProvider(baseUrl: string): IProviderAdapter {
  return providers.find((p) => p.matches(baseUrl)) ?? new OpenAICompatProvider();
}
