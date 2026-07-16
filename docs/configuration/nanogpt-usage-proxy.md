# NanoGPT Usage Proxy (Self-Hosted Production)

This page is **only** for people who build and host **their own** CharacterVault production site and want NanoGPT **subscription status** and **weekly token** details in Settings.

## You almost certainly do not need this

| Situation | Need this worker? |
| :--- | :--- |
| **Using the official hosted app** | **No.** The public site already provides the proxy. |
| **Running locally with `npm run dev`** | **No.** Vite proxies NanoGPT usage for you automatically. Restart the dev server if something looks stale. |
| **`vite preview` / localhost production build** | **No.** Localhost can use the same Vite preview proxy path. |
| **Self-hosting a production build** (your own domain, static host, etc.) | **Yes, if** you want subscription status and weekly quotas. Balance and models still work without it. |

::: danger Do not deploy this for localhost
If you only run CharacterVault with `npm run dev` on your machine, **stop here**. You do not need Cloudflare, Wrangler, or `VITE_NANOGPT_PROXY`.
:::

### What breaks without a proxy (self-host only)

- **Still works:** API key, models list, balance (USD / Nano), chat, toolbar AI, sign-in  
- **May fail in the browser:** subscription active / grace / inactive badge, weekly (and other) quota bars  

NanoGPT’s subscription usage API does not send browser CORS headers. A tiny proxy adds them. Balance and models do not need this.

---

## When you *are* self-hosting production

You need three things:

1. The free Cloudflare Worker in this repo (`workers/nanogpt-usage-proxy/`)
2. Its public URL after deploy
3. That URL baked into your **production build** via `VITE_NANOGPT_PROXY`

### Prerequisites

- A free [Cloudflare](https://www.cloudflare.com/) account  
- Node.js / npm (you already use these for CharacterVault)  
- The CharacterVault repo checked out on your machine  

### Step 1 — Log in to Cloudflare from the CLI

From any directory:

```bash
npx wrangler login
```

Complete the browser login when Wrangler opens it.

### Step 2 — Deploy the worker

From the **CharacterVault repo root**:

```bash
cd workers/nanogpt-usage-proxy
npx wrangler deploy
```

Wrangler prints a workers.dev URL, for example:

```text
https://character-vault-nanogpt-usage.<your-subdomain>.workers.dev
```

Copy the **full** URL (including `https://`). Do not use only the account subdomain root.

The worker only allows `GET /api/subscription/v1/usage`. It does not store API keys; it forwards your request headers and adds CORS.

### Step 3 — Point CharacterVault at the worker at build time

`VITE_NANOGPT_PROXY` must be set when you run the **production** build. Vite bakes it into the JS bundle. Setting it only in the shell after `npm run build` does nothing for an already-built site.

**Option A — `.env.production` (local builds)**

In the repo root (this file is typically gitignored):

```bash
VITE_NANOGPT_PROXY=https://character-vault-nanogpt-usage.<your-subdomain>.workers.dev
```

Then:

```bash
npm run build
```

**Option B — CI / one-shot env**

```bash
# Linux / macOS
export VITE_NANOGPT_PROXY=https://character-vault-nanogpt-usage.<your-subdomain>.workers.dev
npm run build

# Windows PowerShell
$env:VITE_NANOGPT_PROXY="https://character-vault-nanogpt-usage.<your-subdomain>.workers.dev"
npm run build
```

Use the exact URL Wrangler printed. No trailing slash required (CharacterVault normalizes it).

### Step 4 — Deploy your `dist/` as usual

Upload or publish the new `dist/` output to **your** production host the way you already do (static host, reverse proxy, etc.).

### Step 5 — Verify

1. Open **your** self-hosted CharacterVault (not only localhost).  
2. **Settings → AI Config → Nano-GPT** with a valid key.  
3. Open **NanoGPT Account**.  
4. You should see balance **and** subscription status / quotas when NanoGPT returns them.  
5. Use **Refresh** if you just deployed (respect the short cooldown).

If balance works but subscription still errors, double-check:

- You rebuilt **after** setting `VITE_NANOGPT_PROXY`  
- The deployed site is that new build  
- The worker URL opens and is the usage path (not a random workers.dev homepage)  
- Wrangler deploy succeeded and the worker name matches the URL  

---

## Optional: change the worker name

In `workers/nanogpt-usage-proxy/wrangler.toml`, `name` defaults to `character-vault-nanogpt-usage`. You can rename it before deploy; then use the new URL in `VITE_NANOGPT_PROXY`.

---

## Security notes (short)

- The worker only proxies one NanoGPT path.  
- It does not log or store your API key; keys pass through in request headers.  
- Prefer keeping the worker URL only in your private build env / CI secrets.  

---

## Related

- [AI Setup → NanoGPT Account](/configuration/ai-setup#nanogpt-account-overview)  
- [Installation](/getting-started/installation)  
- Source: `workers/nanogpt-usage-proxy/` in the repository  
