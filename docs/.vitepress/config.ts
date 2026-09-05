import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Docs',
  description: 'AI Character Management Suite',
  base: '/docs/',
  srcDir: '.',
  outDir: '../dist/docs',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: 'CharacterVaultFavicon.svg' }],
  ],
  themeConfig: {
    logo: '/CharacterVaultLogo.svg',
nav: [
      { text: 'App', link: 'https://vault.charactervault.app' },
      { text: 'GitHub', link: 'https://github.com/spaceman2408/CharacterVault' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Installation', link: '/getting-started/installation' },
          { text: 'Creating & Editing Characters', link: '/getting-started/creating-characters' },
        ],
      },
{
        text: 'Features',
        items: [
          { text: 'AI Creation Studio', link: '/features/ai-creation-studio' },
          { text: 'AI Assistant Orion', link: '/features/ai-assistant' },
          { text: 'AI Agent', link: '/features/ai-agent' },
          { text: 'AI Context Panel', link: '/features/ai-context' },
          { text: 'Editor & AI Toolkit', link: '/features/editor' },
          { text: 'Greetings Editor', link: '/features/greetings-editor' },
          { text: 'Lorebook Editor', link: '/features/lorebook-editor' },
          { text: 'Recursion Map Guide', link: '/features/recursion-map-guide' },
          { text: 'Lorebook Vault', link: '/features/lorebook-vault' },
          { text: 'Creator Notes Preview', link: '/features/creator-notes' },
          { text: 'Import & Export', link: '/features/import-export' },
          { text: 'Snapshots & Rollback', link: '/features/snapshots-history' },
          { text: 'Vault Organization', link: '/features/vault-organization' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'AI Setup', link: '/configuration/ai-setup' },
          { text: 'Reasoning Effort', link: '/configuration/reasoning-effort' },
          { text: 'Sampler Settings', link: '/configuration/sampler-settings' },
          {
            text: 'NanoGPT Usage Proxy',
            link: '/configuration/nanogpt-usage-proxy',
          },
        ],
      },


      {
        text: 'More',
        items: [
          { text: "What's New", link: '/whats-new' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Privacy', link: '/privacy' },
          { text: 'Changelog', link: '/changelog' },
          { text: 'Release 1.5.0', link: '/releases/v1.5.0' },
          { text: 'Release 1.4.5', link: '/releases/v1.4.5' },
          { text: 'Release 1.4.2', link: '/releases/v1.4.2' },
          { text: 'Release 1.4.1', link: '/releases/v1.4.1' },
          { text: 'Release 1.4.0', link: '/releases/v1.4.0' },
          { text: 'Release 1.3.1', link: '/releases/v1.3.1' },
          { text: 'Release 1.3.0', link: '/releases/v1.3.0' },
          { text: 'Release 1.2.1', link: '/releases/v1.2.1' },
          { text: 'Release 1.2.0', link: '/releases/v1.2.0' },
          { text: 'Release 1.1.0', link: '/releases/v1.1.0' },
          { text: 'Release 1.0.0', link: '/releases/v1.0.0' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/spaceman2408/CharacterVault' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: '<a href="/docs/privacy">Privacy</a>',
      copyright: 'Copyright © 2026 spaceman2408',
    },
  },
})
