/**
 * @fileoverview NanoGPT balance + subscription quota glance for AI settings.
 * @module components/settings/components/NanoGPTAccountOverview
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Loader2, RefreshCw, Wallet } from 'lucide-react';
import {
  NanoGPTProvider,
  type NanoGPTBalance,
  type NanoGPTQuotaWindow,
  type NanoGPTSubscriptionState,
  type NanoGPTSubscriptionUsage,
} from '../../../services/providers';
import { SettingsCard } from './SettingsCard';

const nanoProvider = new NanoGPTProvider();

/** Manual refresh cooldown (also protects NanoGPT + free proxy quotas). */
const MANUAL_REFRESH_COOLDOWN_MS = 30_000;
/** Skip auto-refetch when reopening settings with the same key within this window. */
const AUTO_CACHE_TTL_MS = 60_000;

/**
 * Module-level cache so close/reopen Settings does not re-hit NanoGPT / the free proxy.
 * Component unmount must not reset cooldown or TTL.
 */
interface AccountSessionCache {
  cacheKey: string;
  fetchedAt: number;
  cooldownUntil: number;
  usage: NanoGPTSubscriptionUsage | null;
  balance: NanoGPTBalance | null;
  usageError: string | null;
  balanceError: string | null;
  status: LoadStatus;
}

let accountSessionCache: AccountSessionCache | null = null;

function makeCacheKey(baseUrl: string, apiKey: string): string {
  return `${normalizeCacheKey(baseUrl)}|${apiKey.trim()}`;
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

interface NanoGPTAccountOverviewProps {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

function formatUsd(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `$${value}`;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: n >= 1 ? 2 : 4,
  }).format(n);
}

