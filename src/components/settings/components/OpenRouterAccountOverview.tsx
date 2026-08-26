import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Loader2, RefreshCw, Wallet } from 'lucide-react';
import {
  OpenRouterProvider,
  type OpenRouterKeyInfo,
} from '../../../services/providers';
import { SettingsCard } from './SettingsCard';

const openRouterProvider = new OpenRouterProvider();

const MANUAL_REFRESH_COOLDOWN_MS = 30_000;
const AUTO_CACHE_TTL_MS = 60_000;

interface AccountSessionCache {
  cacheKey: string;
  fetchedAt: number;
  cooldownUntil: number;
  keyInfo: OpenRouterKeyInfo | null;
  error: string | null;
  status: LoadStatus;
}

let accountSessionCache: AccountSessionCache | null = null;

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface OpenRouterAccountOverviewProps {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

function makeCacheKey(baseUrl: string, apiKey: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '').toLowerCase()}|${apiKey.trim()}`;
}

function readFreshCache(baseUrl: string, apiKey: string): AccountSessionCache | null {
  if (!apiKey.trim() || !accountSessionCache) return null;
  if (accountSessionCache.cacheKey !== makeCacheKey(baseUrl, apiKey)) return null;
  if (Date.now() - accountSessionCache.fetchedAt >= AUTO_CACHE_TTL_MS) return null;
  return accountSessionCache;
}

function getCooldownRemainingSec(baseUrl: string, apiKey: string): number {
  if (!apiKey.trim() || !accountSessionCache) return 0;
  if (accountSessionCache.cacheKey !== makeCacheKey(baseUrl, apiKey)) return 0;
  const ms = accountSessionCache.cooldownUntil - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

function formatExpiresAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const diff = date.getTime() - Date.now();
  if (diff > 0 && diff < 48 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    if (hours >= 1) return `in ${hours}h ${mins}m`;
    if (mins >= 1) return `in ${mins}m`;
    return 'soon';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type BarStatus = 'good' | 'warning' | 'danger';

function barStatus(percentUsed: number): BarStatus {
  const pct = percentUsed * 100;
  if (pct > 80) return 'danger';
  if (pct > 50) return 'warning';
  return 'good';
}

const barFillStyles: Record<BarStatus, string> = {
  good: 'bg-success',
  warning: 'bg-yellow-500',
  danger: 'bg-danger',
};

const barTextStyles: Record<BarStatus, string> = {
  good: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(amount);
}

const UsageBar: React.FC<{
  label: string;
  usedLabel: string;
  remainingLabel: string;
  percentUsed: number;
  footnote?: string | null;
}> = ({ label, usedLabel, remainingLabel, percentUsed, footnote }) => {
  const status = barStatus(percentUsed);
  const pct = Math.min(100, Math.max(0, percentUsed * 100));

  return (
    <div className="p-3 rounded-lg bg-bg/40 border border-border">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${barTextStyles[status]}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-hover rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${barFillStyles[status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-fg-muted">
        <span>
          <span className="font-medium text-fg-muted">{usedLabel}</span>
          <span className="text-fg-subtle">
            {' · '}
            {remainingLabel}
          </span>
        </span>
        {footnote && <span className="shrink-0">{footnote}</span>}
      </div>
    </div>
  );
};

const KeyLimitBar: React.FC<{ info: OpenRouterKeyInfo }> = ({ info }) => {
  if (info.limit === null || info.limitRemaining === null || info.limit <= 0) return null;
  const used = Math.max(0, info.limit - info.limitRemaining);
  const percentUsed = Math.min(1, used / info.limit);
  const reset = info.limitReset
    ? `Resets ${info.limitReset}`
    : 'Does not reset';

  return (
    <UsageBar
      label="Key spending limit"
      usedLabel={`${formatUsd(used)} / ${formatUsd(info.limit)} used`}
      remainingLabel={`${formatUsd(Math.max(0, info.limitRemaining))} left`}
      percentUsed={percentUsed}
      footnote={reset}
    />
  );
};

const SpendGrid: React.FC<{ info: OpenRouterKeyInfo }> = ({ info }) => {
  const cells = [
    { label: 'Today', value: info.usageDaily },
    { label: 'This week', value: info.usageWeekly },
    { label: 'This month', value: info.usageMonthly },
    { label: 'All time', value: info.usage },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((cell) => (
        <div key={cell.label} className="p-3 rounded-lg bg-bg/40 border border-border">
          <p className="text-xs text-fg-muted">{cell.label}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-fg">{formatUsd(cell.value)}</p>
        </div>
      ))}
    </div>
  );
};

export const OpenRouterAccountOverview: React.FC<OpenRouterAccountOverviewProps> = ({
  baseUrl,
  apiKey,
  enabled,
}) => {
  const cachedOnMount = readFreshCache(baseUrl, apiKey);
  const [keyInfo, setKeyInfo] = useState<OpenRouterKeyInfo | null>(
    () => cachedOnMount?.keyInfo ?? null
  );
  const [error, setError] = useState<string | null>(() => cachedOnMount?.error ?? null);
  const [status, setStatus] = useState<LoadStatus>(() => cachedOnMount?.status ?? 'idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(() => getCooldownRemainingSec(baseUrl, apiKey));
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cooldownActive = cooldownSec > 0;

  const fetchAccount = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!apiKey.trim()) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;
      const manual = options?.manual === true;
      if (manual) setIsRefreshing(true);
      else setStatus('loading');

      try {
        const next = await openRouterProvider.fetchKey(baseUrl, apiKey, controller.signal);
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        const entry: AccountSessionCache = {
          cacheKey: makeCacheKey(baseUrl, apiKey),
          fetchedAt: Date.now(),
          cooldownUntil: Date.now() + MANUAL_REFRESH_COOLDOWN_MS,
          keyInfo: next,
          error: null,
          status: 'success',
        };
        accountSessionCache = entry;
        setKeyInfo(next);
        setError(null);
        setStatus('success');
        setCooldownSec(Math.ceil(MANUAL_REFRESH_COOLDOWN_MS / 1000));
      } catch (err) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to fetch key usage';
        const entry: AccountSessionCache = {
          cacheKey: makeCacheKey(baseUrl, apiKey),
          fetchedAt: Date.now(),
          cooldownUntil: Date.now() + MANUAL_REFRESH_COOLDOWN_MS,
          keyInfo: null,
          error: message,
          status: 'error',
        };
        accountSessionCache = entry;
        setKeyInfo(null);
        setError(message);
        setStatus('error');
        setCooldownSec(Math.ceil(MANUAL_REFRESH_COOLDOWN_MS / 1000));
      } finally {
        if (requestId === requestIdRef.current && !controller.signal.aborted) {
          setIsRefreshing(false);
        }
      }
    },
    [apiKey, baseUrl]
  );

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      return;
    }

    if (!apiKey.trim()) {
      abortRef.current?.abort();
      setKeyInfo(null);
      setError(null);
      setStatus('idle');
      setIsRefreshing(false);
      return;
    }

    const cached = readFreshCache(baseUrl, apiKey);
    if (cached) {
      setKeyInfo(cached.keyInfo);
      setError(cached.error);
      setStatus(cached.status);
      setCooldownSec(getCooldownRemainingSec(baseUrl, apiKey));
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchAccount();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [apiKey, baseUrl, enabled, fetchAccount]);

  useEffect(() => {
    if (!cooldownActive) return;
    const timer = window.setInterval(() => {
      setCooldownSec(getCooldownRemainingSec(baseUrl, apiKey));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [apiKey, baseUrl, cooldownActive]);

  if (!enabled) return null;

  const refreshDisabled =
    status === 'loading' || isRefreshing || cooldownSec > 0 || !apiKey.trim();
  const showContent = status === 'success' || keyInfo !== null;
  const expires = formatExpiresAt(keyInfo?.expiresAt ?? null);
  const hasKeyCap =
    keyInfo !== null &&
    keyInfo.limit !== null &&
    keyInfo.limitRemaining !== null &&
    keyInfo.limit > 0;

  return (
    <SettingsCard>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
          <Wallet className="w-4 h-4 text-fg-muted" />
          OpenRouter Usage
        </h3>
        {apiKey.trim() && (
          <button
            type="button"
            onClick={() => void fetchAccount({ manual: true })}
            disabled={refreshDisabled}
            title={
              cooldownSec > 0
                ? `Wait ${cooldownSec}s before refreshing again`
                : 'Refresh key usage'
            }
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-fg-muted hover:bg-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent/50"
            aria-label={
              cooldownSec > 0
                ? `Refresh available in ${cooldownSec} seconds`
                : 'Refresh OpenRouter usage'
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || status === 'loading' ? 'animate-spin' : ''}`}
            />
            {cooldownSec > 0 ? `Refresh (${cooldownSec}s)` : 'Refresh'}
          </button>
        )}
      </div>

      {!apiKey.trim() && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-bg/40 border border-border">
          <KeyRound className="w-4 h-4 text-fg-muted shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-fg">Add your API key to view usage</p>
            <p className="text-xs text-fg-muted mt-0.5">
              Paste an OpenRouter API key above to see credit spend for this key.
            </p>
          </div>
        </div>
      )}

      {apiKey.trim() && status === 'error' && !keyInfo && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-danger-soft border border-danger/30">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger-soft-fg">Could not load usage</p>
            <p className="text-xs text-danger mt-0.5">{error || 'Unknown error'}</p>
            <button
              type="button"
              onClick={() => void fetchAccount({ manual: true })}
              className="mt-2 text-xs font-medium text-danger-soft-fg hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {apiKey.trim() && !(status === 'error' && !keyInfo) && (
        <div className="space-y-3" aria-busy={status === 'loading' && !showContent} aria-live="polite">
          {showContent && keyInfo?.isFreeTier && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-soft border border-warning/30">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning-soft-fg">
                Free-tier key: models ending in :free are limited to 20 requests per minute and 50
                per day until you buy credits.
              </p>
            </div>
          )}
          {showContent && hasKeyCap && keyInfo && <KeyLimitBar info={keyInfo} />}
          {showContent && keyInfo && <SpendGrid info={keyInfo} />}
          {showContent && expires && (
            <p className="text-xs text-fg-muted">This key expires {expires}.</p>
          )}
          {!showContent && (
            <div className="p-3 rounded-lg bg-bg/40 border border-border animate-pulse" aria-hidden>
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 w-32 rounded bg-hover" />
                <div className="h-3 w-8 rounded bg-hover" />
              </div>
              <div className="h-2 rounded-full bg-hover mb-2" />
              <div className="h-3 w-48 rounded bg-hover/80" />
              <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Loading usage…
              </div>
            </div>
          )}
          <p className="text-xs text-fg-muted">
            Spend is this API key&apos;s OpenRouter credit usage in USD. Account balance is not
            returned by a normal inference key.{' '}
            <a
              href="https://openrouter.ai/settings/credits"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-info hover:underline"
            >
              Manage credits ↗
            </a>
          </p>
        </div>
      )}
    </SettingsCard>
  );
};
