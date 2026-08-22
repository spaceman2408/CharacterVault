# Vault Organization

The home vault is your library for **characters** and **standalone lorebooks**. Both stay in local IndexedDB; no account is required.

## Characters and Lorebooks tabs

| Tab | Contents |
| :--- | :--- |
| **Characters** | Portrait grid of character cards (this page’s focus) |
| **Lorebooks** | Standalone World Info library ([Lorebook Vault](/features/lorebook-vault)) |

The last selected tab is remembered in the browser.

## Character library grid

All characters are displayed as portrait-style cards in a responsive grid that adapts to your screen width:

| Screen | Columns |
| :--- | :--- |
| Mobile | 2 |
| Small tablet | 3 |
| Tablet | 4 |
| Desktop | 5 |
| Wide desktop | 6 |

Each card shows the character's portrait thumbnail, name, last-opened time, and compact **active / total** token estimates. Sort the grid by name or recent activity (see below).

## Search

Use the search bar (in the header on desktop, below the header on mobile) to filter characters. The grid updates in real-time as you type.

Search matches **character name** and **tags** (tags are not shown as chips in the library — they only participate in search).

## Sort

Above the grid, switch between:

| Mode | Order |
| :--- | :--- |
| **Name** | Alphabetical (case-insensitive, natural numbers) |
| **Recent** | Most recently opened first (falls back to last updated) |

Your sort preference is remembered in the browser.

## Token estimates

Each card shows two compact estimates: **active / total**.

| Value | What it counts |
| :--- | :--- |
| **Active** | Fields typically always in an RP prompt: name, description, appearance, personality, scenario, system, post-history, message examples |
| **Total** | Active fields plus first message, alternate greetings, lorebook, and metadata (creator, tags, etc.) |

Uses the same byte-based estimator as the AI context panel. Hover the value for exact counts.

## Continue

When you have at least one character, a **Continue** pill appears in the library header. It jumps straight to the character you most recently opened (or most recently updated), so you can pick up right where you left off.

## Quick Actions

Card actions appear in the top-right of each portrait. On mobile they stay visible; on desktop they show on hover.

| Action | Description |
| :--- | :--- |
| **Export** | Download this card as PNG or JSON without opening the editor |
| **Duplicate** | Creates a copy of the character with " (Copy)" appended to the name |
| **Delete** | Removes the character from your vault after a confirmation dialog |

PNG export requires a character image; use JSON if the card has no avatar yet.

Click anywhere else on the card to open it in the workspace.

## Creating a New Character

Click **Create New** in the header to reveal an inline form. Type a name and press **Create** — the new character appears in the grid immediately.

## Importing

Click **Import** in the header to open a file picker, or **drag and drop** one or more files onto the library. You can import multiple `.png` character card images or `.json` character files at once. See [Import & Export](/features/import-export) for full details.

## Vault backup

Click **Backup** in the header to download a ZIP of every character in your vault. Cards with images export as PNG (embedded data); cards without an image export as JSON. This is the recommended way to back up local IndexedDB storage.

## Pagination

The character library paginates automatically (12 cards per page on mobile, 18 on desktop). Use the **Previous** and **Next** buttons at the bottom to navigate.

## Lorebook library

For create / import / open / export / delete of standalone books, see [Lorebook Vault](/features/lorebook-vault).

## Loading

When the library first loads, skeleton placeholders appear while character thumbnails are preloaded in the background. This prevents the grid from shifting as images load in.

## Offline-First Storage

All character data is stored locally in your browser. No server is required to use Character Vault.

::: warning
AI features (Orion, Agent, AI toolbar) require an internet connection to reach your configured API endpoint.
:::

## Next Steps

- [Create a new character](/getting-started/creating-characters)
- [Import existing characters](/features/import-export)
