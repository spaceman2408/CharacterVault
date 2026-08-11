# Import & Export

CharacterVault plays well with the wider character card ecosystem. Whether you're moving characters from other apps, sharing them with friends, or just backing up your work, you can import and export in formats that work with SillyTavern, TavernAI, and most other character card tools.

## Importing Characters

Click **Import** in the vault header, then select one or more files — or drag and drop PNG/JSON files onto the library. CharacterVault accepts PNG images with embedded data or JSON files, and can import many at once.

### PNG Files

Character cards saved as PNG images store all their data in a special metadata chunk inside the file. When you import one, CharacterVault reads that chunk, parses the JSON inside, and creates a new character with the image as its avatar. This works with cards from SillyTavern, TavernAI, and similar tools.

### JSON Files

JSON imports are flexible. CharacterVault recognizes several formats:

- **Flat V2** — a simple JSON object with fields like `name`, `description`, `personality` sitting at the top level
- **Wrapped V2 or V3** — the same fields nested inside a structure that declares the specification version
- **CharacterVault export** — CharacterVault's own format includes everything the app stores about a character

All three load cleanly into your vault.

### From SillyTavern

The **[SillyTavern CharacterVault Export Extension](https://github.com/spaceman2408/SillyTavern-CharacterVaultExport)** adds an "Export to CharacterVault" button right inside SillyTavern's export menu. When you use it, the extension copies the character to your clipboard in a format CharacterVault understands — no need to save files manually.

## Vault backup

::: tip Custom AI context is not exported
Notes you paste under **AI Context → Custom** stay in this browser only. They are not written into PNG/JSON cards and are not included in vault Backup ZIPs. See [Custom Context](/features/ai-context#custom-context).
:::

From the library header, click **Backup** to download a ZIP of every character:

- Cards **with** an image → PNG with embedded data
- Cards **without** an image → JSON (V3)

Use this periodically so a browser wipe does not erase your vault.

## Exporting Characters

Open a character and click **Export** in the toolbar. You have two choices:

### PNG

Your character becomes a PNG image with all data embedded in the image file itself. This is the most versatile option — send it to anyone and they can drag it straight into SillyTavern, CharacterVault, or any compatible app. The data is embedded as a V3 specification.

### JSON

Exports a JSON file using the V3 specification. Includes name, description, personality, scenario, greetings, lorebook, creator information, tags, and notes.

## What Each Format Includes

| Feature | PNG | JSON |
| :--- | :--- | :--- |
| Basic fields (name, description, etc.) | ✓ | ✓ |
| Alternate greetings | ✓ | ✓ |
| Lorebook / character book | ✓ | ✓ |
| Creator name, version, tags | ✓ | ✓ |
| Creator notes | ✓ | ✓ |
| Character image | ✓ | — |
| Custom AI context (AI Context panel) | — | — |

## Lorebook Import & Export

There are two related paths:

### Inside the Lorebook Editor

On a **character** Lorebook tab or while editing a **vault** book, **Import** / **Export** act on the **current** book (import may replace existing entries after confirmation). Export is SillyTavern-oriented JSON.

See [Lorebook Editor → Import & Export](/features/lorebook-editor#import--export).

### Lorebook Vault library

On the home vault **Lorebooks** tab you can import one or more JSON files as **new standalone books**, export any book, and keep them separate from character cards. See [Lorebook Vault](/features/lorebook-vault).

### Attachments vs card export

Attaching a vault book is **vault-local** (one book per character) and does not by itself put those entries into PNG/JSON card export. Linking prompts you to **copy into the embedded lorebook** (overwrites embedded entries). You can also copy again later from the attach panel.

## Next Steps

- [Organize your vault](/features/vault-organization)
- [Lorebook Vault](/features/lorebook-vault)
- [Back up with snapshots](/features/snapshots-history)