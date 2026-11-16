# API Key Safety

CharacterVault saves your API keys in your browser as plain text and doesn't try to hide or scramble them. This page explains why, and how to keep a leaked key from costing you much.

## Why keys aren't encrypted

CharacterVault has no backend. Your browser calls your AI provider directly, so the app needs your real key every time it sends a request.

To encrypt a key, the app has to keep a decryption key somewhere. There are only two places it could go:

- **In the browser, next to the encrypted key.** Anything that can read your saved settings (an extension, malware, someone at your computer) can read the decryption key too, and unlock the API key in a second. This only looks like protection.
- **In your head, as a password.** This one works, but you would have to type the password every time you open the app, and a forgotten password means re-entering every key. That's friction we don't want for a local creative tool.

A server that keeps keys for you wouldn't help either. You would be trusting that server instead of your own browser, and CharacterVault deliberately doesn't run one.

Even with encryption, the key has to be decrypted to make a request. It shows up in the request headers, which you can see in your browser's developer tools. Hiding it in storage wouldn't change that.

So CharacterVault keeps keys local, sends them only to the provider you set up, and leaves the rest to the controls your provider already offers.

## What CharacterVault does

- Keys stay in this browser's storage for the CharacterVault site. They are never sent to a CharacterVault server.
- AI requests go straight from your browser to your provider. The one exception is the NanoGPT usage check, which goes through a proxy that doesn't log or store your key. See [Privacy](/privacy#nanogpt-usage-check).
- Backups leave keys out unless you check **Include API keys**. A backup that includes them is as sensitive as the keys themselves.
- **Clear AI Settings** at the top of **Settings → AI Config** removes the saved keys for every provider.
- Scripts in imported cards' Creator Notes never run, so a card can't read your settings.

## Protect yourself with limits and rotation

Assume a key could leak one day, and set it up so a leak is cheap and easy to undo.

### Use a separate key for CharacterVault

Create a key just for CharacterVault instead of reusing one from other apps. If it leaks, you revoke that one key and nothing else breaks. Your provider's usage page will also show exactly what CharacterVault spent.

### Set a spending limit

Many providers let you cap how much a key, or the whole account, can spend. Set the cap close to what you actually use in a month.

- Use a **per-key limit** if your provider has one (OpenRouter does). A leaked key stops working once it hits the cap.
- Otherwise, set an **account budget** or **usage alert** in the provider's dashboard.
- Prefer **prepaid credits** over auto-recharge from a card. A leaked key can only spend what is already in the account.

### Rotate keys

Rotating means making a new key, pasting it into CharacterVault, and deleting the old one at the provider.

1. Create a new key in your provider's dashboard.
2. Paste it into **Settings → AI Config → API Key** for that provider.
3. Revoke the old key at the provider.

Rotate every few months, and right away if:

- You see usage you don't recognize.
- You shared a backup that included API keys.
- You used CharacterVault on a computer that isn't yours.
- You installed a browser extension you no longer trust.

### Check your usage

Look at your provider's usage or activity page now and then. Requests you didn't make, models you don't use, or spending at odd hours mean the key leaked: revoke it first, then look into how.

### Keep your browser clean

- Install only browser extensions you trust. Extensions with access to all sites can read page storage.
- On a shared or public computer, click **Clear AI Settings** before you leave, or use a private window.
- Don't paste keys into chats, screenshots, or bug reports. If you do, rotate the key.

## Use a separate browser for CharacterVault

For the most isolation, install a browser you don't already use and keep it only for CharacterVault. For example, if your main browser is Chrome, install Brave (or Firefox, Edge, and so on) just for CharacterVault.

- **Install no extensions.** With no extensions, nothing else can read the page's storage.
- **Use it only for CharacterVault.** Don't browse, sign in to other sites, or open links in it. Make it the only thing that browser is for.
- **Keep it updated.** Leave automatic updates on so security fixes arrive.

Browsers don't share storage, so your library won't follow you to the new browser automatically. In your current browser, use **Backup** in the library header to make a ZIP, then **Import** it in the new browser. Paste your API keys in fresh instead of including them in the backup, and delete the ZIP when you're done. Once everything is there, click **Clear AI Settings** in your old browser so the keys only live in one place.

By maintaining these habits, the chance of your key leaking or being used against your will is low. Safety starts with you.

<p style="text-align: right"><em>— Spaceman2408</em></p>
