# Privacy

This notice describes how the **CharacterVault** web app handles information when you use the hosted site or a self-hosted copy.

CharacterVault is open source under the [GNU General Public License v3.0](https://github.com/spaceman2408/CharacterVault/blob/main/LICENSE). This page is about privacy, not the software license.

## Summary

- Character cards and settings are stored **in your browser** (IndexedDB and related local storage).
- CharacterVault does **not** provide accounts, cloud sync, or a backend that stores your cards.
- Optional **AI features** send content to the provider **you** configure; that is outside CharacterVault’s control.
- The public app is served from **Cloudflare Pages**; Cloudflare may process standard website access data under their policies.

## Local data

When you create or edit characters and **standalone lorebooks**, data such as card fields, images, lorebook entries, snapshots, attachment links, app settings, and optional **custom AI context** notes is kept locally in your browser. It is not uploaded to a CharacterVault server, because the core app has no such server.

Custom context and lorebook **links** (which library book a character uses) stay in this browser only. They are not written into PNG/JSON by themselves. The lorebook **text on the character** is what card export includes — and after you link a book, that text stays matched with the library book. Clearing site data, using a different browser or device, or uninstalling browser storage for this origin can remove local data. Export cards, lorebook JSON, or vault backups for portable copies; keep a separate copy of custom notes if you need them elsewhere.

## Hosted site (Cloudflare Pages)

The official app is [vault.charactervault.app](https://vault.charactervault.app). The marketing site is [charactervault.app](https://charactervault.app). Both are hosted on **Cloudflare Pages**. CharacterVault’s maintainers do not operate a separate application server for the core product.

Browser storage is **origin-scoped**. Cards and settings saved on an older GitHub Pages URL (`spaceman2408.github.io`) stay there; they do not appear on `vault.charactervault.app`. Export a vault backup from the old origin and import the files on the current app if you need to move a library.

Like most static sites, hosting may involve normal web request metadata (for example IP address, user agent, and requested URLs). That processing is governed by [Cloudflare’s Privacy Policy](https://www.cloudflare.com/privacypolicy/), not by a CharacterVault database of user accounts.

If you run CharacterVault yourself (local build or your own host), only that host’s operators and your browser apply.

## AI features (optional)

AI tools (Orion chat, the Agent, the AI toolbar, AI Creation Studio, and similar) only work after you configure a provider (API base URL, key, and model, or a sign-in flow such as NanoGPT where offered).

When you use those features, text and context you send (for example selected sections of a card, enabled custom context notes, chat messages, Agent catalogs and field or entry bodies it reads, or generation prompts) are transmitted to **that provider** so a model can respond. CharacterVault does not intermediate those requests through a CharacterVault-owned AI backend for the standard open-source app.

- Your provider’s privacy policy and terms apply to that traffic.
- API keys and related credentials are stored **locally** in your browser settings, not on CharacterVault servers.
- If you self-host optional helpers (for example a NanoGPT usage proxy), traffic and logs for that component follow **your** deployment and configuration.

## What we do not do

For the standard browser app and public Cloudflare Pages build, CharacterVault maintainers do not:

- Require an account to use core library and editor features
- Sell your character cards or settings
- Run a CharacterVault cloud store of your library

Third-party sites and extensions you choose to use (SillyTavern, model hosts, browsers, and so on) have their own policies.

## Cookies and similar storage

CharacterVault uses browser storage needed to run the app (for example IndexedDB for characters, and local settings such as theme or dismissed UI hints). It is not an advertising product and does not load third-party ad trackers as part of the core app.

## Children

CharacterVault is a general-purpose creative tool. It is not directed at children, and we do not knowingly collect personal information from children through a CharacterVault account system (there is no such system).

## Changes

This notice may be updated as the project changes. The current version lives in the repository and on the docs site. Material changes should be reflected there when the site is redeployed.

## Contact

Questions or concerns: open an issue on the [CharacterVault GitHub repository](https://github.com/spaceman2408/CharacterVault).

---

*This page is informational and is not legal advice.*
