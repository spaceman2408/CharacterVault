# Security Policy

## Reporting a vulnerability

Please don't report security issues in public issues, pull requests, or Discord channels.

[Report it privately on GitHub](https://github.com/spaceman2408/CharacterVault/security/advisories/new) instead. Only the maintainer can see the report. If you can't use GitHub, message spaceman2408 directly on [Discord](https://discord.gg/T9jbbArPrF) and we'll find a private way to share details.

Please include:

- What the issue is and what an attacker could do with it
- Steps to reproduce, or a sample card, lorebook, or file that triggers it
- The browser you used, and whether you tested the hosted site or a local build

You'll get a reply within a week, often sooner. This is a one-person project, so please allow reasonable time for a fix before you disclose publicly. You'll be credited in the release notes unless you'd rather not be.

## Supported versions

Only the latest release gets fixes. That's the version on [vault.charactervault.app](https://vault.charactervault.app) and the `main` branch.

## Scope

CharacterVault runs in your browser. It has no accounts and no server that stores your cards, so most of the risk is in what the app does with files and text it didn't write itself.

In scope:

- **The web app** (`src/`): for example, script injection through an imported card, a lorebook, Creator Notes, or AI replies; a way around the Creator Notes preview sandbox; or a crafted PNG, JSON, or ZIP file that crashes or takes over the app.
- **API key handling**: keys leaking to anyone other than the provider you set up, or into exports when you didn't opt in.
- **The NanoGPT usage proxy** (`functions/__nanogpt/` on the hosted site, `workers/nanogpt-usage-proxy/` for self-hosting): for example, forwarding to any path other than the usage endpoint, or exposing a key that passes through it.
- **The docs and landing sites**, if a bug there could affect users.

Out of scope:

- Problems at your AI provider, or with content a model generates
- Anything that needs someone who already controls your browser or device
- Cloudflare's own infrastructure. Report those to [Cloudflare](https://www.cloudflare.com/disclosure/)
- Missing security headers or version disclosure with no clear attack

## How your data is handled

See the [Privacy notice](https://vault.charactervault.app/docs/privacy) for what's stored locally and what goes to your AI provider.
