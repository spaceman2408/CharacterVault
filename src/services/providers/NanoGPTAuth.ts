/**
 * @fileoverview "Sign in with NanoGPT" OAuth PKCE browser key handoff.
 * @module @services/providers/NanoGPTAuth
 *
 * Implements the browser key handoff flow documented at
 * https://nano-gpt.com/blog/sign-in-with-nanogpt-oauth-pkce:
 *   1. Generate a PKCE S256 verifier/challenge plus a random state.
 *   2. Open https://nano-gpt.com/auth in a popup (falls back to a new tab).
 *   3. A standalone relay page (public/nanogpt-callback.html) receives the
 *      redirect and forwards the `code` + `state` back to this window via
 *      postMessage. The code_verifier never leaves this window.
 *   4. Exchange the code at https://nano-gpt.com/api/v1/auth/keys using the
 *      stored verifier, receiving a dedicated `sk-nano-...` API key.
 *
 * The returned key is a normal NanoGPT API key and drops straight into the
 * existing NanoGPTProvider — no provider changes required.
 */

const NANOGPT_AUTH_ENDPOINT = 'https://nano-gpt.com/auth';
const NANOGPT_TOKEN_ENDPOINT = 'https://nano-gpt.com/api/v1/auth/keys';
const DEFAULT_SCOPE = 'api.use models.read';
const CALLBACK_PAGE = 'nanogpt-callback.html';

/** sessionStorage key holding the in-flight PKCE verifier + state. */
const PENDING_FLOW_KEY = 'nanogpt_oauth_pending';

/** Shape persisted to sessionStorage while a sign-in is in flight. */
interface PendingFlow {
  codeVerifier: string;
  state: string;
}

/** Token endpoint response. `key` is the primary field; `access_token` is a fallback. */
interface TokenResponse {
  key?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  user_id?: string;
}

/** postMessage payload emitted by the relay callback page. */
export interface OAuthCallbackMessage {
  type: 'nanogpt-oauth-callback';
  code: string;
  state: string;
}

/**
 * Base64url-encode an ArrayBuffer, stripping padding per RFC 7636 / RFC 4648.
 */
function base64url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate a high-entropy random base64url string of the given byte length. */
function randomBase64url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a PKCE S256 verifier/challenge pair.
 * The verifier is a random 256-bit base64url string; the challenge is the
 * base64url-encoded SHA-256 hash of the verifier.
 */
export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = randomBase64url(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return { codeVerifier, codeChallenge: base64url(digest) };
}

/** Generate a random opaque state token used to bind the round-trip. */
export function generateState(): string {
  return randomBase64url(16);
}

/**
 * Resolve the full callback URL for the current deployment.
 * Uses the app origin + Vite base path so it works in dev (loopback HTTP)
 * and production (HTTPS). No fragment, so NanoGPT's strict redirect-URI
 * validation accepts it.
 */
export function getCallbackUrl(): string {
  const base = import.meta.env.BASE_URL;
  return `${window.location.origin}${base}${CALLBACK_PAGE}`;
}

/**
 * Build the NanoGPT authorization URL and persist the PKCE verifier + state
 * so the eventual code exchange can complete. Returns the URL to open.
 */
export async function buildAuthUrl(): Promise<string> {
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  const state = generateState();

  const pending: PendingFlow = { codeVerifier, state };
  sessionStorage.setItem(PENDING_FLOW_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    callback_url: getCallbackUrl(),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: DEFAULT_SCOPE,
    state,
  });

  return `${NANOGPT_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Open the NanoGPT authorization screen. Tries a centered popup first; if the
 * popup is blocked, falls back to a new tab. The relay page relies on
 * `window.opener`, so no `noopener` is used.
 */
export async function startSignIn(): Promise<Window | null> {
  const url = await buildAuthUrl();
  const popup = window.open(url, 'nanogpt-oauth', 'popup,width=560,height=720');
  if (!popup) {
    // Popup blocked — open in a new tab (opener reference preserved).
    return window.open(url, 'nanogpt-oauth');
  }
  return popup;
}

/** Drop PKCE verifier/state if the settings panel closes mid-flow. */
export function cancelPendingSignIn(): void {
  sessionStorage.removeItem(PENDING_FLOW_KEY);
}

/**
 * Consume the pending flow and validate the returned state (CSRF guard).
 * Returns the stored code_verifier. Throws if no flow is pending or the
 * state does not match.
 */
function consumePendingFlow(state: string): string {
  const raw = sessionStorage.getItem(PENDING_FLOW_KEY);
  sessionStorage.removeItem(PENDING_FLOW_KEY);
  if (!raw) {
    throw new Error('No NanoGPT sign-in in progress. Please try again.');
  }
  const pending = JSON.parse(raw) as PendingFlow;
  if (!constantTimeEqual(pending.state, state)) {
    throw new Error('Sign-in state mismatch — request aborted for your security.');
  }
  return pending.codeVerifier;
}

/** Constant-time string comparison to avoid timing side channels on the state. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Exchange an authorization code for a NanoGPT API key.
 * The verifier stored alongside the original sign-in request is consumed and
 * validated against `state`.
 */
export async function exchangeCode(code: string, state: string): Promise<string> {
  const codeVerifier = consumePendingFlow(state);

  const response = await fetch(NANOGPT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; error_description?: string };
      const message = body?.error_description ?? body?.error;
      if (message) {
        detail = message;
      }
    } catch {
      // Response body was not JSON — keep the status-based detail.
    }
    throw new Error(`NanoGPT sign-in failed: ${detail}`);
  }

  const data = (await response.json()) as TokenResponse;
  const key = data.key ?? data.access_token;
  if (!key) {
    throw new Error('NanoGPT did not return an API key.');
  }
  return key;
}

/**
 * Validate and extract a NanoGPT OAuth callback from a `message` event.
 * Returns the code/state pair when the event originates from the relay page
 * on the same origin, otherwise `null`.
 */
export function isOAuthCallbackMessage(event: MessageEvent): OAuthCallbackMessage | null {
  if (event.origin !== window.location.origin) return null;
  const data = event.data as Partial<OAuthCallbackMessage> | null;
  if (!data || typeof data !== 'object') return null;
  if (data.type !== 'nanogpt-oauth-callback') return null;
  const code = data.code;
  const state = data.state;
  if (typeof code !== 'string' || typeof state !== 'string') return null;
  return { type: 'nanogpt-oauth-callback', code, state };
}
