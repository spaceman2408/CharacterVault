import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'CharacterVault Docs',
  description: 'Documentation for CharacterVault — AI Character Management Suite',
  base: '/CharacterVault/docs/',
  srcDir: '.',
  outDir: '../dist/docs',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/CharacterVaultFavicon.svg' }],
  ],
  themeConfig: {
    logo: '/CharacterVaultLogo.svg',
    nav: [
      { text: 'App', link: 'https://spaceman2408.github.io/CharacterVault/' },
      { text: 'Docs Home', link: '/' },
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
          { text: 'AI Assistant — Orion', link: '/features/ai-assistant' },
          { text: 'Editor & AI Toolkit', link: '/features/editor' },
          { text: 'Greetings Editor', link: '/features/greetings-editor' },
          { text: 'Lorebook Editor', link: '/features/lorebook-editor' },
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
          { text: 'Sampler Settings', link: '/configuration/sampler-settings' },
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
      message: 'CharacterVault documentation',
      copyright: 'Copyright © 2026 spaceman2408',
    },
  },
})
