# Vault Organization

The character library is your home base — a grid view of all your characters with tools for finding, duplicating, and managing your collection.

## Library Grid View

All characters are displayed as portrait-style cards in a responsive grid that adapts to your screen width:

| Screen | Columns |
| :--- | :--- |
| Mobile | 2 |
| Small tablet | 3 |
| Tablet | 4 |
| Desktop | 5 |
| Wide desktop | 6 |

Each card shows the character's portrait thumbnail, name, and last-opened time. Characters are always sorted alphabetically by name (case-insensitive, with natural number ordering — "Character 2" comes before "Character 10").

## Search

Use the search bar (in the header on desktop, below the header on mobile) to filter characters by name. The grid updates in real-time as you type.

## Continue

When you have at least one character, a **Continue** pill appears in the top-right of the library. It jumps straight to the character you most recently opened (or most recently updated), so you can pick up right where you left off.

## Quick Actions

Hover over a character card (or tap on mobile) to access quick actions:

| Action | Description |
| :--- | :--- |
| **Duplicate** | Creates a copy of the character with " (Copy)" appended to the name |
| **Delete** | Removes the character from your vault after a confirmation dialog |

Click anywhere on the card to open it in the workspace.

## Creating a New Character

Click **Create New** in the header to reveal an inline form. Type a name and press **Create** — the new character appears in the grid immediately.

## Importing

Click **Import** in the header to open a file picker. You can import `.png` character card images or `.json` character files. See [Import & Export](/features/import-export) for full details.

## Pagination

The library paginates automatically — 12 cards per page on mobile, 18 on desktop. Use the **Previous** and **Next** buttons at the bottom to navigate.

## Loading

When the library first loads, skeleton placeholders appear while character thumbnails are preloaded in the background. This prevents the grid from shifting as images load in.

## Offline-First Storage

All character data is stored locally in your browser. No server is required to use Character Vault.

::: warning
AI features (Orion assistant, AI toolbar) require an internet connection to reach your configured API endpoint.
:::

## Next Steps

- [Create a new character](/getting-started/creating-characters)
- [Import existing characters](/features/import-export)
