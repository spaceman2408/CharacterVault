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
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  grace: {
    label: 'Grace period',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  inactive: {
    label: 'Not active',
    className:
      'bg-vault-100 text-vault-600 dark:bg-vault-800 dark:text-vault-300 border-vault-200 dark:border-vault-700',
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
  good: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
};

const barTextStyles: Record<BarStatus, string> = {
  good: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger: 'text-red-600 dark:text-red-400',
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
    <div className="p-3 rounded-lg bg-vault-50 dark:bg-vault-900/40 border border-vault-200 dark:border-vault-700">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-medium text-vault-700 dark:text-vault-300">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${barTextStyles[status]}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-vault-200 dark:bg-vault-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${barFillStyles[status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-vault-500 dark:text-vault-400"
        title={`${fullUsed} / ${fullLimit} ${unitLabel} used · ${fullRemaining} left`}
      >
        <span>
          <span className="font-medium text-vault-700 dark:text-vault-300">
            {formatUsed(w.used)}
          </span>
          {' / '}
          {formatUsed(limit)} {unitLabel} used
          <span className="text-vault-400 dark:text-vault-500">
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
  const [usage, setUsage] = useState<NanoGPTSubscriptionUsage | null>(null);
  const [balance, setBalance] = useState<NanoGPTBalance | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const lastFetchKeyRef = useRef('');
  const cooldownUntilRef = useRef(0);

  const updateCooldownDisplay = useCallback(() => {
    const remainingMs = cooldownUntilRef.current - Date.now();
    setCooldownSec(remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0);
  }, []);

  const fetchAccount = useCallback(
    async (opts?: { manual?: boolean; force?: boolean }) => {
      if (!enabled || !apiKey.trim()) {
        setUsage(null);
        setBalance(null);
        setUsageError(null);
        setBalanceError(null);
        setStatus('idle');
        return;
      }

      const cacheKey = `${normalizeCacheKey(baseUrl)}|${apiKey.trim()}`;
      const now = Date.now();

      // Manual refresh rate limit
      if (opts?.manual && !opts.force) {
        const until = cooldownUntilRef.current;
        if (until > now) {
          updateCooldownDisplay();
          return;
        }
      }

      // Auto-fetch: reuse recent result for same key/url
      if (
        !opts?.manual &&
        !opts?.force &&
        hasLoadedOnceRef.current &&
        lastFetchKeyRef.current === cacheKey &&
        now - lastFetchAtRef.current < AUTO_CACHE_TTL_MS
      ) {
        return;
      }

      const requestId = ++requestIdRef.current;
      if (opts?.manual || hasLoadedOnceRef.current) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }

      const [usageResult, balanceResult] = await Promise.allSettled([
        nanoProvider.fetchSubscriptionUsage(baseUrl, apiKey),
        nanoProvider.fetchBalance(baseUrl, apiKey),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value);
        setUsageError(null);
      } else {
        setUsage(null);
        setUsageError(
          usageResult.reason instanceof Error
            ? usageResult.reason.message
            : 'Failed to load subscription usage'
        );
      }

      if (balanceResult.status === 'fulfilled') {
        setBalance(balanceResult.value);
        setBalanceError(null);
      } else {
        setBalance(null);
        setBalanceError(
          balanceResult.reason instanceof Error
            ? balanceResult.reason.message
            : 'Failed to load balance'
        );
      }

      const finishedAt = Date.now();
      hasLoadedOnceRef.current = true;
      lastFetchAtRef.current = finishedAt;
      lastFetchKeyRef.current = cacheKey;
      cooldownUntilRef.current = finishedAt + MANUAL_REFRESH_COOLDOWN_MS;
      updateCooldownDisplay();

      setIsRefreshing(false);
      setStatus(
        usageResult.status === 'fulfilled' || balanceResult.status === 'fulfilled'
          ? 'success'
          : 'error'
      );
    },
    [apiKey, baseUrl, enabled, updateCooldownDisplay]
  );

  // Tick cooldown countdown for the Refresh button label
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      updateCooldownDisplay();
    }, 500);
    return () => window.clearInterval(id);
  }, [cooldownSec, updateCooldownDisplay]);

  // Debounced auto-fetch when key / url changes (immediate clear when key emptied)
  useEffect(() => {
    if (!enabled) return;

    const delay = apiKey.trim() ? 400 : 0;
    const timer = window.setTimeout(() => {
      if (!apiKey.trim()) {
        hasLoadedOnceRef.current = false;
        lastFetchKeyRef.current = '';
        lastFetchAtRef.current = 0;
      }
      void fetchAccount();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [apiKey, baseUrl, enabled, fetchAccount]);

  // Invalidate in-flight responses on unmount
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
        <h3 className="text-sm font-semibold text-vault-800 dark:text-vault-200 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-vault-600 dark:text-vault-400" />
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
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vault-500/50"
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
        <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-50 dark:bg-vault-900/40 border border-vault-200 dark:border-vault-700">
          <KeyRound className="w-4 h-4 text-vault-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-vault-800 dark:text-vault-200">
              Add your API key to view account info
            </p>
            <p className="text-xs text-vault-500 dark:text-vault-400 mt-0.5">
              Enter a key above or use Sign in with NanoGPT to see balance and subscription usage.
            </p>
          </div>
        </div>
      )}

      {apiKey.trim() && status === 'loading' && !showContent && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-vault-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading account…
        </div>
      )}

      {apiKey.trim() && bothFailed && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Could not load account info
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              {usageError || balanceError || 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={() => void fetchAccount({ manual: true })}
              className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {apiKey.trim() && showContent && (
        <div className="space-y-4">
          {/* Hero: balance + status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-linear-to-br from-vault-50 to-white dark:from-vault-900/50 dark:to-vault-800/30 border border-vault-200 dark:border-vault-700">
              <div className="text-xs font-medium text-vault-500 dark:text-vault-400 mb-1">
                Balance
              </div>
              {balance ? (
                <>
                  <div className="text-xl font-bold text-vault-900 dark:text-vault-100 tabular-nums tracking-tight">
                    {formatUsd(balance.usdBalance)}
                  </div>
                  <div className="text-xs text-vault-500 dark:text-vault-400 mt-0.5">
                    {formatNano(balance.nanoBalance)} XNO
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-1.5 text-xs text-vault-500 dark:text-vault-400">
                  {balanceError ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{balanceError}</span>
                    </>
                  ) : (
                    <span className="text-vault-400">—</span>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-linear-to-br from-vault-50 to-white dark:from-vault-900/50 dark:to-vault-800/30 border border-vault-200 dark:border-vault-700">
              <div className="text-xs font-medium text-vault-500 dark:text-vault-400 mb-1">
                Subscription
              </div>
              {usage && badge && subState ? (
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
                    <p className="text-xs text-vault-500 dark:text-vault-400 mt-1.5 leading-relaxed">
                      No active subscription. Requests use your balance (pay-as-you-go).
                    </p>
                  )}
                  {subState === 'active' && periodEnd && (
                    <div className="text-xs text-vault-500 dark:text-vault-400 mt-1.5">
                      Period ends {periodEnd}
                    </div>
                  )}
                  {subState === 'grace' && (
                    <>
                      {usage.graceUntil && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                          Grace until{' '}
                          {new Date(usage.graceUntil).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                      {periodEnd && !usage.graceUntil && (
                        <div className="text-xs text-vault-500 dark:text-vault-400 mt-1.5">
                          Period ends {periodEnd}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-1.5 text-xs text-vault-500 dark:text-vault-400">
                  {usageError ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        {/cors/i.test(usageError)
                          ? 'Subscription status unavailable (NanoGPT blocks this API in browsers). Local: restart npm run dev. Production: deploy the free Cloudflare Worker proxy and set VITE_NANOGPT_PROXY.'
                          : usageError}
                      </span>
                    </>
                  ) : (
                    <span className="text-vault-400">—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quota bars — only when sub is active or in grace (inactive accounts still get a clear CTA) */}
          {usage && showQuotaBars && (
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
                  <p className="text-xs text-vault-500 dark:text-vault-400">
                    No quota windows reported for this account.
                  </p>
                )}
              {usage.allowOverage && (
                <p className="text-xs text-vault-500 dark:text-vault-400">
                  Overage enabled — after included limits, usage bills to your balance.
                </p>
              )}
              <p className="text-[11px] text-vault-400 dark:text-vault-500">
                Weekly input tokens are subscription-covered input only (not $ spend).
              </p>
            </div>
          )}

          {usage && subState === 'inactive' && (
            <div className="p-3 rounded-lg bg-vault-50 dark:bg-vault-900/40 border border-dashed border-vault-300 dark:border-vault-600">
              <p className="text-sm font-medium text-vault-800 dark:text-vault-200">
                Subscription not active
              </p>
              <p className="text-xs text-vault-500 dark:text-vault-400 mt-1 leading-relaxed">
                You don&apos;t have an active NanoGPT subscription, so included weekly token
                limits don&apos;t apply. Your balance above is used for pay-as-you-go models.
              </p>
              <a
                href="https://nano-gpt.com/subscription"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                View NanoGPT subscription ↗
              </a>
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  );
};