function formatNano(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n === 0) return '0';
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatTokenCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${trimFloat(v)}B`;
  }
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    return `${trimFloat(v)}M`;
  }
  if (abs >= 10_000) {
    const v = n / 1_000;
    return `${trimFloat(v)}K`;
  }
  return n.toLocaleString();
}

function trimFloat(v: number): string {
  const fixed = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatResetAt(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return 'Unknown';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const now = Date.now();
  const diff = ms - now;
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
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
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

const statusBadgeStyles: Record<
  NanoGPTSubscriptionState,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: 'Active',
    className:
      'bg-success-soft text-success-soft-fg border-success/30',
    dot: 'bg-success',
  },
  grace: {
    label: 'Grace period',
    className:
      'bg-warning-soft text-warning-soft-fg border-warning/30',
    dot: 'bg-amber-500',
  },
  inactive: {
    label: 'Not active',
    className:
      'bg-muted text-fg-muted bg-muted text-fg-muted border-border',
    dot: 'bg-vault-400',
  },
};

/** Prefer explicit state; fall back to active boolean if state is missing/unexpected */
function resolveSubState(usage: NanoGPTSubscriptionUsage): NanoGPTSubscriptionState {
  if (usage.state === 'active' || usage.state === 'grace' || usage.state === 'inactive') {
    // API can report state active while active:false in edge cases — trust active flag for inactive
    if (!usage.active && usage.state === 'active') return 'inactive';
    return usage.state;
  }
  return usage.active ? 'active' : 'inactive';
}

function normalizeCacheKey(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').toLowerCase();
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

interface QuotaBarProps {
  label: string;
  window: NanoGPTQuotaWindow;
  unitLabel: string;
  formatUsed?: (n: number) => string;
}

const QuotaBar: React.FC<QuotaBarProps> = ({
  label,
  window: w,
  unitLabel,
  formatUsed = formatTokenCount,
}) => {
  const status = barStatus(w.percentUsed);
  const pct = Math.min(100, Math.max(0, w.percentUsed * 100));
  const limit = w.used + w.remaining;
  const fullUsed = w.used.toLocaleString();
  const fullLimit = limit.toLocaleString();
  const fullRemaining = w.remaining.toLocaleString();

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
      <div
        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-fg-muted"
        title={`${fullUsed} / ${fullLimit} ${unitLabel} used · ${fullRemaining} left`}
      >
        <span>
          <span className="font-medium text-fg-muted">
            {formatUsed(w.used)}
          </span>
          {' / '}
          {formatUsed(limit)} {unitLabel} used
          <span className="text-fg-subtle">
            {' · '}
            {formatUsed(w.remaining)} left
          </span>
        </span>
        <span className="shrink-0">Resets {formatResetAt(w.resetAt)}</span>
      </div>
    </div>
  );
};

export const NanoGPTAccountOverview: React.FC<NanoGPTAccountOverviewProps> = ({
  baseUrl,
  apiKey,
  enabled,
}) => {
  const cachedOnMount = readFreshCache(baseUrl, apiKey);

  const [usage, setUsage] = useState<NanoGPTSubscriptionUsage | null>(
    () => cachedOnMount?.usage ?? null
  );
  const [balance, setBalance] = useState<NanoGPTBalance | null>(
    () => cachedOnMount?.balance ?? null
  );
  const [usageError, setUsageError] = useState<string | null>(
    () => cachedOnMount?.usageError ?? null
  );
  const [balanceError, setBalanceError] = useState<string | null>(
    () => cachedOnMount?.balanceError ?? null
  );
  const [status, setStatus] = useState<LoadStatus>(() => cachedOnMount?.status ?? 'idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(() => getCooldownRemainingSec(baseUrl, apiKey));

  const requestIdRef = useRef(0);

  const updateCooldownDisplay = useCallback(() => {
    setCooldownSec(getCooldownRemainingSec(baseUrl, apiKey));
  }, [apiKey, baseUrl]);

  const applyCacheToState = useCallback((entry: AccountSessionCache) => {
    setUsage(entry.usage);
    setBalance(entry.balance);
    setUsageError(entry.usageError);
    setBalanceError(entry.balanceError);
    setStatus(entry.status);
    setCooldownSec(
      entry.cooldownUntil > Date.now()
        ? Math.ceil((entry.cooldownUntil - Date.now()) / 1000)
        : 0
    );
  }, []);

  const fetchAccount = useCallback(
    async (opts?: { manual?: boolean; force?: boolean }) => {
      if (!enabled || !apiKey.trim()) {
        setUsage(null);
        setBalance(null);
        setUsageError(null);
        setBalanceError(null);
        setStatus('idle');
        setCooldownSec(0);
        return;
      }

      const cacheKey = makeCacheKey(baseUrl, apiKey);
      const now = Date.now();
      const cached =
        accountSessionCache?.cacheKey === cacheKey ? accountSessionCache : null;

      // Manual refresh rate limit (module-level — survives panel close)
      if (opts?.manual && !opts.force && cached && cached.cooldownUntil > now) {
        applyCacheToState(cached);
        return;
      }

      // Auto-fetch: reuse module cache for same key within TTL
      if (!opts?.manual && !opts?.force && cached && now - cached.fetchedAt < AUTO_CACHE_TTL_MS) {
        applyCacheToState(cached);
        return;
      }

      const hadCache = Boolean(cached);
      const requestId = ++requestIdRef.current;
      if (opts?.manual || hadCache) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }

      const [usageResult, balanceResult] = await Promise.allSettled([
        nanoProvider.fetchSubscriptionUsage(baseUrl, apiKey),
        nanoProvider.fetchBalance(baseUrl, apiKey),
      ]);

      if (requestId !== requestIdRef.current) return;

      const nextUsage =
        usageResult.status === 'fulfilled' ? usageResult.value : null;
      const nextUsageError =
        usageResult.status === 'fulfilled'
          ? null
          : usageResult.reason instanceof Error
            ? usageResult.reason.message
            : 'Failed to load subscription usage';
      const nextBalance =
        balanceResult.status === 'fulfilled' ? balanceResult.value : null;
      const nextBalanceError =
        balanceResult.status === 'fulfilled'
          ? null
          : balanceResult.reason instanceof Error
            ? balanceResult.reason.message
            : 'Failed to load balance';
      const nextStatus: LoadStatus =
        usageResult.status === 'fulfilled' || balanceResult.status === 'fulfilled'
          ? 'success'
          : 'error';

      const finishedAt = Date.now();
      const entry: AccountSessionCache = {
        cacheKey,
        fetchedAt: finishedAt,
        cooldownUntil: finishedAt + MANUAL_REFRESH_COOLDOWN_MS,
        usage: nextUsage,
        balance: nextBalance,
        usageError: nextUsageError,
        balanceError: nextBalanceError,
        status: nextStatus,
      };
      accountSessionCache = entry;
      applyCacheToState(entry);
      setIsRefreshing(false);
    },
    [apiKey, applyCacheToState, baseUrl, enabled]
  );

  // Tick cooldown countdown for the Refresh button label
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      updateCooldownDisplay();
    }, 500);
    return () => window.clearInterval(id);
  }, [cooldownSec, updateCooldownDisplay]);

  // Debounced auto-fetch when key / url changes (uses module cache on reopen)
  useEffect(() => {
    if (!enabled) return;

    const delay = apiKey.trim() ? 400 : 0;
    const timer = window.setTimeout(() => {
      void fetchAccount();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [apiKey, baseUrl, enabled, fetchAccount]);

  // Invalidate in-flight responses on unmount (cache remains)
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  if (!enabled) return null;

  const subState = usage ? resolveSubState(usage) : null;
  const badge = subState ? statusBadgeStyles[subState] : null;
  const periodEnd = usage ? formatPeriodEnd(usage.period.currentPeriodEnd) : null;
  const showQuotaBars = subState === 'active' || subState === 'grace';
  const showContent = status === 'success' || (usage !== null || balance !== null);
  const bothFailed = status === 'error' && !usage && !balance;
  const refreshDisabled =
    status === 'loading' || isRefreshing || cooldownSec > 0 || !apiKey.trim();

  return (
    <SettingsCard>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
          <Wallet className="w-4 h-4 text-fg-muted" />
          NanoGPT Account
        </h3>
        {apiKey.trim() && (
          <button
            type="button"
            onClick={() => void fetchAccount({ manual: true })}
            disabled={refreshDisabled}
            title={
              cooldownSec > 0
                ? `Wait ${cooldownSec}s before refreshing again`
                : 'Refresh balance and subscription usage'
            }
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-fg-muted hover:bg-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent/50"
            aria-label={
              cooldownSec > 0
                ? `Refresh available in ${cooldownSec} seconds`
                : 'Refresh NanoGPT account'
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
            <p className="text-sm font-medium text-fg">
              Add your API key to view account info
            </p>
            <p className="text-xs text-fg-muted mt-0.5">
              Enter a key above or use Sign in with NanoGPT to see balance and subscription usage.
            </p>
          </div>
        </div>
      )}

      {apiKey.trim() && bothFailed && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-danger-soft border border-danger/30">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger-soft-fg">
              Could not load account info
            </p>
            <p className="text-xs text-danger mt-0.5">
              {usageError || balanceError || 'Unknown error'}
            </p>
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

      {/*
        Always reserve the loaded layout height when a key is present so settings
        below (e.g. reasoning effort) do not jump when usage/balance finish loading.
      */}
      {apiKey.trim() && !bothFailed && (
        <div
          className="space-y-4"
          aria-busy={status === 'loading' && !showContent}
          aria-live="polite"
        >
          {/* Hero: balance + status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-linear-to-br from-muted to-surface border border-border min-h-[88px]">
              <div className="text-xs font-medium text-fg-muted mb-1">
                Balance
              </div>
              {showContent && balance ? (
                <>
                  <div className="text-xl font-bold text-fg tabular-nums tracking-tight">
                    {formatUsd(balance.usdBalance)}
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    {formatNano(balance.nanoBalance)} XNO
                  </div>
                </>
              ) : showContent && balanceError ? (
                <div className="flex items-start gap-1.5 text-xs text-fg-muted">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{balanceError}</span>
                </div>
              ) : showContent ? (
                <span className="text-fg-subtle text-xs">—</span>
              ) : (
                <div className="animate-pulse space-y-2" aria-hidden>
                  <div className="h-7 w-24 rounded bg-hover" />
                  <div className="h-3 w-16 rounded bg-vault-200/80 bg-hover/80" />
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-linear-to-br from-muted to-surface border border-border min-h-[88px]">
              <div className="text-xs font-medium text-fg-muted mb-1">
                Subscription
              </div>
              {showContent && usage && badge && subState ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>
                  {subState === 'inactive' && (
                    <p className="text-xs text-fg-muted mt-1.5 leading-relaxed">
                      No active subscription. Requests use your balance (pay-as-you-go).
                    </p>
                  )}
                  {subState === 'active' && periodEnd && (
                    <div className="text-xs text-fg-muted mt-1.5">
                      Period ends {periodEnd}
                    </div>
                  )}
                  {subState === 'grace' && (
                    <>
                      {usage.graceUntil && (
                        <div className="text-xs text-warning mt-1.5">
                          Grace until{' '}
                          {new Date(usage.graceUntil).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                      {periodEnd && !usage.graceUntil && (
                        <div className="text-xs text-fg-muted mt-1.5">
                          Period ends {periodEnd}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : showContent && usageError ? (
                <div className="flex items-start gap-1.5 text-xs text-fg-muted">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    {/cors/i.test(usageError)
                      ? 'Subscription status unavailable (NanoGPT blocks this API in browsers). Official app and localhost need no worker. Self-hosted production: see docs → NanoGPT Usage Proxy.'
                      : usageError}
                  </span>
                </div>
              ) : showContent ? (
                <span className="text-fg-subtle text-xs">—</span>
              ) : (
                <div className="animate-pulse space-y-2" aria-hidden>
                  <div className="h-6 w-20 rounded-full bg-hover" />
                  <div className="h-3 w-28 rounded bg-vault-200/80 bg-hover/80" />
                </div>
              )}
            </div>
          </div>

          {/*
            Lower section: real quota / inactive CTA when loaded; skeleton otherwise.
            min-height matches ~1 quota bar + footnote so active subs don't shove content down.
          */}
          <div className="min-h-[7.5rem]">
            {showContent && usage && showQuotaBars && (
              <div className="space-y-3">
                {usage.weeklyInputTokens && (
                  <QuotaBar
                    label="Weekly input tokens"
                    window={usage.weeklyInputTokens}
                    unitLabel="tokens"
                  />
                )}
                {usage.dailyInputTokens && (
                  <QuotaBar
                    label="Daily input tokens"
                    window={usage.dailyInputTokens}
                    unitLabel="tokens"
                  />
                )}
                {usage.dailyImages && (
                  <QuotaBar
                    label="Daily images"
                    window={usage.dailyImages}
                    unitLabel="images"
                    formatUsed={(n) => n.toLocaleString()}
                  />
                )}
                {!usage.weeklyInputTokens &&
                  !usage.dailyInputTokens &&
                  !usage.dailyImages && (
                    <p className="text-xs text-fg-muted">
                      No quota windows reported for this account.
                    </p>
                  )}
                {usage.allowOverage && (
                  <p className="text-xs text-fg-muted">
                    Overage enabled — after included limits, usage bills to your balance.
                  </p>
                )}
                <p className="text-[11px] text-fg-subtle">
                  Weekly input tokens are subscription-covered input only (not $ spend).
                </p>
              </div>
            )}

            {showContent && usage && subState === 'inactive' && (
              <div className="p-3 rounded-lg bg-bg/40 border border-dashed border-border-strong">
                <p className="text-sm font-medium text-fg">
                  Subscription not active
                </p>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                  You don&apos;t have an active NanoGPT subscription, so included weekly token
                  limits don&apos;t apply. Your balance above is used for pay-as-you-go models.
                </p>
                <a
                  href="https://nano-gpt.com/subscription"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-medium text-info hover:underline"
                >
                  View NanoGPT subscription ↗
                </a>
              </div>
            )}

            {!showContent && (
              <div className="space-y-3" aria-hidden>
                <div className="p-3 rounded-lg bg-bg/40 border border-border animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-3 w-32 rounded bg-hover" />
                    <div className="h-3 w-8 rounded bg-hover" />
                  </div>
                  <div className="h-2 rounded-full bg-hover mb-2" />
                  <div className="h-3 w-48 rounded bg-vault-200/80 bg-hover/80" />
                </div>
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  Loading account…
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SettingsCard>
  );
};
